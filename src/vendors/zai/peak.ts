import type { PeakConfig } from "../../types";

export const peak: PeakConfig = {
  windows: [[6, 10]],
  phaseFactor: { peak: 1, "off-peak": 0.5 },
  weekendOffPeak: true,
  tzOffsetMin: 480,
  timezoneLabel: "SGT (UTC+8)",
  phaseLabel: { peak: "Peak", "off-peak": "Off-Peak" },
  effectiveFromMs: Date.parse("2026-07-30T00:00:00+08:00"),
};