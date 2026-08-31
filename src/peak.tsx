import { createSignal, onCleanup, onMount } from "solid-js";
import type { PeakConfig, Phase } from "./types";
import { Tooltip } from "./components/Tooltip";

export const normalizePeakModel = (name: string) => name.toLowerCase().replace(/[\s-]+/g, "");

/** Reine UTC-Stunden-Prüfung gegen die Fenster. */
function inUtcWindows(now: number, ranges: [number, number][]): boolean {
  const date = new Date(now);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  return ranges.some(([start, end]) => hour >= start && hour < end);
}

/** Wochentag in der Vendor-Zeitzone (0 = Sonntag … 6 = Samstag). */
export function vendorDayOfWeek(now: number, tzOffsetMin: number): number {
  return new Date(now + tzOffsetMin * 60_000).getUTCDay();
}

export function isPeakActive(now: number, ranges: [number, number][], config: PeakConfig): boolean {
  if (ranges.length === 0) return false;
  if (config.effectiveFromMs !== null && now < config.effectiveFromMs) return true;
  if (config.weekendOffPeak) {
    const day = vendorDayOfWeek(now, config.tzOffsetMin);
    if (day === 0 || day === 6) return false;
  }
  return inUtcWindows(now, ranges);
}

export function isTierActive(
  tier: Phase | null,
  now: number,
  ranges: [number, number][],
  config: PeakConfig
): boolean {
  if (tier !== "peak" && tier !== "off-peak") return true;
  const inPeak = isPeakActive(now, ranges, config);
  return tier === "peak" ? inPeak : !inPeak;
}

function nextTransition(now: number, ranges: [number, number][], config: PeakConfig): number | null {
  if (ranges.length === 0) return null;
  const date = new Date(now);
  const currentUtcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const DAY_MS = 24 * 60 * 60 * 1000;
  const HOUR_MS = 60 * 60 * 1000;
  // Vendor-Mitternacht in UTC (z. B. UTC+8 → 16:00 UTC = nächster lokaler Tag).
  const localMidnightUtcHour = (24 - config.tzOffsetMin / 60) % 24;

  const candidates: number[] = [];
  for (let d = 0; d <= 8; d++) {
    const dayStart = currentUtcMidnight + d * DAY_MS;
    for (const [start, end] of ranges) {
      candidates.push(dayStart + start * HOUR_MS);
      candidates.push(dayStart + end * HOUR_MS);
    }
    if (config.weekendOffPeak) candidates.push(dayStart + localMidnightUtcHour * HOUR_MS);
  }
  if (config.effectiveFromMs !== null && now < config.effectiveFromMs) {
    candidates.push(config.effectiveFromMs);
  }
  const sorted = candidates.filter((t) => t > now).sort((a, b) => a - b);
  const currentState = isPeakActive(now, ranges, config);
  for (const t of sorted) {
    if (isPeakActive(t, ranges, config) !== currentState) return t;
  }
  return null;
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatUtcRange(ranges: [number, number][]): string {
  return ranges.map(([start, end]) => `${String(start).padStart(2, "0")}:00–${String(end).padStart(2, "0")}:00`).join(", ");
}

function formatLocalRange(ranges: [number, number][], now: number): string {
  const current = new Date(now);
  const formatter = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  return ranges
    .map(([start, end]) => {
      const startDate = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), start));
      const endDate = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), end));
      return `${formatter.format(startDate)}–${formatter.format(endDate)}`;
    })
    .join(", ");
}

export function usePeakClock() {
  const [now, setNow] = createSignal(Date.now());
  onMount(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => window.clearInterval(timer));
  });
  return now;
}

export interface PeakIndicatorProps {
  tier: Phase;
  ranges: [number, number][];
  config: PeakConfig;
  now: number;
  t: Record<string, string>;
}

export function PeakIndicator(props: PeakIndicatorProps) {
  const active = () => isPeakActive(props.now, props.ranges, props.config);
  const transition = () => nextTransition(props.now, props.ranges, props.config);
  const countdown = () => {
    const ts = transition();
    return ts === null ? "–" : formatDuration(ts - props.now);
  };
  const phase = () => (active() ? "peak" : "off-peak");
  const tooltip = () =>
    props.t.peakTooltip
      .replace("{phase}", props.config.phaseLabel[phase()])
      .replace("{utc}", formatUtcRange(props.ranges))
      .replace("{local}", formatLocalRange(props.ranges, props.now))
      .replace("{countdown}", countdown())
      .replace("{weekend}", props.t.peakWeekendNote);

  return (
    <Tooltip tip={tooltip()} class="inline-flex items-center gap-1 leading-none">
      <span class="icon-[material-symbols--schedule] h-4 w-4 shrink-0 self-center -translate-y-px" aria-hidden="true" />
      <span class="leading-none">{props.config.phaseLabel[props.tier]}</span>
      <span class="tabular-nums leading-none text-base-content/70">· {countdown()}</span>
    </Tooltip>
  );
}