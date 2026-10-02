import { shell } from "../../i18n";
import type { Lang, Translation } from "../../types";

const zaiDe = {
  colInput: "Input",
  colCached: "Cached",
  colOutput: "Output",
};

const zaiEn = {
  colInput: "Input",
  colCached: "Cached",
  colOutput: "Output",
};

export const i18n: Record<Lang, Translation> = {
  de: { ...shell.de, ...zaiDe },
  en: { ...shell.en, ...zaiEn },
};
