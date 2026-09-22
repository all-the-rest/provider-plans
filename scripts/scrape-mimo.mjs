// scripts/scrape-mimo.mjs — MiMo Token Plan (mimo.mi.com): Pläne + Credits +
// Off-Peak-Rabatt aus dem Token-Plan-Doc, Overseas-API-Preise aus pay-as-you-go.
import {
  assertPatternConsistency,
  enrichModelMeta,
  extractTableRows,
  fetchText,
  loadModelsDev,
  normalizeName,
  parseIntOrNull,
  parsePrice,
  readFixture,
  readJsonSafe,
  validateVendorData,
  writeSnapshot,
} from "./lib.mjs";

export const MIMO_TOKEN_PLAN_URL = "https://mimo.mi.com/docs/en-US/price/token-plan";
export const MIMO_API_PRICING_URL = "https://mimo.mi.com/docs/en-US/price/pay-as-you-go";

const PLAN_SET = ["Lite", "Standard", "Pro", "Max"];
const BEIJING_OFFSET_MIN = 480; // Beijing = UTC+8

/** Einzelnes MiMo-Modell: "mimo-v2.6-pro", "mimo-v2.5", "mimo-v2.6-pro-ultraspeed". */
const MIMO_MODEL_RE = /mimo-v\d+(?:\.\d+)?(?:-[a-z]+)*/i;

/**
 * Quota-Zelle → Credits: "4.1 billion Credits" → 4.1e9 (auch M/million,
 * Komma-Dezimal "4,1 billion"); sonst parseIntOrNull-Fallback (altes Format
 * "4,100,000,000 （4.1B）Credits").
 */
function parseQuotaCredits(raw) {
  const s = String(raw ?? "");
  const m = s.match(/([\d.,]+)\s*(billions?|bn|b|millions?|m)\b/i);
  if (m) {
    let num = m[1];
    if (num.includes(".") || (num.match(/,/g) ?? []).length > 1) {
      num = num.replace(/,/g, "");
    } else if (num.includes(",")) {
      const [a, b] = num.split(",");
      num = b !== undefined && b.length <= 2 ? `${a}.${b}` : a + b;
    }
    const n = Number(num);
    if (Number.isFinite(n)) {
      return Math.round(n * (m[2].toLowerCase().startsWith("b") ? 1e9 : 1e6));
    }
  }
  return parseIntOrNull(s);
}

/**
 * Alle Modell-Keys einer Tabellenzelle:
 * "`mimo-v2.6-pro`、`mimo-v2.5-pro`(to be deprecated)" → beide Keys.
 * Prosa-Zellen (Szenarien-Texte) und ASR/TTS-Zeilen → [].
 */
