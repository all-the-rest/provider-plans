import type { PeakConfig } from "../../types";

export const peak: PeakConfig = {
  timezone: "Asia/Singapore",
  peak: { days: [1, 2, 3, 4, 5], windowsUtc: [[6, 10]] },
  offPeak: { days: [6, 7], allDay: true },
  // Kein `holidays`: Die permanente z.ai-Peak-Regel (tests/fixtures/zai/overview.md:30,
  // live docs.z.ai/devpack/overview.md) nennt nur „Monday to Friday, 14:00–18:00 SGT" —
  // Feiertage stehen ausschließlich im temporären Kampagnen-Hinweis
  // (docs.z.ai/devpack/notice/event-glm-5.3-flash.md, 03.09.–07.10.2026), nicht in der
  // Peak-Regel. Nichts aus einer Kampagne heraus erfinden (analog ocgo/cc: quellenbindend).
  phaseFactor: { peak: 1, "off-peak": 0.5 },
  phaseLabel: { peak: "Peak", "off-peak": "Off-Peak" },
  effectiveFromMs: Date.parse("2026-07-30T00:00:00+08:00"),
};
