// scripts/scrape-ollama.mjs — Ollama Cloud (ollama.com/pricing): Pro/Max Pläne + Modell-API-Preise.
import * as cheerio from "cheerio";
import { assertPatternConsistency, enrichModelMeta, extractTableRows, fetchText, loadModelsDev, normalizeName, parsePrice, readFixture, readJsonSafe, validateVendorData, writeSnapshot } from "./lib.mjs";

export const OLLAMA_PRICING_URL = "https://ollama.com/pricing";

/**
 * Parst die Ollama-Pricing-Seite:
 * - Pläne Pro ($20/mo, $200/yr → $16.67/mo, $60 Credits) und Max ($100/mo, $300 Credits)
 * - Modellpreise USD/1M (Input / Cached / Output) aus der „Model pricing" Tabelle (Basis).
 * - Peak-Preise aus der zweiten Tabelle nach „Peak pricing" (nur DeepSeek-Modelle, 2× Basis).
 * - Peak-Fenster aus dem Satz „Peak pricing applies between 12:00 and 18:00 UTC, Monday to Friday."
 * - Cached „-" (mistral-large-3, nemotron-3-nano, qwen) → null (Key wird weggelassen).
 * @param {string} html
 * @returns {{plans: Array, modelPrices: Record<string,{input:number,cached:number|null,output:number}>, peakPrices: Record<string,{input:number,cached:number|null,output:number}>|null, peak: {windows: Array, weekendOffPeak: boolean}}}
 */
