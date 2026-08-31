import type { JSX } from "solid-js";

export default function Heading(props: { anchor: string; children: JSX.Element }) {
  return (
    <h2 id={props.anchor} class="text-2xl font-semibold scroll-mt-20">
      {props.children}
    </h2>
  );
}