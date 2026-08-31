import { For } from "solid-js";
import type { Lang, Translation } from "../types";

export interface HeaderProps {
  lang: Lang;
  setLang: (l: Lang) => void;
  dark: boolean;
  setDark: (d: boolean) => void;
  /** Aktueller Pfad, z. B. "/z-ai" — für die aktive Navigation. */
  path: () => string;
  /** Navigations-Links je Vendor. */
  vendors: { path: string; name: string }[];
  t: Translation;
}

export default function Header(props: HeaderProps) {
  const isActive = (href: string) => {
    const p = props.path();
    return href === "/" ? p === "/" : p === href;
  };

  return (
    <header class="sticky top-0 z-40">
      <div class="navbar gap-2 border-b border-base-300 bg-base-200 px-3 md:px-6">
        <div class="navbar-start gap-1">
          <a
            href="/"
            class="btn btn-ghost px-2 text-lg font-bold"
            classList={{ "btn-active": isActive("/") }}
            aria-current={isActive("/") ? "page" : undefined}
          >
            {props.t.brand}
          </a>
          <div role="navigation" aria-label={props.t.brand} class="tabs tabs-sm hidden overflow-x-auto whitespace-nowrap md:flex">
            <For each={props.vendors}>
              {(v) => (
                <a
                  role="tab"
                  href={v.path}
                  class="tab"
                  classList={{ "tab-active": isActive(v.path) }}
                  aria-current={isActive(v.path) ? "page" : undefined}
                >
                  {v.name}
                </a>
              )}
            </For>
          </div>
        </div>

        <div class="navbar-end gap-2">
          <div class="join" role="group" aria-label={props.t.langDe}>
            <button
              type="button"
              class="btn btn-sm join-item"
              classList={{ "btn-primary btn-active": props.lang === "de", "btn-ghost": props.lang !== "de" }}
              title={props.t.langDe}
              aria-pressed={props.lang === "de"}
              onClick={() => props.setLang("de")}
            >
              DE
            </button>
            <button
              type="button"
              class="btn btn-sm join-item"
              classList={{ "btn-primary btn-active": props.lang === "en", "btn-ghost": props.lang !== "en" }}
              title={props.t.langEn}
              aria-pressed={props.lang === "en"}
              onClick={() => props.setLang("en")}
            >
              EN
            </button>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm btn-square"
            aria-label={props.dark ? props.t.themeLight : props.t.themeDark}
            title={props.dark ? props.t.themeLight : props.t.themeDark}
            onClick={() => props.setDark(!props.dark)}
          >
            <span
              class={props.dark ? "icon-[material-symbols--light-mode] h-5 w-5" : "icon-[material-symbols--dark-mode] h-5 w-5"}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </header>
  );
}