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
    <header class="navbar sticky top-0 z-10 bg-base-200 px-3 shadow-sm md:px-6">
      <div class="navbar-start gap-1">
        {/* Mobile (< md): Burger-Dropdown ganz links, öffnet nach rechts — wie cc-price-tracker */}
        <div class="dropdown dropdown-start md:hidden">
          <div
            tabindex="0"
            role="button"
            class="btn btn-ghost btn-circle btn-sm"
            aria-label={props.lang === "de" ? "Weitere Links" : "More links"}
          >
            <svg
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <ul tabindex="0" class="menu dropdown-content z-20 mt-2 w-60 max-w-[90vw] rounded-box bg-base-100 p-2 shadow-lg">
            <li>
              <a href="/" classList={{ "menu-active": isActive("/") }}>
                {props.t.navHome}
              </a>
            </li>
            <For each={props.vendors}>
              {(v) => (
                <li>
                  <a href={v.path} classList={{ "menu-active": isActive(v.path) }}>
                    {v.name}
                  </a>
                </li>
              )}
            </For>
            <li class="menu-title">{props.lang === "de" ? "Rechtliches" : "Legal"}</li>
            <li>
              <a href="/impressum" classList={{ "menu-active": isActive("/impressum") }}>
                {props.t.impressum}
              </a>
            </li>
            <li>
              <a href="/datenschutz" classList={{ "menu-active": isActive("/datenschutz") }}>
                {props.t.datenschutz}
              </a>
            </li>
          </ul>
        </div>

        <a
          href="/"
          class="btn btn-ghost px-2 text-lg font-bold"
          classList={{ "btn-active": isActive("/") }}
          aria-current={isActive("/") ? "page" : undefined}
        >
          {props.t.brand}
        </a>

        {/* Desktop (≥ md): Vendor-Tabs inline */}
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
    </header>
  );
}