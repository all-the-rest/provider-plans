import { shell } from "../../i18n";
import type { Lang, Translation } from "../../types";

const ollamaDe = {
  colInput: "Input",
  colCached: "Cached",
  colOutput: "Output",
};

const ollamaEn = {
  colInput: "Input",
  colCached: "Cached",
  colOutput: "Output",
};

export const i18n: Record<Lang, Translation> = {
  de: { ...shell.de, ...ollamaDe },
  en: { ...shell.en, ...ollamaEn },
};