function extractModelKeys(cell) {
  const s = String(cell ?? "")
    .replace(/`/g, " ")
    .replace(/\*/g, "")
    .replace(/\([^)]*\)/g, " ");
  const tokens = s.split(/[\s,、，;|/]+/).map((t) => t.trim()).filter(Boolean);
  if (!tokens.length) return [];
  const full = new RegExp(`^${MIMO_MODEL_RE.source}$`, "i");
  const keys = [];
  for (const t of tokens) {
    if (!full.test(t)) return [];
    const key = t.toLowerCase();
    if (/-(asr|tts)\b/i.test(key)) return [];
    keys.push(key);
  }
  return keys;
}

// ---------------------------------------------------------------------------
// parseMimoTokenPlan
// ---------------------------------------------------------------------------

/**
 * Parst das Token-Plan-Dokument:
 * - Monats-/Jahres-Preise (Pläne) + Monats-Credits
 * - Off-Peak-Rabatt (Faktor 0.8x, Peking 00–08 = UTC 16–24, kein Wochenend-Sonderfall)
 * - Modell-Credit-Quoten (Cache-Hit / Cache-Miss / Output, „Credits")
 */
export function parseMimoTokenPlan(md) {
  const monthlyPrices = {};
  const monthlyCredits = {};
  const annualPrices = {};
  let currentPlans = null;

  const rows = extractTableRows(md);
  for (const cells of rows) {
    const norm = cells.map((c) => String(c ?? "").replace(/\*\*/g, "").trim());
    const label = norm[0] ?? "";

    // Kopfzeile der Plan-Tabellen (leere erste Spalte + 4 Plan-Namen)
    if (
      norm.length >= 5 &&
      PLAN_SET.includes(norm[1]) &&
      norm.slice(1).every((c) => PLAN_SET.includes(c))
    ) {
      currentPlans = norm.slice(1).map((p) => p.toLowerCase());
      continue;
    }
    if (!currentPlans || norm.length < currentPlans.length + 1) continue;

    if (/pricing|price/i.test(label)) {
      const isAnnual = norm.slice(1).some((c) => /\/\s*year/i.test(c));
      const target = isAnnual ? annualPrices : monthlyPrices;
      for (let i = 0; i < currentPlans.length; i++) {
        // "$6/month", "USD 168.96/year", "USD 1,056.00/year", "$16/seat/month" (Team)
        const priceMatch = String(norm[i + 1] ?? "").match(
          /(?:USD|\$)\s*([\d,]+(?:\.\d+)?)\s*\/\s*(?:seat\s*\/\s*)?(month|year)/i
        );
        if (priceMatch && target[currentPlans[i]] === undefined) {
          const v = Number(priceMatch[1].replace(/,/g, ""));
          if (Number.isFinite(v)) target[currentPlans[i]] = v;
        }
      }
    } else if (/quota|credit/i.test(label)) {
      if (!/annual/i.test(label)) {
        for (let i = 0; i < currentPlans.length; i++) {
          const n = parseQuotaCredits(norm[i + 1]);
          if (n !== null && monthlyCredits[currentPlans[i]] === undefined) {
            monthlyCredits[currentPlans[i]] = n;
          }
        }
      }
    }
  }

  const discounts = parseDiscounts(md);

  const plans = Object.keys(monthlyPrices)
    .filter((id) => PLAN_SET.map((p) => p.toLowerCase()).includes(id))
    .map((id) => {
      const priceMonthly = monthlyPrices[id];
      const priceYearly =
        annualPrices[id] !== undefined ? Math.round((annualPrices[id] / 12) * 1e6) / 1e6 : null;
      return {
        id,
        name: PLAN_SET.find((p) => p.toLowerCase() === id),
        kind: "monthly",
        priceMonthly,
        priceQuarterlyMonthly: null,
        priceYearlyMonthly: priceYearly,
        credits5h: null,
        creditsWeekly: null,
        creditsMonthly: monthlyCredits[id] ?? null,
        notes: discounts.firstPurchase ? `Erstkauf −${discounts.firstPurchase} % (einmalig)` : null,
        // sourceUrl wird in scrapeMimo gesetzt
      };
    });

  return {
    plans,
    night: parseNightConfig(md),
    models: parseTokenPlanModels(md),
    discounts,
  };
}

/** Rabatte aus dem „Discounts"-Abschnitt ("first purchase … 12 % off"). */
function parseDiscounts(md) {
  const firstMatch = md.match(/first purchase[^\n]{0,80}?(\d{1,3})\s*%/i);
  return {
    firstPurchase: firstMatch ? parseFloat(firstMatch[1]) : null,
    annual: null,
  };
}

function parseNightConfig(md) {
  const factorMatch =
    md.match(/consumption coefficient of\s*([\d.]+)\s*[x×]?/i) ??
    md.match(/([\d.]+)\s*[x×]\s*consumption/i);
  const factor = factorMatch && Number.isFinite(parseFloat(factorMatch[1]))
    ? parseFloat(factorMatch[1])
    : 0.8;

  // „UTC 16:00-24:00" aus dem Off-Peak-Satz
  let windows = [[16, 24]];
  const utcMatch = md.match(/UTC\s*(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/i);
  if (utcMatch) {
    windows = [[Number(utcMatch[1]), Number(utcMatch[3])]];
  }
  return { factor, windows, weekend: false, tz: BEIJING_OFFSET_MIN };
}

/** Modell-Credit-Quoten aus dem „Language Model"-Abschnitt. */
export function parseTokenPlanModels(md) {
  const models = {};
  const rows = extractTableRows(md);
  for (const cells of rows) {
    // Modell-Spalte finden (Inference-Type-Spalte + rowspan → Index variiert)
    const idx = cells.findIndex((c) => extractModelKeys(c).length > 0);
    if (idx === -1) continue;
    const keys = extractModelKeys(cells[idx]);
    const triple = [cells[idx + 1], cells[idx + 2], cells[idx + 3]].map((c) => parsePrice(c));
    if (triple.some((v) => v === null)) continue;
    for (const key of keys) {
      if (models[key]) continue;
      models[key] = { input: triple[0], inputMiss: triple[1], output: triple[2] };
    }
  }
  return models;
}

// ---------------------------------------------------------------------------
// parseMimoApiPricing
// ---------------------------------------------------------------------------

/**
 * Parst die Overseas-API-Preise (USD/1M Tokens) aus pay-as-you-go.
 * Nur USD-Zellen ($…) werden berücksichtigt, daher bleiben RMB-Tabellen außen vor.
 */
export function parseMimoApiPricing(md) {
  const apiPrices = {};
  const rows = extractTableRows(md);
  for (const cells of rows) {
    // Modell-Spalte finden (Inference-Type-Spalte + rowspan → Index variiert);
    // Mehrfach-Modelle pro Zelle ("`mimo-v2.6-pro`、`mimo-v2.5-pro`(to be deprecated)")
    // teilen sich das Preis-Tripel.
    const idx = cells.findIndex((c) => extractModelKeys(c).length > 0);
    if (idx === -1) continue;
    const keys = extractModelKeys(cells[idx]);
    const usdCells = cells.slice(idx + 1).filter((c) => String(c).includes("$"));
    const prices = usdCells.map((c) => parsePrice(c)).filter((v) => v !== null);
    if (prices.length < 3) continue;
    for (const key of keys) {
      if (apiPrices[key]) continue;
      apiPrices[key] = { input: prices[0], inputMiss: prices[1], output: prices[2] };
    }
  }
  return { apiPrices };
}

// ---------------------------------------------------------------------------
// scrapeMimo
// ---------------------------------------------------------------------------

/**
 * Kompletter MiMo-Snapshot bauen + validieren (+ optional schreiben).
 * @returns {Promise<object>} validiertes VendorPriceData-Objekt
 */
export async function scrapeMimo(opts = {}) {
  const stub = opts.stub ?? false;
  const tokenText =
    opts.tokenText ?? (stub ? await readFixture("mimo/token-plan.md") : await fetchText(MIMO_TOKEN_PLAN_URL));
  const pricingText =
    opts.pricingText ?? (stub ? await readFixture("mimo/pay-as-you-go.md") : await fetchText(MIMO_API_PRICING_URL));

  const parsed = parseMimoTokenPlan(tokenText);
  const apiPrices = parseMimoApiPricing(pricingText).apiPrices;

  if (!parsed.plans.length) {
    throw new Error("parseMimoTokenPlan: keine Pläne gefunden");
  }

  let patterns = {};
  if (opts.patterns instanceof Map) {
    patterns = Object.fromEntries(opts.patterns);
  } else if (opts.patterns && typeof opts.patterns === "object") {
    patterns = opts.patterns;
  } else if (opts.patternsPath) {
    const file = await readJsonSafe(opts.patternsPath);
    patterns = file?.patterns ?? {};
  } else {
    const file = await readJsonSafe("src/vendors/stats/opencode-patterns.json");
    patterns = file?.patterns ?? {};
  }

  let fallbackPattern = opts.fallbackPattern ?? null;
  if (!fallbackPattern && opts.fallbackPatternPath) {
    const file = await readJsonSafe(opts.fallbackPatternPath);
    fallbackPattern = file?.pattern ?? null;
  }
  if (!fallbackPattern) {
    const file = await readJsonSafe("src/vendors/stats/fallback-pattern.json");
    fallbackPattern = file?.pattern ?? null;
  }
  if (!fallbackPattern && stub) {
    const { parseFallbackPattern } = await import("./lib.mjs");
    const fixture = await readFixture("commandcode/pricing-limits.html");
    fallbackPattern = parseFallbackPattern(fixture);
  }

  const plans = parsed.plans.map((p) => ({ ...p, sourceUrl: MIMO_TOKEN_PLAN_URL }));

  const models = [];
  for (const key of ["mimo-v2.6-pro", "mimo-v2.6-flash"]) {
    const ratio = parsed.models[key];
    if (!ratio) continue;
    const creditPerM = {
      input: ratio.input * 1e6,
      inputMiss: ratio.inputMiss * 1e6,
      output: ratio.output * 1e6,
    };
    const pattern = patterns[normalizeName(key)] ?? fallbackPattern ?? null;
    // Wie z.ai: je Modell peak+off-peak-ROWs (identische Werte) – Vendor-Formeln
    // suchen das Flaggschiff über `id` + `tier === "peak"`.
    for (const tier of ["peak", "off-peak"]) {
      models.push({
        id: key,
        name: key,
        tier,
        contextWindow: null,
        creditPerM,
        apiPrice: apiPrices[key] ?? {},
        pattern,
        note: null,
      });
    }
  }
  assertPatternConsistency(models);

  // Kontextfenster + Hersteller aus models.dev (Provider-Zuordnung, Overwrite gewinnt).
  // Im Stub-Modus (write === false) keine Netzwerk-Abhängigkeit: nur Overrides.
  const providers =
    opts.write === false ? {} : (await loadModelsDev()).providers;
  enrichModelMeta(models, providers, {
    "mimo-v2.6-pro": { provider: "Xiaomi", contextWindow: 1048576 },
    "mimo-v2.6-flash": { provider: "Xiaomi", contextWindow: 1048576 },
  });

  const night = parsed.night;
  const data = {
    vendorId: "mimo",
    sourceUrls: [MIMO_TOKEN_PLAN_URL, MIMO_API_PRICING_URL],
    plans,
    models,
    peak: {
      windows: night.windows,
      phaseFactor: { peak: 1, "off-peak": night.factor },
      weekendOffPeak: night.weekend,
      tzOffsetMin: night.tz,
      timezoneLabel: "Peking (UTC+8)",
      phaseLabel: {
        peak: "Peak",
        "off-peak": "Off-Peak",
      },
      effectiveFromMs: null,
    },
  };

  const validated = validateVendorData(data, "mimo");
  if (opts.write !== false) await writeSnapshot("mimo", validated);
  return validated;
}