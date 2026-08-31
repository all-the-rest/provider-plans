import { For } from "solid-js";
import { isTierActive, PeakIndicator, usePeakClock } from "../peak";
import { fmt, fmtInt, fmtTokens } from "../util";
import Heading from "./Heading";
import { Tooltip } from "./Tooltip";
import type { Basis, Cycle, Lang, Model, Plan, Translation, VendorModule } from "../types";

export interface PriceTableProps {
  module: VendorModule;
  plan: Plan;
  basis: Basis;
  setBasis: (b: Basis) => void;
  cycle: Cycle;
  t: Translation;
  lang: Lang;
}

export default function PriceTable(props: PriceTableProps) {
  const now = usePeakClock();
  const { module } = props;

  const basisLabel = () =>
    props.basis === "list"
      ? props.t.basisList
      : props.basis === "full"
        ? props.t.basisFull
        : props.t.basisPaid;

  const basisDesc = () =>
    props.basis === "list"
      ? (props.t.basisListDesc ?? "")
      : props.basis === "full"
        ? (props.t.basisFullDesc ?? "")
        : (props.t.basisPaidDesc ?? "");

  const poolDesc = () =>
    props.plan.kind === "weekly"
      ? props.lang === "de"
        ? "Wochen-Credits × 4"
        : "weekly credits × 4"
      : props.lang === "de"
        ? "Monats-Credits"
        : "monthly credits";

  /** Phase-Notiz für tier-Rows, z. B. „Off-Peak = 50 % Credits." — sonst leer. */
  const phaseNote = (model: Model): string => {
    if (model.tier === null) return "";
    const pct = Math.round(module.peak.phaseFactor[model.tier] * 100);
    const name = module.peak.phaseLabel[model.tier];
    return props.lang === "de" ? `${name} = ${pct} % Credits.` : `${name} = ${pct}% credits.`;
  };

  const costTooltip = (model: Model) =>
    props.t.costTooltip
      .replace("{basis}", basisLabel())
      .replace("{basisDesc}", basisDesc())
      .replace("{phaseDesc}", phaseNote(model));

  const requestsTooltip = (model: Model) =>
    props.t.requestsTooltip
      .replace("{poolDesc}", poolDesc())
      .replace("{phaseDesc}", phaseNote(model));

  const patternTooltip = (model: Model) => {
    const p = model.pattern;
    if (!p) return props.t.patternTooltip;
    return props.t.patternTooltip
      .replace("{input}", fmtTokens(p.input, props.lang))
      .replace("{cached}", fmtTokens(p.cached, props.lang))
      .replace("{output}", fmtTokens(p.output, props.lang));
  };

  return (
    <section>
      <Heading anchor="prices">{props.t.headingPrices}</Heading>

      <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs uppercase tracking-wide text-base-content/60">{props.t.basisLabel}</span>
          <div class="join" role="group" aria-label={props.t.basisLabel}>
            <button
              type="button"
              class="btn btn-sm join-item"
              classList={{ "btn-primary btn-active": props.basis === "list" }}
              aria-pressed={props.basis === "list"}
              onClick={() => props.setBasis("list")}
            >
              {props.t.basisList}
            </button>
            <button
              type="button"
              class="btn btn-sm join-item"
              classList={{ "btn-primary btn-active": props.basis === "full" }}
              aria-pressed={props.basis === "full"}
              onClick={() => props.setBasis("full")}
            >
              {props.t.basisFull}
            </button>
            <button
              type="button"
              class="btn btn-sm join-item"
              classList={{ "btn-primary btn-active": props.basis === "paid" }}
              aria-pressed={props.basis === "paid"}
              onClick={() => props.setBasis("paid")}
            >
              {props.t.basisPaid}
            </button>
          </div>
        </div>
      </div>

      <div class="card mt-4 overflow-x-auto border border-base-300 bg-base-100">
        <table class="table table-zebra table-sm table-pin-rows">
          <thead>
            <tr>
              <th>{props.t.colModel}</th>
              <For each={module.fields}>
                {(field) => (
                  <th class="text-right">
                    <div>{props.t[field.labelKey]}</div>
                    <div class="text-xs font-normal text-base-content/60">{props.t.per1m}</div>
                  </th>
                )}
              </For>
              <th class="text-right">{props.t.colCost}</th>
              <th class="text-right">{props.t.colRequests}</th>
            </tr>
          </thead>
          <tbody>
            <For each={module.data.models}>
              {(model) => {
                const inactive = model.tier !== null && !isTierActive(model.tier, now(), module.peak.windows, module.peak);
                const hasPattern = model.pattern !== null;
                return (
                  <tr class="align-top" classList={{ "opacity-50": inactive }}>
                    <td>
                      <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {hasPattern ? (
                          <Tooltip tip={patternTooltip(model)} class="inline-flex items-center">
                            <span class="font-medium">{model.name}</span>
                          </Tooltip>
                        ) : (
                          <span class="font-medium">{model.name}</span>
                        )}
                        {model.contextWindow !== null && (
                          <span class="text-xs tabular-nums text-base-content/50">
                            {fmtInt(model.contextWindow, props.lang)} {props.t.contextTokens}
                          </span>
                        )}
                      </div>
                      {model.note !== null && (
                        <div class="mt-0.5">
                          <span class="badge badge-outline badge-sm">{model.note}</span>
                        </div>
                      )}
                      {model.tier !== null && (
                        <div class="mt-1">
                          <PeakIndicator
                            tier={model.tier}
                            ranges={module.peak.windows}
                            config={module.peak}
                            now={now()}
                            t={props.t}
                          />
                        </div>
                      )}
                    </td>
                    <For each={module.fields}>
                      {(field) => {
                        const v = module.formulas.fieldPriceUsd(model, field.key, props.basis, props.plan, props.cycle);
                        return <td class="text-right tabular-nums">{fmt(v)}</td>;
                      }}
                    </For>
                    <td class="text-right tabular-nums">
                      <Tooltip tip={costTooltip(model)} class="inline-flex">
                        <span>{fmt(module.formulas.requestCostUsd(model, props.basis, props.plan, props.cycle))}</span>
                      </Tooltip>
                    </td>
                    <td class="text-right tabular-nums">
                      {hasPattern ? (
                        <Tooltip tip={requestsTooltip(model)} class="inline-flex">
                          <span>
                            {fmtInt(module.formulas.requestsPerMonth(model, props.basis, props.plan, props.cycle), props.lang)}
                          </span>
                        </Tooltip>
                      ) : (
                        <span>–</span>
                      )}
                    </td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </div>
    </section>
  );
}