// scripts/scrape-zai.mjs — GLM Coding Plan (z.ai): Credits/Multiplier/Peak aus
// docs.z.ai, API-Preise aus guides/overview/pricing.md, Plan-Preise von z.ai/subscribe
// (Playwright mit Fallback auf kommittete Daten bzw. Fixture-Stub).
import { chromium } from "@playwright/test";
import * as cheerio from "cheerio";
import {
  assertPatternConsistency,
  enrichModelMeta,
  extractTableRows,
  fetchText,
  loadModelsDev,
  normalizeName,
  parseFloatOrNull,
  parseIntOrNull,
  parsePrice,
  readFixture,
  readJsonSafe,
  readTextFile,
  validateVendorData,
  writeSnapshot,
} from "./lib.mjs";

export const ZAI_OVERVIEW_URL = "https://docs.z.ai/devpack/overview.md";
export const ZAI_PRICING_URL = "https://docs.z.ai/guides/overview/pricing.md";
export const ZAI_SUBSCRIBE_URL = "https://z.ai/subscribe";

const PLAN_IDS = ["lite", "pro", "max"];
const PEAK_OFFSET_MIN = 480; // SGT = UTC+8
const OFF_PEAK_EFFECTIVE = Date.parse("2026-07-30T00:00:00+08:00");

// ---------------------------------------------------------------------------
// parseZaiOverview
// ---------------------------------------------------------------------------

/**
 * Parst docs.z.ai Overview:
 * - Beimungs-Allowances (5h/Woche) je Plan
 * - Credit-Multiplier je Modell (GLM-5.3, GLM-5.3-Flash)
 * - Peak-Hours (SGT Mo–Fr 14–18 → UTC 06–10) + Off-Peak-Faktor 50 %
 */
export function parseZaiOverview(md) {
  const allowance = {};
  const multipliers = {};
  const rows = extractTableRows(md);

  for (const cells of rows) {
    const first = String(cells[0] ?? "").trim();
    if (["Lite", "Pro", "Max"].includes(first)) {
      const h5 = parseIntOrNull(cells[1]);
      const weekly = parseIntOrNull(cells[2]);
      if (h5 !== null && weekly !== null) {
        allowance[first.toLowerCase()] = { h5, weekly };
      }
    }
  }

  for (const cells of rows) {
    const modelIdx = cells.findIndex((c) => /^GLM-5\.3/.test(String(c ?? "").trim()));
    if (modelIdx === -1) continue;
    const product = String(cells[modelIdx]).trim();
    const key = /^GLM-5\.3-Flash/i.test(product)
      ? "glm-5.3-flash"
      : /^GLM-5\.3\b/i.test(product)
        ? "glm-5.3"
        : null;
    if (!key || multipliers[key]) continue;
    const input = parseFloatOrNull(cells[modelIdx + 1]);
    const cached = parseFloatOrNull(cells[modelIdx + 2]);
    const output = parseFloatOrNull(cells[modelIdx + 3]);
    if (input !== null && cached !== null && output !== null) {
      multipliers[key] = { input, cached, output };
    }
  }

  return { allowance, multipliers, peak: parsePeakConfig(md) };
}

