import { For, createMemo, createSignal } from "solid-js";
import { isTierActive, PeakIndicator, usePeakClock } from "../peak";
import { fmt, fmtBig, fmtContextWindow, fmtCredits, fmtInt, fmtTokens } from "../util";
import Heading from "./Heading";
import { Tooltip } from "./Tooltip";
import type { Basis, CreditField, Cycle, Lang, Model, Plan, Translation, VendorModule } from "../types";

type SortKey = "name" | "cost" | "requests" | CreditField;
type SortDir = "asc" | "desc";

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

  const [sortKey, setSortKey] = createSignal<SortKey>("requests");
  const [sortDir, setSortDir] = createSignal<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey() === key) {
      setSortDir(sortDir() === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const sortedModels = createMemo(() => {
    const models = [...module.data.models];
    const key = sortKey();
    const dir = sortDir() === "asc" ? 1 : -1;

    const getValue = (m: Model): number | null => {
      switch (key) {
        case "name":
          return null;
        case "cost":
          return props.basis === "list"
            ? module.formulas.requestCostUsd(m, props.plan, props.cycle)
            : module.formulas.creditsPerRequest(m);
        case "requests":
          return module.formulas.requestsPerMonth(m, props.plan);
        default:
          return m.creditPerM[key] ?? null;
      }
    };

    models.sort((a, b) => {
      if (key === "name") {
        return dir * a.name.localeCompare(b.name);
      }
      const va = getValue(a);
      const vb = getValue(b);
      // nulls always last
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return dir * (va - vb);
    });

    return models;
  });

  const basisLabel = () => (props.basis === "list" ? props.t.basisList : props.t.basisFull);

  const basisDesc = () =>
    props.basis === "list" ? (props.t.basisListDesc ?? "") : (props.t.basisFullDesc ?? "");

  const basisHelp = () =>
    props.lang === "de"
      ? "Umschalter USD / Credits. USD: Monatspreis ÷ Monats-Credits = $-Wert je Credit; Felder und Kosten = Credits × $/Credit (echte Plan-Preise, keine API-Listenpreise). Credits: Kosten in Credits — Credits/1M je Modell-Feld, Kosten/Anfrage = Anfragemuster × Credit-Kosten, Requests/Monat = Monats-Credit-Pool ÷ Kosten/Anfrage."
      : "Toggle USD / credits. USD: monthly price ÷ monthly credits = $ value per credit; fields and costs = credits × $/credit (real plan prices, no API list prices). Credits: costs in credits — credits/1M per model field, cost/request = request pattern × credit cost, requests/month = monthly credit pool ÷ cost per request.";

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

  const costTooltip = (model: Model) => {
    if (props.basis === "list") {
      return props.t.costTooltip
        .replace("{basis}", basisLabel())
        .replace("{basisDesc}", basisDesc())
        .replace("{phaseDesc}", phaseNote(model));
    }
    return props.lang === "de"
      ? `Kosten/Anfrage in Credits = Anfragemuster × Credit-Kosten der Felder. ${phaseNote(model)}`
      : `Cost per request in credits = request pattern × field credit costs. ${phaseNote(model)}`;
  };

  const requestsTooltip = (model: Model) =>
    props.t.requestsTooltip
      .replace("{poolDesc}", poolDesc())
      .replace("{phaseDesc}", phaseNote(model));

  const SortHeader = (props2: {
    sortKey: SortKey;
    label: string;
    align?: string;
    sub?: string;
  }) => {
    const active = () => sortKey() === props2.sortKey;
    return (
      <th
        class="cursor-pointer select-none"
        classList={{ "text-right": props2.align !== "left" }}
        onClick={() => toggleSort(props2.sortKey)}
        aria-sort={active() ? (sortDir() === "asc" ? "ascending" : "descending") : "none"}
      >
        <div class="inline-flex items-center gap-0.5">
          <span>{props2.label}</span>
          <svg
            class="h-3 w-3 transition-opacity"
            classList={{ "opacity-100": active(), "opacity-30": !active() }}
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            {active() && sortDir() === "desc" ? (
              <path d="M6 2l4 6H2z" />
            ) : active() && sortDir() === "asc" ? (
              <path d="M6 10L2 4h8z" />
            ) : (
              <>
                <path d="M6 2l3 4H3z" class="opacity-30" />
                <path d="M6 10l-3-4h6z" class="opacity-30" />
              </>
            )}
          </svg>
        </div>
        {props2.sub && (
          <div class="text-xs font-normal text-base-content/60">{props2.sub}</div>
        )}
      </th>
    );
  };

  const patternTooltip = (model: Model) => {
    const p = model.pattern;
    if (!p) return props.t.patternTooltip;
    return props.t.patternTooltip
      .replace("{input}", fmtTokens(p.input, props.lang))
      .replace("{cached}", fmtTokens(p.cached, props.lang))
      .replace("{output}", fmtTokens(p.output, props.lang));
  };

  /** Feldzelle: $/1M (list) bzw. Credits/1M (full, phasenabhängig). */
  const fieldCell = (model: Model, field: (typeof module.fields)[number]): string => {
    if (props.basis === "list") {
      return fmt(module.formulas.fieldPriceUsd(model, field.key, props.plan, props.cycle));
    }
    const cred = model.creditPerM[field.key];
    if (cred === undefined) return "–";
    return fmtBig(cred * module.peak.phaseFactor[model.tier ?? "peak"]);
  };

  /** Kosten/Anfrage: $ (list) bzw. Credits (full, phasenabhängig). */
  const costCell = (model: Model): string => {
    if (props.basis === "list") {
      return fmt(module.formulas.requestCostUsd(model, props.plan, props.cycle));
    }
    const cpr = module.formulas.creditsPerRequest(model);
    if (cpr === null) return "–";
    return fmtCredits(cpr * module.peak.phaseFactor[model.tier ?? "peak"]);
  };

  return (
    <section>
      <Heading anchor="prices">{props.t.headingPrices}</Heading>

      <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-base-content/60">
            {props.t.basisLabel}
            <Tooltip tip={basisHelp()} class="inline-flex">
              <svg
                class="h-3.5 w-3.5 text-base-content/50"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </Tooltip>
          </span>
          <div class="join" role="group" aria-label={props.t.basisLabel} data-testid="basis-selector">
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
          </div>
        </div>
      </div>

      <p class="mt-1 max-w-3xl text-xs text-base-content/60" data-testid="basis-desc">
        {basisDesc()}
      </p>

      <div class="card mt-4 overflow-x-auto border border-base-300 bg-base-100">
        <table class="table table-zebra table-sm table-pin-rows">
          <thead>
            <tr>
              <SortHeader sortKey="name" label={props.t.colModel} align="left" />
              <For each={module.fields}>
                {(field) => (
                  <SortHeader
                    sortKey={field.key}
                    label={props.t[field.labelKey]}
                    sub={props.basis === "list" ? props.t.per1m : props.t.per1mCredits}
                  />
                )}
              </For>
              <SortHeader sortKey="cost" label={props.basis === "list" ? props.t.colCost : props.t.colCostCredits} />
              <SortHeader sortKey="requests" label={props.t.colRequests} />
            </tr>
          </thead>
          <tbody>
            <For each={sortedModels()}>
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
                        {(model.provider !== null || model.contextWindow !== null) && (
                          <span class="text-xs tabular-nums text-base-content/50">
                            {[
                              model.provider,
                              model.contextWindow !== null
                                ? `${fmtContextWindow(model.contextWindow)} ${props.t.contextTokens}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </div>
                      {model.note !== null && (
                        <div class="mt-1 max-w-full">
                          <span class="badge badge-outline badge-sm whitespace-normal break-words text-left">{model.note}</span>
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
                      {(field) => <td class="text-right tabular-nums">{fieldCell(model, field)}</td>}
                    </For>
                    <td class="text-right tabular-nums">
                      <Tooltip tip={costTooltip(model)} class="inline-flex">
                        <span>{costCell(model)}</span>
                      </Tooltip>
                    </td>
                    <td class="text-right tabular-nums">
                      {hasPattern ? (
                        <Tooltip tip={requestsTooltip(model)} class="inline-flex">
                          <span>
                            {fmtInt(module.formulas.requestsPerMonth(model, props.plan), props.lang)}
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