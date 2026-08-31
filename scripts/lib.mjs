// scripts/lib.mjs — gemeinsame Helfer für alle Scraper (fetch, Parser, zod, Snapshot-I/O).
// ESM (".mjs"), nur Node ≥ 22. Importiert kein src/ — reine Grundbausteine.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { z } from "zod";

/** Repo-Wurzel (eine Ebene über scripts/). */
export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Absolute Pfadbasis: relative Pfade werden gegen repoRoot aufgelöst. */
export function absPath(p) {
  if (isAbsolute(p)) return p;
  return resolve(repoRoot, p);
}

/** `tests/fixtures/<name>` lesen (z. B. "zai/overview.md"). */
export async function readFixture(name) {
  return readFile(resolve(repoRoot, "tests", "fixtures", ...name.split("/")), "utf8");
}

/** Textdatei lesen (relativ zu repoRoot oder absolut). */
export async function readTextFile(p) {
  return readFile(absPath(p), "utf8");
}

/** JSON lesen; bei nicht vorhandener/defekter Datei → null. */
export async function readJsonSafe(p) {
  try {
    return JSON.parse(await readTextFile(p));
  } catch {
    return null;
  }
}

export async function writeJson(p, data) {
  const file = absPath(p);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + "\n");
}

/** HTTP-Text holen mit Timeout + minimalem Retry. */
export async function fetchText(url, { timeoutMs = 20000, retries = 2, delayMs = 800 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          "user-agent": "provider-plans-scraper/1.0 (+https://github.com/all-the-rest/provider-plans)",
          accept: "text/html,text/markdown,text/plain,application/json;q=0.9,*/*;q=0.5",
        },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} für ${url}`);
      const text = await res.text();
      if (!text.trim()) throw new Error(`Leere Antwort für ${url}`);
      return text;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw new Error(`fetchText fehlgeschlagen für ${url}: ${lastErr?.message ?? lastErr}`);
}

/** Preise/Komma-Zahlen: "~~$0.15~~", "$1.4", "2.5 Credits" → Zahl; "Free"/"—" → null. */
export function parsePrice(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (/^(free|limited-time free|n\/?a|-|—|–)$/i.test(s)) return null;
  s = s
    .replace(/\\\$/g, "$")
    .replace(/~~[^~]*~~/g, "")
    .replace(/[¥€£]/g, "");
  const m = s.match(/\$?\s*(-?\d+(?:[.,]\d+)*)\b/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Ganze Zahl: "10,000", "4,100,000,000 （4.1B）Credits" → Zahl; sonst null. */
export function parseIntOrNull(t) {
  if (t == null) return null;
  const m = String(t).match(/\d[\d.,]*/);
  if (!m) return null;
  const s = m[0].replace(/[.,]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Gleitkomma aus Rohstring (Kommas als Tausendertrenner entfernt). */
export function parseFloatOrNull(t) {
  if (t == null) return null;
  const n = Number(String(t).replace(/\s/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Normalisierter Modellname als Pattern-Map-Key: lowercase, nur [a-z0-9._]. */
export function normalizeName(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9._]/g, "");
}

/**
 * Zeilen-/HTML-Tabellen-Rows extrahieren (robust für beide Dok-Formate):
 * - HTML-<table> (rendered Doku-Seiten)
 * - Markdown-Pipe-Tabellen (committete Fixtures)
 */
export function extractTableRows(text) {
  const rows = [];
  if (/<table[\s>]/i.test(text)) {
    const $ = cheerio.load(text);
    $("table").each((_, table) => {
      $(table)
        .find("tr")
        .each((_, tr) => {
          const cells = $(tr)
            .find("td, th")
            .map((_, c) => $(c).text().replace(/\s+/g, " ").trim())
            .get();
          if (cells.length) rows.push(cells);
        });
    });
  }
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    cells.shift();
    cells.pop();
    if (cells.length === 0) continue;
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
    rows.push(cells);
  }
  return rows;
}

/**
 * Anfragemuster-Zahlen: deutsche Tausendertrennung ("32.500" → 32500).
 */
function parsePatternNum(raw) {
  const cleaned = String(raw ?? "").replace(/[\s$]/g, "").replace(/[.,]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Regex der OpenCode-„X Input‑, Y Cached‑, Z Output‑Tokens pro Anfrage"-Zeilen (aus ocgo-price-tracker übersetzt). */
const PATTERN_LINE_RE =
  /^(.+?)\s*[—–-]\s*([\d.,]+)\s*Input[-,]{0,2}\s*([\d.,]+)\s*Cached[-,]{0,2}\s*([\d.,]+)\s*Output[-,]{0,2}\s*Tokens?\s*pro\s*Anfrage\s*$/i;

/**
 * Parst die dokumentierten Anfragemuster (Input/Cached/Output Tokens pro Anfrage)
 * aus Markdown-Zeilen oder einem HTML-Baum (li-Elemente). Kurzschreibweisen
 * ("GLM-5.3/5.2/5.1") erzeugen für jeden Teil einen Map-Eintrag.
 * @param {string|string[]} input Markdown-Text, HTML oder Liste von Zeilen/li-Texten
 * @returns {Map<string, {input:number, cached:number, output:number}>}
 */
export function parsePatternItems(input) {
  const lines = [];
  if (Array.isArray(input)) {
    lines.push(...input);
  } else if (typeof input === "string") {
    if (/<li[ >]/i.test(input)) {
      const $ = cheerio.load(input);
      $("li").each((_, el) => lines.push($(el).text().replace(/\s+/g, " ").trim()));
    } else {
      lines.push(...input.split(/\r?\n/));
    }
  }
  const patterns = new Map();
  for (const raw of lines) {
    const text = raw.trim().replace(/^\s*[-*+]\s+/, "").replace(/\s+/g, " ");
    const m = text.match(PATTERN_LINE_RE);
    if (!m) continue;
    const input = parsePatternNum(m[2]);
    const cached = parsePatternNum(m[3]);
    const output = parsePatternNum(m[4]);
    if (input === null || cached === null || output === null) continue;
    const parts = m[1]
      .split("/")
      .map((s) => s.trim().replace(/[*_`]/g, ""))
      .filter(Boolean);
    // Familienbewusste Auflösung: "GLM-5.3/5.2/5.1" → glm5.3/glm5.2/glm5.1,
    // damit künftige Schwestermodelle (glm-5.2 …) ihr Muster finden.
    const firstNorm = parts.length ? normalizeName(parts[0]) : "";
    const family = firstNorm.replace(/[0-9._]+/g, "");
    for (const part of parts) {
      let key = normalizeName(part);
      if (!/[a-z]/.test(key) && family) key = family + key;
      patterns.set(key, { input, cached, output });
    }
  }
  return patterns;
}

