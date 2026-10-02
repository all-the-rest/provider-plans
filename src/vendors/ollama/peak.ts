import type { PeakConfig } from "../../types";

export const peak: PeakConfig = {
  timezone: "UTC",
  peak: { days: [1, 2, 3, 4, 5], windowsUtc: [[12, 18]] },
  offPeak: { days: [6, 7], allDay: true },
  phaseFactor: { peak: 1, "off-peak": 0.5 },
  phaseLabel: { peak: "Peak", "off-peak": "Off-Peak" },
  effectiveFromMs: null,
};
