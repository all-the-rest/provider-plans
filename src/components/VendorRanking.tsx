import { For } from "solid-js";
import type { Lang, Translation, VendorModule } from "../types";
import { flagshipModel } from "../vendors/shared";
import { fmt, fmtBig, fmtInt } from "../util";
import Heading from "./Heading";
import { withLangPrefix } from "../routes";

export interface VendorRankingProps {
  vendors: VendorModule[];
  lang: Lang;
  t: Translation;
}

interface Row {
  module: VendorModule;
  price: number | null;
  pool: number | null;
  requests: number | null;
  value: number | null;
}

/** Startseiten-Ranking: Vendors nach Wert (API-Gegenwert ÷ Preis) sortiert. */
export default function VendorRanking(props: VendorRankingProps) {
  const de = () => props.lang === "de";

  const rows = (): Row[] =>
    props.vendors
      .map((module) => {
        const plan = module.data.plans[0];
        const model = flagshipModel(module);
        return {
          module,
          price: plan ? plan.priceMonthly : null,
          pool: plan ? module.formulas.monthlyCredits(plan) : null,
          requests: plan && model ? module.formulas.requestsPerMonth(model, plan) : null,
          value: plan ? module.formulas.planValue(plan, "monthly") : null,
        };
      })
      .sort((a, b) => {
        if (a.value === null && b.value === null) return 0;
        if (a.value === null) return 1;
        if (b.value === null) return -1;
        return b.value - a.value;
      });

  const valueText = (v: number | null) => {
    if (v === null || Number.isNaN(v)) return "–";
    const s = v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return `≈ ${s}×`;
  };

  return (
    <section class="mt-12">
      <Heading anchor="ranking">{de() ? "Vendor-Vergleich" : "Vendor comparison"}</Heading>

      <div class="card mt-4 overflow-x-auto border border-base-300 bg-base-100">
        <table class="table table-zebra table-sm">
          <caption class="px-3 pb-3 text-left text-xs text-base-content/60 sm:px-4">
            {de()
              ? "Einstiegsplan je Anbieter, sortiert nach Wert (API-Gegenwert des Credit-Pools ÷ Monatspreis)."
              : "Entry plan per provider, sorted by value (API value of the credit pool ÷ monthly price)."}
          </caption>
          <thead>
            <tr>
              <th scope="col">{de() ? "Anbieter" : "Provider"}</th>
              <th scope="col">{de() ? "Ab Preis" : "From"}</th>
              <th scope="col" class="text-right">
                {de() ? "Credits/Monat" : "Credits/month"}
              </th>
              <th scope="col" class="text-right">
                {props.t.cmpRequests}
              </th>
              <th scope="col" class="text-right">
                {de() ? "Wert" : "Value"}
              </th>
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(row) => (
                <tr>
                  <th scope="row" class="font-medium">
                    <a class="link link-hover" href={withLangPrefix(row.module.meta.path, props.lang)}>
                      {row.module.meta.name}
                    </a>
                  </th>
                  <td class="tabular-nums">{fmt(row.price)}</td>
                  <td class="text-right tabular-nums">{fmtBig(row.pool)}</td>
                  <td class="text-right tabular-nums">{fmtInt(row.requests, props.lang)}</td>
                  <td class="text-right tabular-nums">{valueText(row.value)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </section>
  );
}
