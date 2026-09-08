import type { Cycle, Lang, Phase, Plan, VendorModule } from "../types";
import { fmt } from "../util";

export interface SocialRow {
  name: string;
  requests: number | null;
  tier: Phase | null;
}

export interface SocialCardInput {
  vendorName: string;
  planName: string;
  priceLabel: string;
  cycle: Cycle;
  cycleLabel: string;
  rows: SocialRow[];
  lang: Lang;
  fetchedAt: string;
  peakNote?: string;
  tierLabels?: Record<Phase, string>;
}

export type CardSize = "og" | "twitter" | "ig45" | "story";

export const CARD_DIMS: Record<CardSize, { w: number; h: number }> = {
  og: { w: 1200, h: 630 },
  twitter: { w: 1200, h: 675 },
  ig45: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

export function tierLabel(phase: Phase | null, module: VendorModule): string {
  if (phase === null) return "";
  return module.peak.phaseLabel[phase];
}

export function buildSocialCardInput(
  module: VendorModule,
  plan: Plan,
  cycle: Cycle,
  lang: Lang,
  topN: number
): SocialCardInput {
  const f = module.formulas;
  const withReq = module.data.models
    .filter((m) => m.pattern !== null)
    .map((m) => ({ m, req: f.requestsPerMonth(m, plan) }))
    .sort((a, b) => {
      if (a.req === null && b.req === null) return 0;
      if (a.req === null) return 1;
      if (b.req === null) return -1;
      return b.req - a.req;
    })
    .slice(0, Math.max(0, topN));

  const price = f.planPriceMonth(plan, cycle);

  const rows: SocialRow[] = withReq.map(({ m, req }) => ({
    name: m.name,
    requests: req,
    tier: m.tier,
  }));

  let peakNote = "";
  const p = module.peak;
  if (p.windows.length > 0) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const win = p.windows.map(([s, e]) => `${pad(s)}–${pad(e)}`).join(", ");
    const offLabel = p.phaseLabel["off-peak"];
    const pct = offLabel.includes("%") ? "" : ` ${Math.round((p.phaseFactor["off-peak"] ?? 0) * 100)}%`;
    peakNote = `${p.phaseLabel.peak} ${win} UTC · ${offLabel}${pct}`;
    if (p.weekendOffPeak) {
      peakNote += lang === "de" ? ` · Sa/So ${offLabel}` : ` · Sat/Sun ${offLabel}`;
    } else {
      peakNote += lang === "de" ? ` · täglich` : ` · daily`;
    }
  }

  return {
    vendorName: module.meta.name,
    planName: plan.name,
    priceLabel: fmt(price),
    cycle,
    cycleLabel:
      cycle === "quarterly"
        ? module.i18n[lang].cycleQuarterly
        : cycle === "yearly"
          ? module.i18n[lang].cycleYearly
          : module.i18n[lang].cycleMonthly,
    rows,
    lang,
    fetchedAt: module.data.fetchedAt,
    peakNote,
    tierLabels: { ...module.peak.phaseLabel },
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtIntPlain(n: number | null, lang: Lang): string {
  if (n === null || Number.isNaN(n)) return "–";
  return new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US").format(Math.round(n));
}

export function renderSocialSvg(
  input: SocialCardInput,
  opts?: { topN?: number; theme?: "dark" | "light"; size?: CardSize }
): string {
  const topN = opts?.topN ?? input.rows.length;
  const theme = opts?.theme ?? "dark";
  const size = opts?.size ?? "og";
  const { w, h } = CARD_DIMS[size];
  const portrait = h > w || w < 1000;
  const mx = Math.round((w * 80) / 1200);
  const rightX = w - mx;
  const nameX = mx + 50;
  let rows = input.rows.slice(0, topN);
  const title = input.lang === "de" ? "Anfragen pro Monat" : "Requests per month";
  const pal =
    theme === "light"
      ? { bg: "#ffffff", text: "#0f172a", muted: "#475569", accent: "#0284c7", footer: "#94a3b8" }
      : { bg: "#0f172a", text: "#ffffff", muted: "#94a3b8", accent: "#38bdf8", footer: "#64748b" };
  const font = `font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif"`;
  const footerY = h - 40;

  // Header geometry (unshifted); dy centers the whole content group below.
  let titleY: number;
  let titleFs: number;
  let cycleY: number;
  let cycleFs: number;
  let peakY = 0;
  let peakFs = 0;
  let priceY: number;
  let priceFs: number;
  let tableTitleY: number;
  let tableTitleFs: number;
  let tableTopBase: number;
  let tableBottom: number;
  let rowFont: number;
  const hasPeak = Boolean(input.peakNote);
  if (portrait) {
    titleY = 110; titleFs = 44;
    cycleY = 162; cycleFs = 24;
    peakY = 198; peakFs = 22;
    priceY = hasPeak ? 254 : 218; priceFs = 28;
    tableTitleY = priceY + 46; tableTitleFs = 24;
    tableTopBase = tableTitleY + 16;
    tableBottom = h - 90;
    rowFont = 26;
  } else {
    titleY = 96; titleFs = 40;
    cycleY = 134; cycleFs = 22;
    priceY = 196; priceFs = 24;
    tableTitleY = 238; tableTitleFs = 20;
    tableTopBase = 250;
    tableBottom = h - 70;
    rowFont = 22;
  }

  const tableArea = Math.max(0, tableBottom - tableTopBase);
  const lo = portrait ? 56 : 44;
  const hi = portrait ? 104 : 96;
  const minH = 34;
  let rowH = hi;
  if (rows.length > 0) {
    rowH = Math.min(hi, Math.max(lo, Math.floor(tableArea / rows.length)));
    if (rows.length * minH > tableArea) {
      const maxRows = Math.max(0, Math.floor(tableArea / minH));
      rows = rows.slice(0, maxRows);
      rowH = minH;
    } else if (rows.length * rowH > tableArea) {
      rowH = Math.max(minH, Math.floor(tableArea / rows.length));
    }
  }
  // Keep the TOP-N count in the title accurate when rows were sliced to fit.
  // Landscape rows expand to fill the table area (verified table look); portrait
  // rows keep capped heights and the whole content group is centered instead —
  // stretching 4 rows over a 1920px canvas reads as a bug, not design.
  let headerSvg: string;
  if (!portrait && rows.length > 0 && rows.length * rowH < tableArea) {
    rowH = Math.max(rowH, Math.floor(tableArea / rows.length));
  }
  if (rowH >= 76) rowFont += portrait ? 4 : 2;
  const shift = Math.max(0, Math.floor((tableArea - rows.length * rowH) / 2));
  titleY += shift;
  cycleY += shift;
  peakY += shift;
  priceY += shift;
  tableTitleY += shift;
  const tableTop = tableTopBase + shift;
  if (portrait) {
    headerSvg =
      `<text x="${mx}" y="${titleY}" font-size="${titleFs}" font-weight="700" fill="${pal.text}" ${font}>${esc(input.vendorName)} · ${esc(input.planName)}</text>` +
      `<text x="${mx}" y="${cycleY}" font-size="${cycleFs}" fill="${pal.muted}" ${font}>${esc(input.cycleLabel)}</text>` +
      (hasPeak
        ? `<text x="${mx}" y="${peakY}" font-size="${peakFs}" fill="${pal.muted}" ${font}>${esc(input.peakNote ?? "")}</text>`
        : ``) +
      `<text x="${mx}" y="${priceY}" font-size="${priceFs}" font-weight="700" fill="${pal.accent}" ${font}>${esc(input.priceLabel)} /mo</text>` +
      `<text x="${mx}" y="${tableTitleY}" font-size="${tableTitleFs}" fill="${pal.muted}" ${font}>${esc(title)} (TOP-${rows.length})</text>`;
  } else {
    headerSvg =
      `<text x="${mx}" y="${titleY}" font-size="${titleFs}" font-weight="700" fill="${pal.text}" ${font}>${esc(input.vendorName)} · ${esc(input.planName)}</text>` +
      `<text x="${mx}" y="${cycleY}" font-size="${cycleFs}" fill="${pal.muted}" ${font}>${esc(input.cycleLabel)}${input.peakNote ? " · " + esc(input.peakNote) : ""}</text>` +
      `<text x="${mx}" y="${priceY}" font-size="${priceFs}" font-weight="700" fill="${pal.accent}" ${font}>${esc(input.priceLabel)} /mo</text>` +
      `<text x="${mx}" y="${tableTitleY}" font-size="${tableTitleFs}" fill="${pal.muted}" ${font}>${esc(title)} (TOP-${rows.length})</text>`;
  }
  const rowSvg = rows
    .map((r, i) => {
      const yy = tableTop + i * rowH;
      const baseline = Math.round(yy + rowH / 2 + rowFont * 0.35);
      const tierSuffix =
        r.tier !== null && r.tier !== undefined && input.tierLabels
          ? " · " + input.tierLabels[r.tier]
          : "";
      const label = `${r.name}${tierSuffix}`;
      const divider =
        i > 0
          ? `<line x1="${mx}" y1="${yy}" x2="${rightX}" y2="${yy}" stroke="${pal.muted}" stroke-width="1" opacity="0.25"/>`
          : "";
      return (
        divider +
        `<text x="${mx}" y="${baseline}" font-size="${rowFont}" fill="${pal.muted}" ${font}>${i + 1}</text>` +
        `<text x="${nameX}" y="${baseline}" font-size="${rowFont}" fill="${pal.text}" ${font}>${esc(label)}</text>` +
        `<text x="${rightX}" y="${baseline}" font-size="${rowFont}" text-anchor="end" fill="${pal.text}" ${font}>${esc(fmtIntPlain(r.requests, input.lang))}</text>`
      );
    })
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="${pal.bg}"/>` +
    (theme === "light"
      ? `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="#e2e8f0" stroke-width="2"/>`
      : ``) +
    `<rect x="0" y="0" width="${w}" height="8" fill="${pal.accent}"/>` +
    headerSvg +
    rowSvg +
    `<text x="${mx}" y="${footerY}" font-size="18" fill="${pal.footer}" ${font}>${esc(input.fetchedAt)} · https://ai-vendor-price-tracking.all-the-rest</text>` +
    `</svg>`
  );
}

export function socialCardFilename(
  vendorId: string,
  planId: string,
  cycle: Cycle,
  lang: Lang,
  size: CardSize
): string {
  return `social-${vendorId}-${planId}-${cycle}-${lang}-${size}.svg`;
}
