import type {
  Basis,
  CreditField,
  Cycle,
  Formulas,
  Model,
  PeakConfig,
  Plan,
  VendorPriceData,
} from "../../types";
import {
  fieldPriceUsd as sharedFieldPriceUsd,
  monthlyCredits as sharedMonthlyCredits,
  patternApiCost,
  patternCost,
  phaseFactor,
  planPriceMonth as sharedPlanPriceMonth,
  requestsPerMonth as sharedRequestsPerMonth,
  usdPerCredit,
} from "../shared";

/** z.ai: Pattern-Input→input, Cached→cached, Output→output (Identitäts-Mapping). */
export function makeFormulas(data: VendorPriceData, peak: PeakConfig, flagshipId: string): Formulas {
  const monthlyCredits = (plan: Plan): number | null => sharedMonthlyCredits(plan);
  const planPriceMonth = (plan: Plan, cycle: Cycle): number | null => sharedPlanPriceMonth(plan, cycle);

  const creditPerToken = (m: Model) => (f: CreditField): number | null => {
    const v = m.creditPerM[f];
    return v !== undefined ? v / 1e6 : null;
  };
  const apiPerToken = (m: Model) => (f: CreditField): number | null => {
    const v = m.apiPrice[f];
    return v !== undefined ? v / 1e6 : null;
  };

  const creditsPerRequest = (m: Model): number | null => patternCost(m, creditPerToken(m));

  const requestCostUsd = (m: Model, plan: Plan): number | null => {
    if (!m.pattern) return null;
    const cpr = patternCost(m, creditPerToken(m));
    const ucp = usdPerCredit(plan);
    if (cpr === null || ucp === null) return null;
    return cpr * phaseFactor(m, peak) * ucp;
  };

  const requestsPerMonth = (m: Model, plan: Plan): number | null => {
    const cpr = patternCost(m, creditPerToken(m));
    if (cpr === null) return null;
    return sharedRequestsPerMonth(plan, m, cpr, peak);
  };

  const planValue = (plan: Plan, cycle: Cycle): number | null => {
    const flagship = data.models.find((mm) => mm.id === flagshipId && mm.tier === "peak");
    if (!flagship || !flagship.pattern) return null;
    const apiCost = patternApiCost(flagship, apiPerToken(flagship));
    const cpr = patternCost(flagship, creditPerToken(flagship));
    const pool = monthlyCredits(plan);
    const price = planPriceMonth(plan, cycle);
    if (apiCost === null || cpr === null || pool === null || pool <= 0 || price === null || price <= 0)
      return null;
    return (pool / (cpr * phaseFactor(flagship, peak))) * (apiCost / price);
  };

  const fieldPriceUsd = (m: Model, field: CreditField, plan: Plan): number | null =>
    sharedFieldPriceUsd(m, field, plan, peak, (f) => m.creditPerM[f] ?? null);

  return {
    monthlyCredits,
    planPriceMonth,
    creditsPerRequest,
    requestCostUsd,
    requestsPerMonth,
    planValue,
    fieldPriceUsd,
  };
}