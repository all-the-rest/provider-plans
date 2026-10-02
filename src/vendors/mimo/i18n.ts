import { shell } from "../../i18n";
import type { Lang, Translation } from "../../types";

const mimoDe = {
  colInputHit: "Input (Cache-Hit)",
  colInputMiss: "Input (Cache-Miss)",
  colOutput: "Output",
  cycleQuarterly: "Quartal",
  cycleYearly: "Jährlich (−12 %)",
};

const mimoEn = {
  colInputHit: "Input (cache hit)",
  colInputMiss: "Input (cache miss)",
  colOutput: "Output",
  cycleQuarterly: "Quarterly",
  cycleYearly: "Yearly (−12%)",
};

export const i18n: Record<Lang, Translation> = {
  de: { ...shell.de, ...mimoDe },
  en: { ...shell.en, ...mimoEn },
};
