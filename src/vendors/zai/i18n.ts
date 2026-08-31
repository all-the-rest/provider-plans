import { shell } from "../../i18n";
import type { Lang, Translation } from "../../types";

const zaiDe = {
  colInput: "Input",
  colCached: "Cached",
  colOutput: "Output",
  peakWeekendNote: "Sa/So (SGT): ganztägig Off-Peak · Off-Peak = 50 % Credits.",
};

const zaiEn = {
  colInput: "Input",
  colCached: "Cached",
  colOutput: "Output",
  peakWeekendNote: "Sat/Sun (SGT): off-peak all day · off-peak = 50% credits.",
};

export const i18n: Record<Lang, Translation> = {
  de: { ...shell.de, ...zaiDe },
  en: { ...shell.en, ...zaiEn },
};