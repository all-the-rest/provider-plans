import type { JSX } from "solid-js";

export function Tooltip(props: { tip: string; class?: string; children: JSX.Element }) {
  return (
    <span class={`tooltip tooltip-top ${props.class ?? ""}`} data-tip={props.tip}>
      {props.children}
    </span>
  );
}