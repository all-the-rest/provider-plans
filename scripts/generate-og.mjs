// OG-Image-Generator (Build-Artefakt).
// Default: Vendor zai, Plan Pro, cycle monthly, lang de, size og (1200x630), Top-4, dark.
// Lädt src/vendors/zai/data/latest.json (kein Netzwerk-Scrape) und rendert
// via @resvg/resvg-js nach public/share/og.png. Vite kopiert public/ → dist/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = "zai";
const PLAN_ID = "pro";
const TOP_N = 4;
const W = 1200;
const H = 630;
const DOMAIN = "ai-vendor-price-tracking.all-the.rest";

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtInt(n) {
  return new Intl.NumberFormat("de-DE").format(Math.round(n));
}

function fmtDate(iso) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(iso));
}

// Requests/Monat — gleiche Formel wie src/vendors/shared.ts (requestsPerMonth):
// pool = creditsWeekly × 4; cpr aus creditPerM/1e6 × pattern; req = pool / (cpr × phaseFactor).
function requestsPerMonth(model, plan, peak) {
  const pool = plan.creditsMonthly ?? (plan.creditsWeekly !== null ? plan.creditsWeekly * 4 : null);
  if (pool === null || pool <= 0 || !model.pattern) return null;
  const p = model.pattern;
  const c = model.creditPerM;
  if (c.input == null || c.cached == null || c.output == null) return null;
  const cpr = (p.input * c.input + p.cached * c.cached + p.output * c.output) / 1e6;
  const factor = peak.phaseFactor[model.tier ?? "peak"] ?? 1;
  const per = cpr * factor;
  if (!(per > 0)) return null;
  return pool / per;
}

const dataPath = resolve(root, `src/vendors/${VENDOR}/data/latest.json`);
let data;
try {
  data = JSON.parse(readFileSync(dataPath, "utf8"));
} catch (e) {
  console.error(`generate-og: keine Vendor-Daten unter ${dataPath}: ${e.message}`);
  process.exit(1);
}
const plan = (data.plans ?? []).find((p) => p.id === PLAN_ID);
if (!plan) {
  console.error(`generate-og: Plan "${PLAN_ID}" in ${dataPath} nicht gefunden`);
  process.exit(1);
}
const rows = (data.models ?? [])
  .map((m) => ({ name: m.tier ? `${m.name} · ${m.tier}` : m.name, req: requestsPerMonth(m, plan, data.peak) }))
  .filter((r) => r.req !== null)
  .sort((a, b) => b.req - a.req)
  .slice(0, TOP_N);
if (rows.length === 0) {
  console.error("generate-og: keine Modelle mit Requests berechenbar");
  process.exit(1);
}

const price = plan.priceMonthly;
const priceLabel = price !== null && price !== undefined ? `$${price}` : "–";
const builtAt = new Date().toISOString();
const font = `font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif"`;
const mx = 80;
const rightX = W - mx;
const nameX = mx + 50;
const bg = "#0f172a";
const text = "#ffffff";
const muted = "#94a3b8";
const accent = "#38bdf8";
const footer = "#64748b";

const rowH = 64;
const tableTop = 268;
const rowSvg = rows
  .map((r, i) => {
    const yy = tableTop + i * rowH;
    const baseline = Math.round(yy + rowH / 2 + 8);
    const divider =
      i > 0
        ? `<line x1="${mx}" y1="${yy}" x2="${rightX}" y2="${yy}" stroke="${muted}" stroke-width="1" opacity="0.25"/>`
        : "";
    return (
      divider +
      `<text x="${mx}" y="${baseline}" font-size="22" fill="${muted}" ${font}>${i + 1}</text>` +
      `<text x="${nameX}" y="${baseline}" font-size="22" fill="${text}" ${font}>${esc(r.name)}</text>` +
      `<text x="${rightX}" y="${baseline}" font-size="22" text-anchor="end" fill="${text}" ${font}>${esc(fmtInt(r.req))}</text>`
    );
  })
  .join("");

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  `<rect width="${W}" height="${H}" fill="${bg}"/>` +
  `<rect x="0" y="0" width="${W}" height="8" fill="${accent}"/>` +
  `<text x="${mx}" y="96" font-size="40" font-weight="700" fill="${text}" ${font}>Provider Plans</text>` +
  `<text x="${mx}" y="134" font-size="22" fill="${muted}" ${font}>${esc("z.ai — GLM Coding Plan")} · ${esc(plan.name)} · Monatlich</text>` +
  `<text x="${mx}" y="196" font-size="24" font-weight="700" fill="${accent}" ${font}>${esc(priceLabel)} /mo</text>` +
  `<text x="${mx}" y="238" font-size="20" fill="${muted}" ${font}>Top-${rows.length}-Modelle · Anfragen pro Monat</text>` +
  rowSvg +
  `<text x="${mx}" y="${H - 40}" font-size="18" fill="${footer}" ${font}>${esc(DOMAIN)} · ${esc(plan.name)}</text>` +
  `<text x="${rightX}" y="${H - 40}" font-size="18" text-anchor="end" fill="${footer}" ${font}>${esc(fmtDate(builtAt))}</text>` +
  `</svg>`;

const resvg = new Resvg(svg, { fitTo: { mode: "width", value: W } });
const png = resvg.render().asPng();
const outPath = resolve(root, "public/share/og.png");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, png);
console.log(`generate-og: ${outPath} (${W}x${H}, zai/${PLAN_ID}, top-${rows.length})`);
