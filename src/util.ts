import type { Lang } from "./types";

/** USD-Preis kompakt, auf maximal 4 Nachkommastellen gerundet („$0.0036", „$18"). */
export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  const s = n
    .toFixed(4)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
  return "$" + s;
}

/** Kreditkosten kompakt (z. B. 9,7 · 635K · 2.5M), mit bis zu 2 Nachkommastellen bei kleinen Werten. */
export function fmtCredits(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  if (n >= 1e6) return fmtBig(n);
  if (n >= 1000) {
    const v = n / 1000;
    return (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10)) + "K";
  }
  if (n >= 100) return String(Math.round(n));
  return String(Math.round(n * 100) / 100);
}

/** Große Zahlen mit Suffix (B/K/M/T), z. B. 4.1B Credits. */
export function fmtBig(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  const abs = Math.abs(n);
  if (abs >= 1e12) return trim(n / 1e12) + "T";
  if (abs >= 1e9) return trim(n / 1e9) + "B";
  if (abs >= 1e6) return trim(n / 1e6) + "M";
  if (abs >= 1e3) return trim(n / 1e3) + "K";
  return String(Math.round(n));
}

function trim(n: number): string {
  const v = Math.round(n * 100) / 100;
  return Number.isInteger(v) ? String(v) : String(v);
}

/** Ganze Zahlen mit Tausender-Trennung. */
export function fmtInt(n: number | null | undefined, lang: Lang = "de"): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US").format(Math.round(n));
}

/** Tokens-Anzahl (Anfragemuster). */
export function fmtTokens(n: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US").format(n);
}

/** Kontextfenster kompakt (1M / 128K / 4096), Spiegelbild zu cc-price-tracker. */
export function fmtContextWindow(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}M`;
  }
  if (n >= 1000) {
    const v = n / 1000;
    return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}K`;
  }
  return String(n);
}

export function fmtDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(d);
}