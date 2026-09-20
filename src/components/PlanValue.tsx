import { createMemo } from "solid-js";
import type { Cycle, Lang, Plan, Translation, VendorModule } from "../types";
import { flagshipModel } from "../vendors/shared";
import { fmt, fmtBig, fmtInt } from "../util";
import Heading from "./Heading";

export interface PlanValueProps {
  module: VendorModule;
  plan: Plan;
  cycle: Cycle;
  lang: Lang;
  t: Translation;
}

/** Nutzen-Abschnitt: „Was bringt dir der Plan?" (Requests, Credits, Peak/Off-Peak, Fazit). */
export default function PlanValue(props: PlanValueProps) {
  const de = () => props.lang === "de";
  const model = createMemo(() => flagshipModel(props.module));
  const pool = createMemo(() => props.module.formulas.monthlyCredits(props.plan));
  const price = createMemo(() => props.module.formulas.planPriceMonth(props.plan, props.cycle));
  const req = createMemo(() => {
    const m = model();
    return m ? props.module.formulas.requestsPerMonth(m, props.plan) : null;
  });
  const value = createMemo(() => props.module.formulas.planValue(props.plan, props.cycle));

  const offPeakFactor = () => props.module.peak.phaseFactor["off-peak"];
  const reqOffPeak = () => {
    const r = req();
    const f = offPeakFactor();
    return r !== null && f > 0 ? r / f : null;
  };

  const valueText = () => {
    const v = value();
    if (v === null || Number.isNaN(v)) return "–";
    const s = v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return `≈ ${s}×`;
  };

  const verdict = () => {
    const v = value();
    if (de()) {
      if (v === null || Number.isNaN(v)) return "Der Gegenwert lässt sich für diesen Plan nicht berechnen.";
      return v >= 1
        ? "Der Plan liefert mehr API-Gegenwert als er kostet — er lohnt sich vor allem für Vielnutzer."
        : "Der Gegenwert liegt unter dem Preis — der Plan lohnt sich eher als bequemer Einstieg denn als Schnäppchen.";
    }
    if (v === null || Number.isNaN(v)) return "The value of this plan cannot be calculated.";
    return v >= 1
      ? "The plan delivers more API value than it costs — it pays off especially for heavy users."
      : "The value is below the price — the plan is more a convenient entry point than a bargain.";
  };

  const modelName = () => model()?.name ?? props.module.meta.shortName;

  return (
    <section class="mt-10">
      <Heading anchor="value">{de() ? "Was bringt dir der Plan?" : "What does the plan give you?"}</Heading>

      <div class="stats stats-vertical mt-4 w-full border border-base-300 bg-base-100 sm:stats-horizontal">
        <div class="stat">
          <div class="stat-title">{de() ? "Requests/Monat" : "Requests/month"}</div>
          <div class="stat-value text-primary tabular-nums">{fmtInt(req(), props.lang)}</div>
          <div class="stat-desc">
            {modelName()} · {de() ? "Peak" : "peak"}
          </div>
        </div>
        <div class="stat">
          <div class="stat-title">{de() ? "Requests off-peak" : "Requests off-peak"}</div>
          <div class="stat-value tabular-nums">{fmtInt(reqOffPeak(), props.lang)}</div>
          <div class="stat-desc">
            {Math.round(offPeakFactor() * 100)} % {de() ? "Credits" : "credits"}
          </div>
        </div>
        <div class="stat">
          <div class="stat-title">{de() ? "Credits/Monat" : "Credits/month"}</div>
          <div class="stat-value tabular-nums">{fmtBig(pool())}</div>
          <div class="stat-desc">
            {props.plan.kind === "weekly" ? (de() ? "Wochen-Credits × 4" : "weekly credits × 4") : props.t.cmpUnitMonth}
          </div>
        </div>
        <div class="stat">
          <div class="stat-title">{de() ? "Wert" : "Value"}</div>
          <div class="stat-value tabular-nums">{valueText()}</div>
          <div class="stat-desc">{de() ? "API-Gegenwert" : "API value"}</div>
        </div>
      </div>

      <p class="mt-4 max-w-3xl text-sm leading-relaxed text-base-content/80">
        {de()
          ? `„${props.plan.name}“ kostet ${fmt(price())}/Monat und umfasst ${fmtBig(pool())} Credits — damit sind mit ${modelName()} ca. ${fmtInt(req(), props.lang)} Requests/Monat zu Peak-Zeiten bzw. ca. ${fmtInt(reqOffPeak(), props.lang)} off-peak möglich. ${verdict()}`
          : `“${props.plan.name}” costs ${fmt(price())}/month and includes ${fmtBig(pool())} credits — with ${modelName()} that is about ${fmtInt(req(), props.lang)} requests/month at peak, or about ${fmtInt(reqOffPeak(), props.lang)} off-peak. ${verdict()}`}
      </p>

      <p class="mt-2 max-w-3xl text-xs text-base-content/60">{props.t.peakWeekendNote}</p>
    </section>
  );
}
