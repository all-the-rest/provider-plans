import type { Lang } from "./types";

/** USD-Preis kompakt (z. B. $1.40, $0.075). */
export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  if (n >= 1) return "$" + n.toFixed(2);
  const s = n.toFixed(6);
  return "$" + s.replace(/0+$/, "").replace(/\.$/, "");
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

export function fmtDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(d);
}