export function parseOllamaPricing(html) {
  let rawText = String(html ?? "");
  if (/<[a-z][\s\S]*>/i.test(rawText)) {
    try {
      rawText = cheerio.load(rawText).text();
    } catch {
      rawText = rawText.replace(/<[^>]+>/g, " ");
    }
  }
  const text = rawText.replace(/\s+/g, " ");

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

  // Modellpreise: erste Tabelle = Basis, Tabelle nach „Peak pricing" = Peak (DeepSeek).
  const parseCells = (cells) => {
    if (cells.length < 4) return null;
    const first = String(cells[0] ?? "").trim().replace(/`/g, "");
    // Header-Zeile überspringen
    if (/^model$/i.test(first)) return null;
    // Prüfe ob Zeile wie Modell aussieht (enthält Buchstaben/Zahlen, Preise in restlichen Zellen)
    const hasUsd = cells.slice(1).some((c) => String(c).includes("$") || /^-$/.test(String(c).trim()));
    if (!hasUsd) return null;
    // Normalisiere Modell-ID wie in API: lowercase, behalte ":" und "-" und "."
    const id = first.toLowerCase();
    // Nur bekannte Ollama-Modelle (erlaube alle mit $ Preisen)
    const input = parsePrice(cells[1]);
    const cached = parsePrice(cells[2]);
    const output = parsePrice(cells[3]);
    // „-" bei Cached (mistral-large-3, nemotron-3-nano, qwen) → null, Zeile behalten
    if (input === null || output === null) return null;
    return [id, { input, cached, output }];
  };

  const modelPrices = {};
  let peakPrices = null;
  if (/<table[\s>]/i.test(String(html ?? ""))) {
    const $ = cheerio.load(String(html));
    const baseRows = [];
    const peakRows = [];
    let seenPeak = false;
    for (const el of $("body").find("h1, h2, h3, h4, h5, p, table").toArray()) {
      const tag = el.tagName?.toLowerCase();
      if (tag === "table") {
        const target = seenPeak ? peakRows : baseRows;
        $(el)
          .find("tr")
          .each((_, tr) => {
            target.push(
              $(tr)
                .find("td, th")
                .map((_, c) => $(c).text().replace(/\s+/g, " ").trim())
                .get()
            );
          });
      } else if (/peak pricing/i.test($(el).text())) {
        seenPeak = true;
      }
    }
    // Fallback falls kein <body> (Fragment): alle Tabellen als Basis
    const rows = baseRows.length || peakRows.length ? baseRows : extractTableRows(html);
    for (const cells of rows) {
      const r = parseCells(cells);
      if (r && !modelPrices[r[0]]) modelPrices[r[0]] = r[1];
    }
    if (seenPeak && peakRows.length) {
      const peak = {};
      for (const cells of peakRows) {
        const r = parseCells(cells);
        if (r && !peak[r[0]]) peak[r[0]] = r[1];
      }
      if (Object.keys(peak).length) peakPrices = peak;
    }
  } else {
    for (const cells of extractTableRows(html)) {
      const r = parseCells(cells);
      if (r && !modelPrices[r[0]]) modelPrices[r[0]] = r[1];
    }
  }

  // Peak-Fenster aus „Peak pricing applies between 12:00 and 18:00 UTC, Monday to Friday."
  let windows = [];
  let weekendOffPeak = false;
  const windowMatch = text.match(
    /Peak pricing applies between\s+(\d{1,2})(?::\d{2})?\s*(?:-|–|—|and|to|until)\s*(\d{1,2})(?::\d{2})?\s*UTC/i
  );
  if (windowMatch) {
    const startH = Number(windowMatch[1]);
    const endH = Number(windowMatch[2]);
    if (Number.isFinite(startH) && Number.isFinite(endH)) windows = [[startH, endH]];
    weekendOffPeak = /Monday to Friday/i.test(text);
  }

  return { plans, modelPrices, peakPrices, peak: { windows, weekendOffPeak } };
}

/**
 * Kompletter Ollama-Snapshot bauen + validieren (+ optional schreiben).
 * @returns {Promise<object>} validiertes VendorPriceData-Objekt
 */
export async function scrapeOllama(opts = {}) {
  const stub = opts.stub ?? false;
  const html = opts.html ?? (stub ? await readFixture("ollama/pricing.html") : await fetchText(OLLAMA_PRICING_URL));

  let parsed = parseOllamaPricing(html);

  // Live-Fallback: wenn Pläne/Modelle nicht parsebar, kommittierte Daten nutzen (wie z.ai)
  if ((!parsed.plans.length || !Object.keys(parsed.modelPrices).length) && !stub) {
    const committed = await readJsonSafe("src/vendors/ollama/data/latest.json");
    if (committed && Array.isArray(committed.plans) && committed.plans.length && Array.isArray(committed.models) && committed.models.length) {
      console.error("[ollama] Warnung: live pricing nicht vollständig parsebar – nutze kommittierte Daten aus src/vendors/ollama/data/latest.json");
      const base = {};
      const peakP = {};
      for (const m of committed.models) {
        const api = {
          input: m.apiPrice?.input ?? m.creditPerM?.input,
          cached: m.apiPrice?.cached ?? m.creditPerM?.cached ?? null,
          output: m.apiPrice?.output ?? m.creditPerM?.output,
        };
        if (m.tier === "peak") {
          peakP[m.id] = {
            input: m.creditPerM?.input ?? api.input,
            cached: m.creditPerM?.cached ?? null,
            output: m.creditPerM?.output ?? api.output,
          };
          if (!(m.id in base)) base[m.id] = api;
        } else {
          base[m.id] = api;
        }
      }
      parsed = {
        plans: committed.plans,
        modelPrices: base,
        peakPrices: Object.keys(peakP).length ? peakP : null,
        peak: {
          windows: committed.peak?.windows ?? [],
          weekendOffPeak: committed.peak?.weekendOffPeak ?? false,
        },
      };
    } else if (!parsed.plans.length) {
      throw new Error("parseOllamaPricing: keine Pläne gefunden");
    } else if (!Object.keys(parsed.modelPrices).length) {
      throw new Error("parseOllamaPricing: keine Modellpreise gefunden");
    }
  } else {
    if (!parsed.plans.length) {
      throw new Error("parseOllamaPricing: keine Pläne gefunden");
    }
    if (!Object.keys(parsed.modelPrices).length) {
      throw new Error("parseOllamaPricing: keine Modellpreise gefunden");
    }
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

  // DeepSeek-Modelle mit Peak/Off-Peak: zwei Zeilen (z.ai-Konvention — beide creditPerM = PEAK,
  // Off-Peak-Rabatt via phaseFactor 0.5; apiPrice = Basis für die Wert-Rechnung).
  const PEAK_IDS = new Set(["deepseek-v4-flash", "deepseek-v4-pro"]);
  const priceObj = (p) => {
    const o = { input: p.input, output: p.output };
    if (p.cached !== null && p.cached !== undefined) o.cached = p.cached;
    return o;
  };
  const models = [];
  for (const [rawId, api] of Object.entries(parsed.modelPrices)) {
    const id = rawId;
    const norm = normalizeName(id);
    const pattern = patterns[norm] ?? fallbackPattern ?? null;
    // Manche IDs enthalten ":" (gpt-oss:120b, qwen3.5:397b) — normalize entfernt ":", daher fallback greift
    const name = rawId;
    const peakApi = parsed.peakPrices?.[id] ?? null;
    const mkRow = (tier, credit) => ({
      id,
      name,
      tier,
      contextWindow: null,
      creditPerM: priceObj(credit),
      apiPrice: priceObj(api),
      pattern,
      note: null,
    });
    if (PEAK_IDS.has(id) && peakApi) {
      models.push(mkRow("peak", peakApi));
      models.push(mkRow("off-peak", peakApi));
    } else {
      models.push(mkRow(null, api));
    }
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
    sourceUrls: [OLLAMA_PRICING_URL],
    plans: parsed.plans,
    models,
    peak: {
      windows: parsed.peak?.windows?.length ? parsed.peak.windows : [[12, 18]],
      phaseFactor: { peak: 1, "off-peak": 0.5 },
      weekendOffPeak: parsed.peak?.weekendOffPeak ?? true,
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
