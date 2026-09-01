// scripts/scrape-ollama.mjs — Ollama Cloud (ollama.com/pricing): Pro/Max Pläne + Modell-API-Preise.
import { assertPatternConsistency, enrichModelMeta, extractTableRows, fetchText, loadModelsDev, normalizeName, parsePrice, readFixture, readJsonSafe, validateVendorData, writeSnapshot } from "./lib.mjs";

export const OLLAMA_PRICING_URL = "https://ollama.com/pricing";

/**
 * Parst die Ollama-Pricing-Seite:
 * - Pläne Pro ($20/mo, $200/yr → $16.67/mo, $60 Credits) und Max ($100/mo, $300 Credits)
 * - Modellpreise USD/1M (Input / Cached / Output) aus der „Model pricing" Tabelle.
 * @param {string} html
 * @returns {{plans: Array, modelPrices: Record<string,{input:number,cached:number,output:number}>}}
 */
export function parseOllamaPricing(html) {
  const text = String(html ?? "").replace(/\s+/g, " ");

  // Pläne: Pro $20/mo or $200/yr + $60 credits, Max $100/mo + $300 credits
  const plans = [];

  // Pro: $20 / mo. or $200/yr ... $60 of usage credits
  const proCreditsMatch = text.match(/\$60\s*of usage credits/i);
  const maxCreditsMatch = text.match(/\$300\s*of usage credits/i);
  // Preise: suche $20 / mo und $16.67 oder $200/yr
  const proMonthly = (() => {
    const m = text.match(/\$20\s*\/\s*mo/i);
    return m ? 20 : null;
  })();
  const proYearlyTotal = (() => {
    const m = text.match(/\$200\s*\/\s*yr/i);
    return m ? 200 : null;
  })();
  const proYearlyMonthly = proYearlyTotal !== null ? Math.round((proYearlyTotal / 12) * 100) / 100 : 16.67;
  const maxMonthly = (() => {
    const m = text.match(/\$100\s*\/\s*mo/i);
    return m ? 100 : null;
  })();

  if (proMonthly !== null && proCreditsMatch) {
    plans.push({
      id: "pro",
      name: "Pro",
      kind: "monthly",
      priceMonthly: proMonthly,
      priceQuarterlyMonthly: null,
      priceYearlyMonthly: proYearlyMonthly,
      credits5h: null,
      creditsWeekly: null,
      creditsMonthly: 60,
      notes: proYearlyMonthly !== null ? `Jahr $200 (${proYearlyMonthly}/mo)` : null,
      sourceUrl: OLLAMA_PRICING_URL,
    });
  }
  if (maxMonthly !== null && maxCreditsMatch) {
    plans.push({
      id: "max",
      name: "Max",
      kind: "monthly",
      priceMonthly: maxMonthly,
      priceQuarterlyMonthly: null,
      priceYearlyMonthly: null,
      credits5h: null,
      creditsWeekly: null,
      creditsMonthly: 300,
      notes: null,
      sourceUrl: OLLAMA_PRICING_URL,
    });
  }

  // Modellpreise aus Tabelle
  const rows = extractTableRows(html);
  const modelPrices = {};
  for (const cells of rows) {
    if (cells.length < 4) continue;
    const first = String(cells[0] ?? "").trim().replace(/`/g, "");
    // Header-Zeile überspringen
    if (/^model$/i.test(first)) continue;
    // Prüfe ob Zeile wie Modell aussieht (enthält Buchstaben/Zahlen, Preise in restlichen Zellen)
    const hasUsd = cells.slice(1).some((c) => String(c).includes("$"));
    if (!hasUsd) continue;
    // Normalisiere Modell-ID wie in API: lowercase, behalte ":" und "-" und "."
    const id = first.toLowerCase();
    // Nur bekannte Ollama-Modelle (erlaube alle mit $ Preisen)
    const input = parsePrice(cells[1]);
    const cached = parsePrice(cells[2]);
    const output = parsePrice(cells[3]);
    if (input === null || cached === null || output === null) continue;
    if (modelPrices[id]) continue;
    modelPrices[id] = { input, cached, output };
  }

  return { plans, modelPrices };
}

/**
 * Kompletter Ollama-Snapshot bauen + validieren (+ optional schreiben).
 * @returns {Promise<object>} validiertes VendorPriceData-Objekt
 */
export async function scrapeOllama(opts = {}) {
  const stub = opts.stub ?? false;
  const html = opts.html ?? (stub ? await readFixture("ollama/pricing.html") : await fetchText(OLLAMA_PRICING_URL));

  const parsed = parseOllamaPricing(html);

  if (!parsed.plans.length) {
    throw new Error("parseOllamaPricing: keine Pläne gefunden");
  }
  if (!Object.keys(parsed.modelPrices).length) {
    throw new Error("parseOllamaPricing: keine Modellpreise gefunden");
  }

  // Patterns: per-Modell aus opencode + Fallback aus commandcode
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
  // Letzter Fallback für Stub ohne geschriebenes JSON: direkt parsen
  if (!fallbackPattern && stub) {
    const { parseFallbackPattern } = await import("./lib.mjs");
    const fixture = await readFixture("commandcode/pricing-limits.html");
    fallbackPattern = parseFallbackPattern(fixture);
  }

  const models = [];
  for (const [rawId, api] of Object.entries(parsed.modelPrices)) {
    const id = rawId;
    const norm = normalizeName(id);
    const pattern = patterns[norm] ?? fallbackPattern ?? null;
    // Manche IDs enthalten ":" (gpt-oss:120b, qwen3.5:397b) — normalize entfernt ":", daher fallback greift
    const name = rawId;
    const creditPerM = { input: api.input, cached: api.cached, output: api.output };
    models.push({
      id,
      name,
      tier: null,
      contextWindow: null,
      creditPerM,
      apiPrice: { input: api.input, cached: api.cached, output: api.output },
      pattern,
      note: null,
    });
  }

  assertPatternConsistency(models);

  const providers = opts.write === false ? {} : (await loadModelsDev()).providers;
  // Provider-Overrides für bekannte Familien
  const overrides = {
    "glm-5.3": { provider: "Z.ai" },
    "glm-5.3-flash": { provider: "Z.ai" },
    "glm-5.2": { provider: "Z.ai" },
    "glm-5.1": { provider: "Z.ai" },
    "deepseek-v4-flash": { provider: "DeepSeek" },
    "deepseek-v4-pro": { provider: "DeepSeek" },
    "gemma4": { provider: "Google" },
    "kimi-k3": { provider: "Moonshot AI" },
    "kimi-k2.7-code": { provider: "Moonshot AI" },
    "kimi-k2.6": { provider: "Moonshot AI" },
    "minimax-m3": { provider: "MiniMax" },
    "minimax-m2.7": { provider: "MiniMax" },
    "mistral-large-3": { provider: "Mistral" },
    "nemotron-3-nano": { provider: "NVIDIA" },
    "nemotron-3-super": { provider: "NVIDIA" },
    "nemotron-3-ultra": { provider: "NVIDIA" },
    "qwen3.5:397b": { provider: "Alibaba" },
    "gpt-oss:120b": { provider: "OpenAI" },
    "gpt-oss:20b": { provider: "OpenAI" },
  };
  enrichModelMeta(models, providers, overrides);

  const data = {
    vendorId: "ollama",
    fetchedAt: new Date().toISOString(),
    sourceUrls: [OLLAMA_PRICING_URL],
    plans: parsed.plans,
    models,
    peak: {
      windows: [],
      phaseFactor: { peak: 1, "off-peak": 1 },
      weekendOffPeak: false,
      tzOffsetMin: 0,
      timezoneLabel: "UTC",
      phaseLabel: { peak: "Peak", "off-peak": "Off-Peak" },
      effectiveFromMs: null,
    },
  };

  const validated = validateVendorData(data, "ollama");
  if (opts.write !== false) await writeSnapshot("ollama", validated);
  return validated;
}
