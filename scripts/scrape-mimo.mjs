// scripts/scrape-mimo.mjs — MiMo Token Plan (mimo.mi.com): Pläne + Credits +
// Nacht-Rabatt aus dem Token-Plan-Doc, Overseas-API-Preise aus pay-as-you-go.
import {
  assertPatternConsistency,
  extractTableRows,
  fetchText,
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

// ---------------------------------------------------------------------------
// parseMimoTokenPlan
// ---------------------------------------------------------------------------

/**
 * Parst das Token-Plan-Dokument:
 * - Monats-/Jahres-Preise (Pläne) + Monats-Credits
 * - Nacht-Rabatt (Faktor 0.8x, Peking 00–08 = UTC 16–24, kein Wochenend-Sonderfall)
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
        const priceMatch = String(norm[i + 1] ?? "").match(
          /\$\s*([\d.]+)\s*\/\s*(?:month|year)/i
        );
        if (priceMatch && target[currentPlans[i]] === undefined) {
          target[currentPlans[i]] = parseFloat(priceMatch[1]);
        }
      }
    } else if (/credit/i.test(label)) {
      if (!/annual/i.test(label)) {
        for (let i = 0; i < currentPlans.length; i++) {
          const n = parseIntOrNull(norm[i + 1]);
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
    const first = String(cells[0] ?? "").trim();
    if (!/^(mimo-v2\.5|mimo-v2\.5-pro)$/i.test(first)) continue;
    const key = first.toLowerCase();
    if (models[key]) continue;
    const hit = parsePrice(cells[1]);
    const miss = parsePrice(cells[2]);
    const output = parsePrice(cells[3]);
    if (hit !== null && miss !== null && output !== null) {
      models[key] = { input: hit, inputMiss: miss, output };
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
    const idx = cells.findIndex((c) => {
      const s = String(c ?? "").replace(/`/g, "").trim();
      return /^mimo-v2\.5(-pro)?$/i.test(s);
    });
    if (idx === -1) continue;
    const key = String(cells[idx]).replace(/`/g, "").trim().toLowerCase();
    if (apiPrices[key]) continue;
    const usdCells = cells.slice(idx + 1).filter((c) => String(c).includes("$"));
    const prices = usdCells.map((c) => parsePrice(c)).filter((v) => v !== null);
    if (prices.length >= 3) {
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

  const plans = parsed.plans.map((p) => ({ ...p, sourceUrl: MIMO_TOKEN_PLAN_URL }));

  const models = [];
  for (const key of ["mimo-v2.5-pro", "mimo-v2.5"]) {
    const ratio = parsed.models[key];
    if (!ratio) continue;
    const creditPerM = {
      input: ratio.input * 1e6,
      inputMiss: ratio.inputMiss * 1e6,
      output: ratio.output * 1e6,
    };
    const pattern = patterns[normalizeName(key)] ?? null;
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

  const night = parsed.night;
  const data = {
    vendorId: "mimo",
    fetchedAt: new Date().toISOString(),
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
        peak: "Tag",
        "off-peak": `Nacht −${Math.round((1 - night.factor) * 100)} %`,
      },
      effectiveFromMs: null,
    },
  };

  const validated = validateVendorData(data, "mimo");
  if (opts.write !== false) await writeSnapshot("mimo", validated);
  return validated;
}