import type { PeakConfig, Phase } from "./types";
import { HOLIDAY_CALENDARS } from "./vendors/holidays";

/**
 * Reine Peak-Auswertung (kein SolidJS/JSX) — identisch in der Tracker-Familie.
 * Bewusst getrennt von `peak.tsx`, damit Tests/SSR die Logik ohne UI-Import laden.
 */
export const normalizePeakModel = (name: string) => name.toLowerCase().replace(/[\s-]+/g, "");

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** UTC-Stunde (mit Bruchteil) für die Fenster-Prüfung. */
function utcHour(now: number): number {
  const date = new Date(now);
  return date.getUTCHours() + date.getUTCMinutes() / 60;
}

/** Reine UTC-Stunden-Prüfung gegen die Fenster. */
function inUtcWindows(now: number, ranges: [number, number][]): boolean {
  const hour = utcHour(now);
  return ranges.some(([start, end]) => hour >= start && hour < end);
}

/** Lokales Kalenderdatum (YYYY-MM-DD) in der Regel-Zone — nie die Browser-Zone. */
export function localIsoDate(now: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

/** ISO-Wochentag 1=Mo … 7=So eines ISO-Datumsstrings. */
export function isoWeekday(isoDate: string): number {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** UTC-Offset einer IANA-Zone zu einem Zeitpunkt in ms. */
function tzOffsetMs(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const p: Record<string, number> = {};
  for (const part of parts) if (part.type !== "literal") p[part.type] = Number(part.value);
  const base = Math.floor(ms / 1000) * 1000;
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second);
  return asUtc - base;
}

/** UTC-Zeitstempel der lokalen Mitternacht des Tages, in dem `now` liegt. */
function localMidnightUtc(now: number, timeZone: string): number {
  const [y, m, d] = localIsoDate(now, timeZone).split("-").map(Number);
  const wallClockAsUtc = Date.UTC(y, m - 1, d);
  // Eine Runde reicht für Zonen ohne DST (UTC, Asia/Singapore, Asia/Shanghai);
  // die zweite korrigiert DST-Zonen.
  let midnight = wallClockAsUtc - tzOffsetMs(wallClockAsUtc, timeZone);
  midnight = wallClockAsUtc - tzOffsetMs(midnight, timeZone);
  return midnight;
}

/**
 * Peak-Phase nach der datengetriebenen Regel (identisch in der Tracker-Familie):
 * 1. Feiertag (Politik `off-peak`, Datum in der Regel-Zone) → Off-Peak.
 * 2. Wochentag in `peak.days` UND UTC-Stunde in einem Fenster → Peak.
 * 3. sonst → Off-Peak.
 * Vor `effectiveFromMs` gilt kein Peak (Vorlaufzeit).
 */
export function isPeakActive(now: number, config: PeakConfig): boolean {
  if (config.effectiveFromMs !== null && now < config.effectiveFromMs) return false;
  const localDate = localIsoDate(now, config.timezone);
  if (config.holidays?.policy === "off-peak") {
    const cal = HOLIDAY_CALENDARS[config.holidays.calendar];
    if (cal && cal.dates.includes(localDate)) return false;
  }
  const day = isoWeekday(localDate);
  if (!config.peak.days.includes(day)) return false;
  return inUtcWindows(now, config.peak.windowsUtc);
}

export function isTierActive(tier: Phase | null, now: number, config: PeakConfig): boolean {
  if (tier !== "peak" && tier !== "off-peak") return true;
  const inPeak = isPeakActive(now, config);
  return tier === "peak" ? inPeak : !inPeak;
}

/**
 * Nächster Phasenwechsel. Kandidaten sind die einzigen Zeitpunkte, an denen der
 * Zustand umspringen kann: UTC-Fenstergrenzen, lokale Mitternacht (Wochentag/
 * Feiertag wechselt) und `effectiveFromMs`.
 */
export function nextTransition(now: number, config: PeakConfig): number | null {
  const candidates = new Set<number>();
  const date = new Date(now);
  const currentUtcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  for (let d = 0; d <= 9; d++) {
    const dayStart = currentUtcMidnight + d * DAY_MS;
    for (const [start, end] of config.peak.windowsUtc) {
      candidates.add(dayStart + start * HOUR_MS);
      candidates.add(dayStart + end * HOUR_MS);
    }
  }
  const localMidnight = localMidnightUtc(now, config.timezone);
  for (let d = 0; d <= 9; d++) candidates.add(localMidnight + d * DAY_MS);
  if (config.effectiveFromMs !== null) candidates.add(config.effectiveFromMs);

  const currentState = isPeakActive(now, config);
  const future = [...candidates].filter((t) => t > now).sort((a, b) => a - b);
  for (const t of future) {
    if (isPeakActive(t, config) !== currentState) return t;
  }
  return null;
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
