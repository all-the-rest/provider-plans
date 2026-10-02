import type { PeakConfig } from "../../types";

export const peak: PeakConfig = {
  timezone: "Asia/Shanghai",
  peak: { days: [1, 2, 3, 4, 5, 6, 7], windowsUtc: [[16, 24]] },
  offPeak: { days: [], allDay: true },
  phaseFactor: { peak: 1, "off-peak": 0.8 },
  phaseLabel: { peak: "Peak", "off-peak": "Off-Peak" },
  effectiveFromMs: null,
};
