import { createSignal, onCleanup, onMount } from "solid-js";
import type { PeakConfig, Phase } from "./types";
import { Tooltip } from "./components/Tooltip";
import { formatDuration, isPeakActive, nextTransition } from "./peakLogic";

export {
  formatDuration,
  isPeakActive,
  isTierActive,
  isoWeekday,
  localIsoDate,
  nextTransition,
  normalizePeakModel,
} from "./peakLogic";

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
  config: PeakConfig;
  now: number;
  t: Record<string, string>;
}

export function PeakIndicator(props: PeakIndicatorProps) {
  const active = () => isPeakActive(props.now, props.config);
  const transition = () => nextTransition(props.now, props.config);
  const countdown = () => {
    const ts = transition();
    return ts === null ? "–" : formatDuration(ts - props.now);
  };
  const phase = () => (active() ? "peak" : "off-peak");
  // Lokale Uhrzeit des nächsten Wechsels (Ende der aktuellen Phase) — nie das
  // Peak-Fenster selbst, wenn gerade off-peak gilt.
  const time = () => {
    const ts = transition();
    if (ts === null) return "–";
    return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));
  };
  const tooltip = () =>
    props.t.peakTooltip
      .replace("{phase}", props.config.phaseLabel[phase()])
      .replace("{time}", time())
      .replace("{countdown}", countdown());

  return (
    <Tooltip tip={tooltip()} class="inline-flex items-center gap-1 whitespace-nowrap leading-none">
      <span class="icon-[material-symbols--schedule] h-4 w-4 shrink-0 self-center -translate-y-px" aria-hidden="true" />
      <span class="leading-none">{props.config.phaseLabel[props.tier]}</span>
      <span class="tabular-nums leading-none text-base-content/70">· {countdown()}</span>
    </Tooltip>
  );
}
