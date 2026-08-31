import type { PeakConfig } from "../../types";

export const peak: PeakConfig = {
  windows: [[16, 24]],
  phaseFactor: { peak: 1, "off-peak": 0.8 },
  weekendOffPeak: false,
  tzOffsetMin: 480,
  timezoneLabel: "Peking (UTC+8)",
  phaseLabel: { peak: "Tag", "off-peak": "Nacht −20 %" },
  effectiveFromMs: null,
};