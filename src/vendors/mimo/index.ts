import type { VendorModule, VendorPriceData } from "../../types";
import dataJson from "./data/latest.json";
import { makeFormulas } from "./formulas";
import { i18n } from "./i18n";
import { peak } from "./peak";

const data = dataJson as unknown as VendorPriceData;

export const vendorModule: VendorModule = {
  meta: {
    id: "mimo",
    path: "/mimo",
    name: "Xiaomi MiMo — Token Plan",
    shortName: "MiMo",
    tagline:
      "Credit-basierter Token Plan für mimo-v2.5 & mimo-v2.5-pro — monatliche Credits, Nacht-Rabatt −20 %.",
    siteUrl: "https://mimo.mi.com",
    priceSourceUrl: "https://mimo.mi.com/docs/en-US/price/token-plan",
    flagshipId: "mimo-v2.5-pro",
  },
  data,
  formulas: makeFormulas(data, peak, "mimo-v2.5-pro"),
  fields: [
    { key: "input", labelKey: "colInputHit" },
    { key: "inputMiss", labelKey: "colInputMiss" },
    { key: "output", labelKey: "colOutput" },
  ],
  peak,
  i18n,
};