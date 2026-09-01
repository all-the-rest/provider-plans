import type { VendorModule, VendorPriceData } from "../../types";
import dataJson from "./data/latest.json";
import { makeFormulas } from "./formulas";
import { i18n } from "./i18n";
import { peak } from "./peak";

const data = dataJson as unknown as VendorPriceData;

export const vendorModule: VendorModule = {
  meta: {
    id: "ollama",
    path: "/ollama",
    name: "Ollama — Pro & Max",
    shortName: "Ollama",
    tagline: "USD-basierter Usage-Credit-Plan — Pro $60 / Max $300 Credits pro Monat, keine Peak-Zeiten.",
    siteUrl: "https://ollama.com",
    priceSourceUrl: "https://ollama.com/pricing",
    flagshipId: "glm-5.3",
  },
  data,
  formulas: makeFormulas(data, peak, "glm-5.3"),
  fields: [
    { key: "input", labelKey: "colInput" },
    { key: "cached", labelKey: "colCached" },
    { key: "output", labelKey: "colOutput" },
  ],
  peak,
  i18n,
};
