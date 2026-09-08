import type { PeakConfig } from "../../types";

export const peak: PeakConfig = {
  windows: [[12, 18]],
  phaseFactor: { peak: 1, "off-peak": 0.5 },
  weekendOffPeak: true,
  tzOffsetMin: 0,
  timezoneLabel: "UTC",
  phaseLabel: { peak: "Peak", "off-peak": "Off-Peak" },
  effectiveFromMs: null,
};
