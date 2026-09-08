import { shell } from "../../i18n";
import type { Lang, Translation } from "../../types";

const ollamaDe = {
  colInput: "Input",
  colCached: "Cached",
  colOutput: "Output",
  peakWeekendNote: "Mo–Fr 12–18 UTC Peak · sonst Off-Peak (50 %) · Sa/So durchgehend Off-Peak",
};

const ollamaEn = {
  colInput: "Input",
  colCached: "Cached",
  colOutput: "Output",
  peakWeekendNote: "Mon–Fri 12–18 UTC Peak · otherwise Off-Peak (50 %) · Sat/Sun Off-Peak all day",
};

export const i18n: Record<Lang, Translation> = {
  de: { ...shell.de, ...ollamaDe },
  en: { ...shell.en, ...ollamaEn },
};
