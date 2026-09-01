import type { PeakConfig } from "../../types";

export const peak: PeakConfig = {
  windows: [],
  phaseFactor: { peak: 1, "off-peak": 1 },
  weekendOffPeak: false,
  tzOffsetMin: 0,
  timezoneLabel: "UTC",
  phaseLabel: { peak: "Peak", "off-peak": "Off-Peak" },
  effectiveFromMs: null,
};
