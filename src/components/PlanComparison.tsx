import { createMemo, For } from "solid-js";
import type { Lang, Plan, Translation, VendorModule } from "../types";
import { fmt, fmtBig, fmtInt } from "../util";
import Heading from "./Heading";

export interface PlanComparisonProps {
  module: VendorModule;
  t: Translation;
  lang: Lang;
}

type RowDef = { label: string; value: (plan: Plan) => string };

export default function PlanComparison(props: PlanComparisonProps) {
  const { module } = props;

  const flagship = () =>
    module.data.models.find((m) => m.id.startsWith(module.meta.flagshipId) && m.tier === "peak") ?? null;

  const discountPct = (cyclePrice: number | null, monthly: number): number | null => {
    if (cyclePrice === null || monthly <= 0) return null;
    return Math.round((1 - cyclePrice / monthly) * 100);
  };

  const bonusText = (plan: Plan): string => {
    if (plan.notes) return plan.notes;
    const q = discountPct(plan.priceQuarterlyMonthly, plan.priceMonthly);
    const y = discountPct(plan.priceYearlyMonthly, plan.priceMonthly);
    const parts: string[] = [];
    if (q !== null) parts.push(`${props.t.cycleQuarterly} −${q} %`);
    if (y !== null) parts.push(`${props.t.cycleYearly} −${y} %`);
    return parts.length ? parts.join(" · ") : "–";
  };

  const poolText = (plan: Plan): string => {
    const p = module.formulas.monthlyCredits(plan);
    if (p === null || Number.isNaN(p)) return "–";
    if (plan.kind === "weekly") return `${fmtBig(p / 4)} ${props.t.cmpUnitWeek}`;
    return `${fmtBig(p)} ${props.t.cmpUnitMonth}`;
  };

  const limitsText = (plan: Plan): string => {
    const parts: string[] = [];
    if (plan.credits5h !== null) parts.push(`${props.t.cmpLimit5h}: ${fmtBig(plan.credits5h)}`);
    if (plan.creditsWeekly !== null) parts.push(`${props.t.cmpLimitWeekly}: ${fmtBig(plan.creditsWeekly)}`);
    if (plan.creditsMonthly !== null) parts.push(`${props.t.cmpLimitMonthly}: ${fmtBig(plan.creditsMonthly)}`);
    return parts.length ? parts.join(" · ") : "–";
  };

  const requestsText = (plan: Plan): string => {
    const f = flagship();
    if (!f?.pattern) return "–";
    return fmtInt(module.formulas.requestsPerMonth(f, plan), props.lang);
  };

  const valueText = (plan: Plan): string => {
    const v = module.formulas.planValue(plan, "monthly");
    if (v === null || Number.isNaN(v)) return "–";
    const s = v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return `≈ ${s}×`;
  };

  const rows = createMemo<RowDef[]>(() => {
    const r: RowDef[] = [{ label: props.t.cmpPrice, value: (p) => fmt(p.priceMonthly) }];
    if (module.data.plans.some((p) => p.priceQuarterlyMonthly !== null)) {
      r.push({ label: props.t.cycleQuarterly, value: (p) => fmt(p.priceQuarterlyMonthly) });
    }
    if (module.data.plans.some((p) => p.priceYearlyMonthly !== null)) {
      r.push({ label: props.t.cycleYearly, value: (p) => fmt(p.priceYearlyMonthly) });
    }
    r.push(
      { label: props.t.cmpPool, value: poolText },
      { label: props.t.cmpLimits, value: limitsText },
      { label: props.t.cmpBonus, value: bonusText },
      { label: props.t.cmpRequests, value: requestsText },
      { label: props.t.cmpValue, value: valueText }
    );
    return r;
  });

  const footnote =
    props.lang === "de"
      ? "≈ Requests/Monat: Flaggschiff-Modell im Credit-Pool bei monatlicher Abrechnung."
      : "≈ Requests/mo: flagship model on the credit pool at monthly billing.";

  return (
    <section>
      <Heading anchor="comparison">{props.t.headingComparison}</Heading>

      <div class="card mt-4 overflow-x-auto border border-base-300 bg-base-100">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>{props.t.cmpColumn}</th>
              <For each={module.data.plans}>
                {(plan) => <th class="text-right">{plan.name}</th>}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(row) => (
                <tr>
                  <td class="text-base-content/80">{row.label}</td>
                  <For each={module.data.plans}>
                    {(plan) => <td class="text-right tabular-nums">{row.value(plan)}</td>}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
          <caption class="px-3 pb-3 text-left text-xs text-base-content/60 sm:px-4">{footnote}</caption>
        </table>
      </div>
    </section>
  );
}