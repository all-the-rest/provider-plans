import { For } from "solid-js";
import type { Lang, Translation, VendorModule } from "../types";
import { fmtBig, fmtContextWindow } from "../util";
import Heading from "./Heading";

export interface ModelOverviewProps {
  module: VendorModule;
  lang: Lang;
  t: Translation;
}

/** Modell-Übersicht: alle enthaltenen Modelle mit Anbieter, Tier, Kontext und Credits/1M. */
export default function ModelOverview(props: ModelOverviewProps) {
  const de = () => props.lang === "de";
  return (
    <section class="mt-10">
      <Heading anchor="models">{de() ? "Modell-Übersicht" : "Model overview"}</Heading>

      <div class="card mt-4 overflow-x-auto border border-base-300 bg-base-100">
        <table class="table table-zebra table-sm">
          <caption class="px-3 pb-3 text-left text-xs text-base-content/60 sm:px-4">
            {de()
              ? `Alle in ${props.module.meta.name} enthaltenen Modelle — Tier, Kontextfenster und Credits pro 1M Tokens.`
              : `All models included in ${props.module.meta.name} — tier, context window and credits per 1M tokens.`}
          </caption>
          <thead>
            <tr>
              <th scope="col">{props.t.colModel}</th>
              <th scope="col">{de() ? "Anbieter" : "Provider"}</th>
              <th scope="col">Tier</th>
              <th scope="col" class="text-right">
                {props.t.contextTokens}
              </th>
              <For each={props.module.fields}>
                {(field) => (
                  <th scope="col" class="text-right">
                    {props.t[field.labelKey]}
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={props.module.data.models}>
              {(model) => (
                <tr class="align-top">
                  <td class="font-medium">{model.name}</td>
                  <td>{model.provider ?? "–"}</td>
                  <td>{model.tier !== null ? props.module.peak.phaseLabel[model.tier] : "–"}</td>
                  <td class="text-right tabular-nums">{fmtContextWindow(model.contextWindow)}</td>
                  <For each={props.module.fields}>
                    {(field) => {
                      const cred = model.creditPerM[field.key];
                      return <td class="text-right tabular-nums">{cred !== undefined ? fmtBig(cred) : "–"}</td>;
                    }}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </section>
  );
}