// ---- zod-Schemas (passend zu src/types.ts) ------------------------------------

const creditFieldsSchema = z.object({
  input: z.number().optional(),
  cached: z.number().optional(),
  output: z.number().optional(),
  inputMiss: z.number().optional(),
});

const requestPatternSchema = z.object({
  input: z.number(),
  cached: z.number(),
  output: z.number(),
});

const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["weekly", "monthly"]),
  priceMonthly: z.number(),
  priceQuarterlyMonthly: z.number().nullable(),
  priceYearlyMonthly: z.number().nullable(),
  credits5h: z.number().nullable(),
  creditsWeekly: z.number().nullable(),
  creditsMonthly: z.number().nullable(),
  notes: z.string().nullable(),
  sourceUrl: z.string(),
});

const modelSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.enum(["peak", "off-peak"]).nullable(),
  contextWindow: z.number().nullable(),
  creditPerM: creditFieldsSchema.partial().optional(),
  apiPrice: creditFieldsSchema.partial().optional(),
  pattern: requestPatternSchema.nullable().optional(),
  note: z.string().nullable(),
});

const peakSchema = z.object({
  windows: z.array(z.tuple([z.number(), z.number()])),
  phaseFactor: z.object({ peak: z.number(), "off-peak": z.number() }),
  weekendOffPeak: z.boolean(),
  tzOffsetMin: z.number(),
  timezoneLabel: z.string(),
  phaseLabel: z.object({ peak: z.string(), "off-peak": z.string() }),
  effectiveFromMs: z.number().nullable(),
});

const vendorDataSchema = z.object({
  vendorId: z.enum(["zai", "mimo"]),
  fetchedAt: z.string(),
  sourceUrls: z.array(z.string()),
  plans: z.array(planSchema),
  models: z.array(modelSchema),
  peak: peakSchema,
});

const changelogEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  changes: z.array(z.object({ de: z.string(), en: z.string() })),
});

export const changelogSchema = z.object({
  entries: z.array(changelogEntrySchema),
});

/** Liste von Modellen validieren (Pflichtfelder Pläne/Models/Peak). */
export function validateVendorData(obj, vendorId) {
  const data = vendorDataSchema.parse(obj);
  if (data.vendorId !== vendorId) {
    throw new Error(`validateVendorData: vendorId "${data.vendorId}" !== erwartet "${vendorId}"`);
  }
  if (!Array.isArray(data.plans) || data.plans.length === 0) {
    throw new Error(`validateVendorData: keine Pläne für "${vendorId}"`);
  }
  if (!Array.isArray(data.models) || data.models.length === 0) {
    throw new Error(`validateVendorData: keine Modelle für "${vendorId}"`);
  }
  return { ...data, vendorId };
}

export function validateChangelog(obj) {
  return changelogSchema.parse(obj);
}

/**
 * Struktur-Check: Ein Modell mit API-Preisen, aber ohne Anfragemuster bricht
 * den Scrape ab (process.exit(1)), damit kein unvollständiger Snapshot entsteht.
 */
export function assertPatternConsistency(models) {
  const missing = models.filter((m) => {
    const hasApi =
      m.apiPrice && Object.values(m.apiPrice).some((v) => typeof v === "number" && Number.isFinite(v));
    return hasApi && !m.pattern;
  });
  if (missing.length) {
    console.error(
      `[consistency] Modell(e) mit API-Preisen aber ohne Pattern: ${missing
        .map((m) => `${m.id}${m.tier ? ` (${m.tier})` : ""}`)
        .join(", ")}`
    );
    process.exit(1);
  }
}

