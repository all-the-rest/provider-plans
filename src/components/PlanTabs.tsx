import { For } from "solid-js";
import type { Plan, Translation } from "../types";

export interface PlanTabsProps {
  plans: Plan[];
  active: string;
  onSelect: (id: string) => void;
  t: Translation;
}

export default function PlanTabs(props: PlanTabsProps) {
  return (
    <div role="tablist" class="tabs tabs-box w-fit" aria-label={props.t.brand}>
      <For each={props.plans}>
        {(plan) => (
          <button
            type="button"
            role="tab"
            class="tab"
            classList={{ "tab-active": plan.id === props.active }}
            aria-selected={plan.id === props.active}
            onClick={() => props.onSelect(plan.id)}
          >
            {plan.name}
          </button>
        )}
      </For>
    </div>
  );
}