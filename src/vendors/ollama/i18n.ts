import { shell } from "../../i18n";
import type { Lang, Translation } from "../../types";

const ollamaDe = {
  colInput: "Input",
  colCached: "Cached",
  colOutput: "Output",
  peakWeekendNote: "",
};

const ollamaEn = {
  colInput: "Input",
  colCached: "Cached",
  colOutput: "Output",
  peakWeekendNote: "",
};

export const i18n: Record<Lang, Translation> = {
  de: { ...shell.de, ...ollamaDe },
  en: { ...shell.en, ...ollamaEn },
};
