import type { VendorModule, VendorPriceData } from "../../types";
import dataJson from "./data/latest.json";
import { makeFormulas } from "./formulas";
import { i18n } from "./i18n";
import { peak } from "./peak";

const data = dataJson as unknown as VendorPriceData;

export const vendorModule: VendorModule = {
  meta: {
    id: "zai",
    path: "/z-ai",
    name: "z.ai — GLM Coding Plan",
    shortName: "z.ai",
    tagline:
      "Credit-basierter Coding-Plan für GLM-5.3 & GLM-5.3-Flash — Credits pro Woche, Off-Peak −50 %.",
    siteUrl: "https://z.ai",
    priceSourceUrl: "https://z.ai/subscribe",
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