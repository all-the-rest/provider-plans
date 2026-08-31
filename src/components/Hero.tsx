import { createMemo, For } from "solid-js";
import type { Cycle, Lang, Plan, Translation, VendorModule } from "../types";
import { availableCycles } from "../vendors/shared";
import { fmt, fmtBig, fmtDate, fmtInt } from "../util";

export interface HeroProps {
  module: VendorModule;
  plan: Plan;
  cycle: Cycle;
  setCycle: (c: Cycle) => void;
  t: Translation;
  lang: Lang;
  modelCount: number;
}

export default function Hero(props: HeroProps) {
  const { module } = props;

  const price = () => module.formulas.planPriceMonth(props.plan, props.cycle);
  const pool = () => module.formulas.monthlyCredits(props.plan);
  const value = () => module.formulas.planValue(props.plan, props.cycle);

  const valueText = () => {
    const v = value();
    if (v === null || Number.isNaN(v)) return "–";
    const s = v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return `≈ ${s}×`;
  };

  const cycleLabel = () =>
    props.cycle === "monthly"
      ? props.t.cycleMonthly
      : props.cycle === "quarterly"
        ? props.t.cycleQuarterly
        : props.t.cycleYearly;

  const modelLabel = () => (props.lang === "de" ? "Modelle" : "Models");

  const cycles = createMemo<{ value: Cycle; label: string }[]>(() => {
    const labels: Record<Cycle, string> = {
      monthly: props.t.cycleMonthly,
      quarterly: props.t.cycleQuarterly,
      yearly: props.t.cycleYearly,
    };
    return availableCycles(props.plan).map((value) => ({ value, label: labels[value] }));
  });

  return (
    <section>
      <p class="max-w-2xl text-base-content/70">{module.meta.tagline}</p>

      <div class="mt-3 flex flex-wrap items-center gap-3">
        <h1 class="text-2xl font-bold md:text-3xl">{props.plan.name}</h1>
        <span class="badge badge-soft badge-md" data-testid="cycle-badge">
          {cycleLabel()}
        </span>
        <div class="join" role="group" aria-label={props.t.cycleLabel} data-testid="cycle-selector">
          <For each={cycles()}>
            {(c) => (
              <button
                type="button"
                class="btn btn-sm join-item"
                classList={{ "btn-primary btn-active": props.cycle === c.value }}
                aria-pressed={props.cycle === c.value}
                onClick={() => props.setCycle(c.value)}
              >
                {c.label}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="stats stats-vertical mt-4 w-full border border-base-300 bg-base-100 sm:stats-horizontal">
        <div class="stat">
          <div class="stat-title">{props.t.cmpPrice}</div>
          <div class="stat-value text-primary tabular-nums" data-testid="hero-price">
            {fmt(price())}
          </div>
          <div class="stat-desc">{props.t.perMonth}</div>
        </div>
        <div class="stat">
          <div class="stat-title">{props.t.cmpPool}</div>
          <div class="stat-value tabular-nums" data-testid="hero-pool">{fmtBig(pool())}</div>
          <div class="stat-desc">{props.t.perMonth}</div>
        </div>
        <div class="stat">
          <div class="stat-title">{modelLabel()}</div>
          <div class="stat-value tabular-nums">{fmtInt(props.modelCount, props.lang)}</div>
        </div>
        <div class="stat">
          <div class="stat-title">{props.t.cmpValue}</div>
          <div class="stat-value tabular-nums" data-testid="hero-value">
            {valueText()}
          </div>
        </div>
      </div>

      <div class="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-base-content/70">
        <span>
          {props.t.fetchedAt}: <time class="font-medium text-base-content">{fmtDate(module.data.fetchedAt, props.lang)}</time>
        </span>
        <span class="text-base-content/35" aria-hidden="true">
          ·
        </span>
        <a class="link link-hover" href={module.meta.siteUrl} target="_blank" rel="noreferrer">
          {module.meta.name}
        </a>
        {module.data.sourceUrls.map((url) => (
          <a class="link link-hover" href={url} target="_blank" rel="noreferrer">
            {props.t.sourceLink}
          </a>
        ))}
      </div>
    </section>
  );
}