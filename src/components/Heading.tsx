import type { JSX } from "solid-js";

interface HeadingProps {
  anchor: string;
  class?: string;
  children: JSX.Element;
}

export function directHref(id: string): string {
  if (typeof window === "undefined") return "#" + id;
  return window.location.pathname + window.location.search + "#" + id;
}

export function AnchorLink(props: { id: string; label: string }) {
  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    const url = directHref(props.id);
    navigator.clipboard?.writeText(url).catch(() => {});
    window.history.replaceState(null, "", url);
    document.getElementById(props.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <a
      href={directHref(props.id)}
      onClick={onClick}
      aria-label={props.label}
      title="Direktlink kopieren"
      class="select-none p-1 text-base-content/40 transition-colors hover:text-primary focus:text-primary"
    >
      #
    </a>
  );
}

export default function Heading(props: HeadingProps) {
  return (
    <h2 class={props.class ?? "text-lg font-bold tracking-tight"}>
      {props.children}
      <AnchorLink id={props.anchor} label="Direktlink zu diesem Abschnitt (inkl. aller Filter)" />
    </h2>
  );
}
