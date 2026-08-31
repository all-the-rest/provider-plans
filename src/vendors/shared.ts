import type { CreditField, Cycle, Model, PeakConfig, Plan } from "../types";

/** Verfügbare Abrechnungszyklen eines Plans (nur wenn der Plan sie führt). */
export function availableCycles(plan: Plan): Cycle[] {
  const arr: Cycle[] = ["monthly"];
  if (plan.priceQuarterlyMonthly !== null) arr.push("quarterly");
  if (plan.priceYearlyMonthly !== null) arr.push("yearly");
  return arr;
}

/** Phase-Faktor eines Modell-Tiers (peak = 1.0, off-peak = 0.5/0.8 je Vendor). */
export const phaseFactor = (m: Model, peak: PeakConfig): number =>
  peak.phaseFactor[m.tier ?? "peak"];

/**
 * Monatlicher Credit-Pool eines Plans.
 * - MiMo: `creditsMonthly` direkt.
 * - z.ai: Wochen-Credits × 4 („4 Wochen pro Monat" — User-Entscheidung).
 */
export function monthlyCredits(plan: Plan): number | null {
  if (plan.creditsMonthly !== null) return plan.creditsMonthly;
  if (plan.creditsWeekly !== null) return plan.creditsWeekly * 4;
  return null;
}

/** Tatsächlicher Monatspreis je Abrechnungszyklus (Listenpreis bzw. Rabattpreis). */
export function planPriceMonth(plan: Plan, cycle: Cycle): number | null {
  if (cycle === "quarterly") return plan.priceQuarterlyMonthly;
  if (cycle === "yearly") return plan.priceYearlyMonthly;
  return plan.priceMonthly ?? null;
}

/**
 * Kreditkosten einer Anfrage eines Modells (Basis 1.0 = peak) aus dem
 * Anfragemuster. `costPerToken(field)` liefert Kredits pro Token je Feld.
 * Die Feld-Zuordnung ist vendor-spezifisch:
 * - z.ai: input→input, cached→cached, output→output
 * - MiMo: input→inputMiss (fresh), cached→input (hit), output→output
 */
export function patternCost(
  model: Model,
  costPerToken: (field: CreditField) => number | null
): number | null {
  const p = model.pattern;
  if (!p) return null;
  const input = costPerToken("input");
  const cached = costPerToken("cached");
  const output = costPerToken("output");
  if (input === null || cached === null || output === null) return null;
  return p.input * input + p.cached * cached + p.output * output;
}

/** Kosten der API-Analogie einer Anfrage (pay-as-you-go, USD) — phase-unabhängig. */
export function patternApiCost(
  model: Model,
  apiPerToken: (field: CreditField) => number | null
): number | null {
  const p = model.pattern;
  if (!p) return null;
  const input = apiPerToken("input");
  const cached = apiPerToken("cached");
  const output = apiPerToken("output");
  if (input === null || cached === null || output === null) return null;
  return p.input * input + p.cached * cached + p.output * output;
}

/** USD/Credit für eine Plan-Basis (full/paid); `list` → null (Feld-API-Preis gilt). */
export function usdPerCredit(
  plan: Plan,
  basis: "full" | "paid",
  cycle: Cycle,
  priceOf: (cycle: Cycle) => number | null
): number | null {
  const pool = monthlyCredits(plan);
  const price = basis === "paid" ? priceOf(cycle) : plan.priceMonthly;
  if (pool === null || pool <= 0 || price === null) return null;
  return price / pool;
}

/** USD/1M Tokens eines Feldes auf Basis `basis`. */
export function fieldPriceUsd(
  model: Model,
  field: CreditField,
  basis: "list" | "full" | "paid",
  plan: Plan,
  cycle: Cycle,
  creditOf: (field: CreditField) => number | null,
  apiOf: (field: CreditField) => number | null,
  priceOf: (cycle: Cycle) => number | null
): number | null {
  const cred = creditOf(field);
  const api = apiOf(field);
  if (cred === null || api === null) return null;
  if (basis === "list") return api;
  const ucp = usdPerCredit(plan, basis, cycle, priceOf);
  if (ucp === null) return null;
  return cred * ucp;
}

/** Requests/Monat = Monats-Credit-Pool ÷ (Kreditkosten/Anfrage × Phase-Faktor). */
export function requestsPerMonth(
  plan: Plan,
  model: Model,
  creditsPerRequest: number,
  peak: PeakConfig
): number | null {
  const pool = monthlyCredits(plan);
  if (pool === null || pool <= 0) return null;
  const per = creditsPerRequest * phaseFactor(model, peak);
  if (per <= 0) return null;
  return pool / per;
}