// ---- Snapshot / History / Changelog -------------------------------------------

export async function writeSnapshot(vendorId, data, opts = {}) {
  const latestPath =
    opts.latestPath ?? resolve(repoRoot, "src", "vendors", vendorId, "data", "latest.json");
  const prev = await readJsonSafe(latestPath);
  await mkdir(dirname(latestPath), { recursive: true });
  await writeFile(latestPath, JSON.stringify(data, null, 2) + "\n");
  await appendHistory(vendorId, data, opts);
  await mergeChangelog(vendorId, data, prev, opts);
}

/** data/history.json — Map vendorId → vergangene VendorPriceData-Snapshots. */
export async function appendHistory(vendorId, data, opts = {}) {
  const file = opts.historyPath ?? resolve(repoRoot, "data", "history.json");
  await mkdir(dirname(file), { recursive: true });
  const history = (await readJsonSafe(file)) ?? {};
  if (!Array.isArray(history[vendorId])) history[vendorId] = [];
  history[vendorId].push(JSON.parse(JSON.stringify(data)));
  await writeFile(file, JSON.stringify(history, null, 2) + "\n");
}

const CHANGE_LABELS = {
  priceMonthly: ["Monatspreis", "Monthly price"],
  priceQuarterlyMonthly: ["Quartalspreis (je Monat)", "Quarterly price (per month)"],
  priceYearlyMonthly: ["Jahrespreis (je Monat)", "Yearly price (per month)"],
  creditsWeekly: ["Wochen-Credits", "Weekly credits"],
  creditsMonthly: ["Monats-Credits", "Monthly credits"],
};

function fmtPrice(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "–";
  if (n >= 1) return `$${Math.round(n * 100) / 100}`;
  return `$${String(Math.round(n * 1e6) / 1e6)}`;
}

function fmtInt(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "–";
  return String(Math.round(n));
}

/** Diff zwischen vorherigem und neuem Snapshot → Changelog-Einträge (de/en). */
export function buildChangelogEntries(prev, next, vendorId) {
  if (!prev || !Array.isArray(prev.plans) || !Array.isArray(prev.models)) return [];
  const de = [];
  const en = [];
  const prevPlans = new Map(prev.plans.map((p) => [p.id, p]));
  for (const p of next.plans) {
    const o = prevPlans.get(p.id);
    if (!o) continue;
    for (const [field, [labelDe, labelEn]] of Object.entries(CHANGE_LABELS)) {
      if (o[field] !== p[field]) {
        de.push(`${p.name}: ${labelDe} ${fmtPrice(o[field])} → ${fmtPrice(p[field])}`);
        en.push(`${p.name}: ${labelEn} ${fmtPrice(o[field])} → ${fmtPrice(p[field])}`);
      }
    }
  }
  const prevModels = new Map(
    prev.models.map((m) => [`${m.id}|${m.tier ?? ""}`, m])
  );
  for (const m of next.models) {
    const o = prevModels.get(`${m.id}|${m.tier ?? ""}`);
    if (!o) continue;
    for (const field of ["input", "cached", "output", "inputMiss"]) {
      if (o.creditPerM?.[field] !== m.creditPerM?.[field]) {
        de.push(`${m.name}: ${field}-Credits ${fmtInt(o.creditPerM?.[field])} → ${fmtInt(m.creditPerM?.[field])}`);
        en.push(`${m.name}: ${field} credits ${fmtInt(o.creditPerM?.[field])} → ${fmtInt(m.creditPerM?.[field])}`);
      }
    }
  }
  if (!de.length) return [];
  const date = new Date(next.fetchedAt ?? Date.now()).toISOString().slice(0, 10);
  return [
    {
      id: `${vendorId}-${date}`,
      date,
      changes: [{ de: de.join("; "), en: en.join("; ") }],
    },
  ];
}

/**
 * changelog.json mergen: neue Einträge oben, dedupe per id.
 * Vorhandene Einträge (z. B. vom Vendor-Modul gepflegt) bleiben erhalten.
 */
export async function mergeChangelog(vendorId, next, prev, opts = {}) {
  const file = opts.changelogPath ?? resolve(repoRoot, "src", "vendors", vendorId, "data", "changelog.json");
  let changelog = (await readJsonSafe(file)) ?? { entries: [] };
  if (Array.isArray(changelog)) changelog = { entries: changelog };
  if (!Array.isArray(changelog?.entries)) changelog = { entries: [] };
  const fresh = buildChangelogEntries(prev, next, vendorId);
  for (const entry of fresh) {
    if (!changelog.entries.some((x) => x && x.id === entry.id)) {
      changelog.entries.unshift(entry);
    }
  }
  const seen = new Set();
  changelog.entries = changelog.entries.filter((e) => {
    if (!e || typeof e.id !== "string" || seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  await writeJson(file, changelog);
  return changelog;
}