function parsePeakConfig(md) {
  // Faktor: „… charged at 50% of the standard credit rate …"
  let factor = 1;
  const offMatch =
    md.match(/off-peak hours[^\n]{0,80}?charged at\s*([\d.]+)\s*%/i) ??
    md.match(/[\d.]+%\s*of the standard credit/i);
  if (offMatch && Number.isFinite(parseFloat(offMatch[1] ?? offMatch[0]))) {
    factor = parseFloat(offMatch[1] ?? offMatch[0]) / 100;
  } else if (/50\s*%/.test(md) && /off-peak/i.test(md)) {
    factor = 0.5;
  }

  // Fenster: „Peak hours: Monday to Friday, 14:00–18:00 Singapore Standard Time (UTC+8)" → UTC 06–10
  let windows = [[6, 10]];
  const peakMatch = md.match(
    /Peak hours[\s\S]{0,40}?Monday to Friday,\s*(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/i
  );
  if (peakMatch) {
    const startUtc = (Number(peakMatch[1]) - PEAK_OFFSET_MIN / 60 + 24) % 24;
    const endUtc = (Number(peakMatch[3]) - PEAK_OFFSET_MIN / 60 + 24) % 24;
    windows = [[startUtc, endUtc]];
  }

  return {
    windows,
    factor,
    weekend: true, // z.ai: Wochenenden durchgehend off-peak
    tz: PEAK_OFFSET_MIN,
    effectiveFrom: OFF_PEAK_EFFECTIVE,
  };
}

// ---------------------------------------------------------------------------
// parseZaiPricing
// ---------------------------------------------------------------------------

/**
 * Parst die API-Preise (USD/1M Tokens) aus pricing.md. Strikethrough-Listenpreise
 * (~~…~~) werden übersprungen → sichtbare „Now"-Preise gewinnen.
 */
export function parseZaiPricing(md) {
  const apiPrices = {};
  const rows = extractTableRows(md);
  for (const cells of rows) {
    const modelIdx = cells.findIndex((c) => /^GLM-5\.3/.test(String(c ?? "").trim()));
    if (modelIdx === -1) continue;
    const name = String(cells[modelIdx]).trim();
    const key = /^GLM-5\.3-Flash/i.test(name)
      ? "glm-5.3-flash"
      : /^GLM-5\.3\b/i.test(name)
        ? "glm-5.3"
        : null;
    if (!key || apiPrices[key]) continue;
    const input = parsePrice(cells[modelIdx + 1]);
    const cached = parsePrice(cells[modelIdx + 2]);
    const output = parsePrice(cells[modelIdx + 4] ?? cells[modelIdx + 3]);
    if (input !== null && cached !== null && output !== null) {
      apiPrices[key] = { input, cached, output };
    }
  }
  return { apiPrices };
}

// ---------------------------------------------------------------------------
// parseZaiSubscribe
// ---------------------------------------------------------------------------

function detectPriceDiscounts(billingText) {
  const text = String(billingText ?? "");
  const quarterlyMatch = text.match(/quarterly[^%]*?(\d+(?:\.\d+)?)\s*%/i);
  const yearlyMatch = text.match(/yearly[^%]*?(\d+(?:\.\d+)?)\s*%/i);
  return {
    quarterly: quarterlyMatch ? parseFloat(quarterlyMatch[1]) / 100 : null,
    yearly: yearlyMatch ? parseFloat(yearlyMatch[1]) / 100 : null,
  };
}

/**
 * Parst die gerenderte z.ai/subscribe-Seite: je Plan-Karte die Preise
 * `$X/month $Y/month` (X = Jahres-Effektivpreis je Monat, Y = Monats-Listenpreis)
 * plus Wochen-Credits bzw. „N× Lite usage". Stub: tests/fixtures/zai/subscribe.html.
 */
export function parseZaiSubscribe(html, { sourceUrl = ZAI_SUBSCRIBE_URL } = {}) {
  const $ = cheerio.load(html);
  const billingText = $(".billing, [class*='billing']").first().text();
  const billing = detectPriceDiscounts(billingText);

  const raw = [];
  $("section, [class*='plan-card']").each((_, el) => {
    const card = $(el);
    const title = card.find("h2, h3").first().text().trim();
    const id = { lite: "lite", pro: "pro", max: "max" }[title.trim().toLowerCase()];
    if (!id) return;
    const priceText = card.find("[class*='price']").first().text() || card.text();
    const prices = [...priceText.matchAll(/\$(\d+(?:\.\d+)?)\s*\/\s*month/gi)].map((m) =>
      parseFloat(m[1])
    );
    const body = card.text();
    const weeklyMatch = body.match(/([\d,]+)\s*Credits?\s*\/\s*week/i);
    const multMatch = body.match(/(\d+)\s*×\s*Lite usage/i);
    raw.push({
      id,
      title,
      prices,
      weekly: weeklyMatch ? parseIntOrNull(weeklyMatch[1]) : null,
      mult: multMatch ? Number(multMatch[1]) : null,
    });
  });

  const lite = raw.find((r) => r.id === "lite");
  return raw.map((r) => {
    const [a, b] = r.prices;
    const priceMonthly = r.prices.length >= 2 ? b : r.prices[0] ?? null;
    if (priceMonthly === null) {
      throw new Error(`parseZaiSubscribe: kein Preis für Karte "${r.title}"`);
    }
    const priceYearlyMonthly = r.prices.length >= 2 ? a : null;
    const priceQuarterlyMonthly =
      billing.quarterly !== null ? Math.round(priceMonthly * (1 - billing.quarterly) * 1e4) / 1e4 : null;
    const creditsWeekly =
      r.weekly ?? (r.mult !== null && lite?.weekly !== null ? lite.weekly * r.mult : null);
    const discountParts = [
      billing.yearly !== null ? `Jahr −${Math.round(billing.yearly * 100)} %` : null,
      billing.quarterly !== null ? `Quartal −${Math.round(billing.quarterly * 100)} %` : null,
    ].filter(Boolean);
    const notes = r.mult !== null ? `${r.mult}× Lite usage` : discountParts.join(" · ") || null;
    return {
      id: r.id,
      name: r.title,
      kind: "weekly",
      priceMonthly,
      priceQuarterlyMonthly,
      priceYearlyMonthly,
      credits5h: null,
      creditsWeekly,
      creditsMonthly: null,
      notes,
      sourceUrl,
    };
  });
}

/** Allowance (5h/Woche, aus Overview) als verbindliche Credits in die Pläne einsetzen. */
function mergeAllowance(plans, allowance) {
  return plans.map((p) => {
    const a = allowance[p.id];
    return {
      ...p,
      credits5h: a?.h5 ?? p.credits5h ?? null,
      creditsWeekly: a?.weekly ?? p.creditsWeekly ?? null,
    };
  });
}

/** Erkennt, ob eine HTML-Antwort echte Preis-Karten (kein leeres Shell) enthält. */
function isSubscribeHtml(html) {
  return (
    /\$\s*\d+(?:\.\d+)?\s*\/\s*month/i.test(html) ||
    /Credits?\s*\/\s*week/i.test(html) ||
    /plan-card|planCard/i.test(html)
  );
}

/** Lädt z.ai/subscribe via Playwright; null wenn Browser fehlt oder Rendering scheitert. */
async function playwrightZaiSubscribe(url) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.error(`[zai] Playwright-Browser nicht verfügbar: ${err.message}`);
    return null;
  }
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1500);
    return parseZaiSubscribe(await page.content());
  } catch (err) {
    console.error(`[zai] Playwright-Rendering von z.ai/subscribe fehlgeschlagen: ${err.message}`);
    return null;
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Auflösung der Plan-Preise (Reihenfolge):
 * 1. opts.subscribeStub / env ZAi_SUBSCRIBE_STUB → Fixture-Datei
 * 2. opts.stub → committete Fixture tests/fixtures/zai/subscribe.html
 * 3. Live: fetch → Playwright → sonst Fallback auf kommittete Plan-Preise in latest.json
 */
async function resolveZaiPlans(allowance, opts = {}) {
  let html = null;
  let committed = null;

  if (opts.subscribeStub) {
    html = await readTextFile(opts.subscribeStub);
  } else if (process.env.ZAi_SUBSCRIBE_STUB) {
    html = await readTextFile(process.env.ZAi_SUBSCRIBE_STUB);
  } else if (opts.stub) {
    html = await readFixture("zai/subscribe.html");
  }

  if (html) {
    try {
      return mergeAllowance(parseZaiSubscribe(html), allowance);
    } catch (err) {
      console.error(`[zai] Subscribe-Bezug (Stub) unbrauchbar: ${err.message}`);
      committed = await readJsonSafe("src/vendors/zai/data/latest.json");
    }
  }

  if (!html && !process.env.CI) {
    try {
      const raw = await fetchText(ZAI_SUBSCRIBE_URL, { timeoutMs: 20000 });
      if (isSubscribeHtml(raw)) {
        return mergeAllowance(parseZaiSubscribe(raw), allowance);
      }
    } catch {
      // weiter zu Playwright
    }
    const pw = await playwrightZaiSubscribe(ZAI_SUBSCRIBE_URL);
    if (pw) return mergeAllowance(pw, allowance);
  }

  committed = committed ?? (await readJsonSafe("src/vendors/zai/data/latest.json"));
  if (committed && Array.isArray(committed.plans) && committed.plans.length) {
    console.error(
      `[zai] Warnung: z.ai/subscribe nicht erreichbar – nutze kommittete Plan-Preise aus src/vendors/zai/data/latest.json`
    );
    return mergeAllowance(committed.plans, allowance);
  }
  throw new Error(
    "z.ai/subscribe nicht erreichbar und keine kommitteten Plan-Preise (src/vendors/zai/data/latest.json) vorhanden"
  );
}

/** GLM-5.3 unterstützt 1M-Kontext (Laufzeitwert aus Modell-Docs, wie kommittet). */
const GLM53_CONTEXT_WINDOW = 1000000;

/** Gleiche Modell-Daten, zwei Tier-Zeilen (peak/off-peak mit identischen Werten). */
function buildZaiModels(multipliers, apiPrices, patterns, promotion) {
  const models = [];
  for (const key of ["glm-5.3", "glm-5.3-flash"]) {
    const mult = multipliers[key];
    const api = apiPrices[key];
    if (!mult || !api) continue;
    const creditPerM = {
      input: (mult.input * 1e6) / 1e4,
      cached: (mult.cached * 1e6) / 1e4,
      output: (mult.output * 1e6) / 1e4,
    };
    const pattern = patterns[normalizeName(key)] ?? null;
    const name = key === "glm-5.3-flash" ? "GLM-5.3-Flash" : "GLM-5.3";
    const contextWindow = key === "glm-5.3" ? GLM53_CONTEXT_WINDOW : null;
    for (const tier of ["peak", "off-peak"]) {
      models.push({
        id: key,
        name,
        tier,
        contextWindow,
        creditPerM,
        apiPrice: api,
        pattern,
        note: null,
      });
    }
  }
  return models;
}

/** Promo-Text für GLM-5.3-Flash: „GLM-5.3-Flash: −50 % API-Preis (Aktion) bis … SGT." */
export function promotionNote(md) {
  if (!/promotion|strikethrough|discount/i.test(md)) return null;
  const endMatch = md.match(/ends? at\s*([\d:]+)\s*on\s*(\w+)\s+(\d{1,2}),?\s*(\d{4})/i);
  let end = null;
  if (endMatch) {
    const months = {
      january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
      july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
    };
    const iso = `${endMatch[4]}-${months[String(endMatch[2]).toLowerCase()] ?? "01"}-${String(endMatch[3]).padStart(2, "0")}`;
    const d = new Date(`${iso}T23:59:59+08:00`);
    if (!Number.isNaN(d.getTime())) end = `${iso} ${endMatch[1].padStart(2, "0")}`;
  }
  return end ? `GLM-5.3-Flash: −50 % API-Preis (Aktion) bis ${end} SGT.` : "GLM-5.3-Flash: −50 % API-Preis (Aktion).";
}

/**
 * Kompletter z.ai-Snapshot bauen + validieren (+ optional schreiben).
 * @returns {Promise<object>} validiertes VendorPriceData-Objekt
 */
export async function scrapeZai(opts = {}) {
  const stub = opts.stub ?? false;
  const overviewText =
    opts.overviewText ?? (stub ? await readFixture("zai/overview.md") : await fetchText(ZAI_OVERVIEW_URL));
  const pricingText =
    opts.pricingText ?? (stub ? await readFixture("zai/pricing.md") : await fetchText(ZAI_PRICING_URL));

  const overview = parseZaiOverview(overviewText);
  const pricing = parseZaiPricing(pricingText).apiPrices;

  const allowance = overview.allowance;
  if (!allowance.lite || !allowance.pro || !allowance.max) {
    throw new Error("parseZaiOverview: unvollständige Usage Allowance (Lite/Pro/Max)");
  }
  const plans = await resolveZaiPlans(allowance, opts);

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

  const modelRows = buildZaiModels(overview.multipliers, pricing, patterns, promotionNote(pricingText));
  assertPatternConsistency(modelRows);

  // Kontextfenster + Hersteller aus models.dev (Provider-Zuordnung, Overwrite gewinnt).
  // Im Stub-Modus (write === false) keine Netzwerk-Abhängigkeit: nur Overrides.
  const providers =
    opts.write === false ? {} : (await loadModelsDev()).providers;
  enrichModelMeta(modelRows, providers, {
    "glm-5.3": { provider: "Z.ai" },
    "glm-5.3-flash": { provider: "Z.ai", contextWindow: 1000000 },
  });

  const peak = overview.peak;
  const data = {
    vendorId: "zai",
    fetchedAt: new Date().toISOString(),
    sourceUrls: [ZAI_OVERVIEW_URL, ZAI_PRICING_URL, ZAI_SUBSCRIBE_URL],
    plans,
    models: modelRows,
    peak: {
      windows: peak.windows,
      phaseFactor: { peak: 1, "off-peak": peak.factor },
      weekendOffPeak: peak.weekend,
      tzOffsetMin: peak.tz,
      timezoneLabel: "SGT (UTC+8)",
      phaseLabel: { peak: "Peak", "off-peak": "Off-Peak" },
      effectiveFromMs: peak.effectiveFrom,
    },
  };

  const validated = validateVendorData(data, "zai");
  if (opts.write !== false) await writeSnapshot("zai", validated);
  return validated;
}