import { createEffect, createMemo, createSignal, Match, Switch } from "solid-js";
import { useRouter } from "./router";
import { NAV_VENDORS, VENDOR_MAP } from "./vendors/registry";
import type { Lang } from "./types";
import VendorPage from "./VendorPage";
import StartPage from "./StartPage";
import LegalPage from "./pages/LegalPage";

const storedLang = typeof localStorage !== "undefined" ? localStorage.getItem("lang") : null;
const storedTheme = typeof localStorage !== "undefined" ? localStorage.getItem("theme") : null;
const browserLang =
  typeof navigator !== "undefined" ? (navigator.language || "").toLowerCase() : "";
const defaultLang: Lang =
  storedLang === "de" || storedLang === "en" ? storedLang : browserLang.startsWith("de") ? "de" : "en";

function readGlobalParams(): { lang: Lang | null; theme: "dark" | null } {
  const p = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const l = p.get("lang");
  const lang: Lang | null = l === "de" || l === "en" ? l : null;
  const theme: "dark" | null = p.get("theme") === "dark" ? "dark" : null;
  return { lang, theme };
}

type Route = "home" | "zai" | "mimo" | "impressum" | "datenschutz";

export default function AppRoutes() {
  const { path } = useRouter();
  const route = createMemo<Route>(() => {
    const p = path();
    if (p === "/z-ai") return "zai";
    if (p === "/mimo") return "mimo";
    if (p === "/impressum") return "impressum";
    if (p === "/datenschutz") return "datenschutz";
    return "home";
  });

  const [lang, setLang] = createSignal<Lang>(readGlobalParams().lang ?? defaultLang);
  const [dark, setDark] = createSignal(readGlobalParams().theme === "dark" || storedTheme === "dark");

  createEffect(() => {
    document.documentElement.lang = lang();
    localStorage.setItem("lang", lang());
  });

  createEffect(() => {
    const el = document.documentElement;
    if (dark()) {
      el.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      el.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    }
  });

  return (
    <Switch fallback={<StartPage lang={lang()} setLang={setLang} dark={dark()} setDark={setDark} />}>
      <Match when={route() === "zai"}>
        <VendorPage module={VENDOR_MAP.zai} navVendors={NAV_VENDORS} lang={lang()} setLang={setLang} dark={dark()} setDark={setDark} />
      </Match>
      <Match when={route() === "mimo"}>
        <VendorPage module={VENDOR_MAP.mimo} navVendors={NAV_VENDORS} lang={lang()} setLang={setLang} dark={dark()} setDark={setDark} />
      </Match>
      <Match when={route() === "impressum"}>
        <LegalPage kind="impressum" lang={lang()} setLang={setLang} dark={dark()} setDark={setDark} />
      </Match>
      <Match when={route() === "datenschutz"}>
        <LegalPage kind="datenschutz" lang={lang()} setLang={setLang} dark={dark()} setDark={setDark} />
      </Match>
    </Switch>
  );
}