import type { Lang, PeakConfig } from "./types";

const DAY_NAMES: Record<Lang, string[]> = {
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

/**
 * Wochentags-Scope aus der `days`-Liste generieren (kein `weekendOffPeak`-Prose mehr):
 * `[1..5]` → „Mo–Fr", `[6,7]` → „Sa/So", `[1..7]` → „täglich", `[]` → "".
 */
export function describeWeekdays(days: number[], lang: Lang): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  if (sorted.length === 7) return lang === "de" ? "täglich" : "daily";
  const names = DAY_NAMES[lang];
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j > i ? `${names[sorted[i] - 1]}–${names[sorted[j] - 1]}` : names[sorted[i] - 1]);
    i = j + 1;
  }
  return parts.join("/");
}

/** Kompakte Fenster-Liste (`[[6,10]]` → „06–10"). */
function describeWindows(windows: [number, number][]): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return windows.map(([s, e]) => `${pad(s)}–${pad(e)}`).join(", ");
}

/**
 * Peak-Hinweis vollständig aus der Regel generieren (Wochentage, Fenster, Off-Peak-Faktor,
 * Feiertage) — Ersatz für die früheren handschriftlichen `peakWeekendNote`-Prosa-Texte.
 */
export function peakScopeNote(peak: PeakConfig, lang: Lang): string {
  const de = lang === "de";
  const peakDays = describeWeekdays(peak.peak.days, lang);
  const offDays = describeWeekdays(peak.offPeak.days, lang);
  const pct = Math.round((peak.phaseFactor["off-peak"] ?? 0) * 100);
  const offClause = offDays
    ? de
      ? `${offDays} ganztägig Off-Peak`
      : `${offDays} off-peak all day`
    : de
      ? "außerhalb der Fenster Off-Peak"
      : "off-peak outside the windows";
  const holidayClause = peak.holidays
    ? de
      ? " · Feiertage ganztägig Off-Peak"
      : " · public holidays off-peak all day"
    : "";
  return de
    ? `Peak ${peakDays} ${describeWindows(peak.peak.windowsUtc)} UTC · ${offClause} · Off-Peak = ${pct} % Credits${holidayClause}.`
    : `Peak ${peakDays} ${describeWindows(peak.peak.windowsUtc)} UTC · ${offClause} · off-peak = ${pct}% credits${holidayClause}.`;
}
