import { createEffect, createMemo, createSignal, lazy, Match, Suspense, Switch } from "solid-js";
import { useRouter } from "./router";
import { NAV_VENDORS } from "./vendors/registry";
import type { Lang } from "./types";
import StartPage from "./StartPage";

const LazyZai = lazy(() =>
  Promise.all([import("./VendorPage"), import("./vendors/zai")]).then(([vp, m]) => ({
    default: (props: { navVendors: any; lang: Lang; setLang: any; dark: boolean; setDark: any }) => (
      <vp.default module={m.vendorModule} {...props} />
    ),
  }))
);
const LazyMimo = lazy(() =>
  Promise.all([import("./VendorPage"), import("./vendors/mimo")]).then(([vp, m]) => ({
    default: (props: { navVendors: any; lang: Lang; setLang: any; dark: boolean; setDark: any }) => (
      <vp.default module={m.vendorModule} {...props} />
    ),
  }))
);
const LazyOllama = lazy(() =>
  Promise.all([import("./VendorPage"), import("./vendors/ollama")]).then(([vp, m]) => ({
    default: (props: { navVendors: any; lang: Lang; setLang: any; dark: boolean; setDark: any }) => (
      <vp.default module={m.vendorModule} {...props} />
    ),
  }))
);
const LazyImpressum = lazy(() => import("./pages/LegalPage").then((m) => ({ default: (p: any) => <m.default kind="impressum" {...p} /> })));
const LazyDatenschutz = lazy(() => import("./pages/LegalPage").then((m) => ({ default: (p: any) => <m.default kind="datenschutz" {...p} /> })));

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

type Route = "home" | "zai" | "mimo" | "ollama" | "impressum" | "datenschutz";

export default function AppRoutes() {
  const { path } = useRouter();
  const route = createMemo<Route>(() => {
    const p = path();
    if (p === "/z-ai") return "zai";
    if (p === "/mimo") return "mimo";
    if (p === "/ollama") return "ollama";
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
        <Suspense fallback={<div class="mx-auto max-w-6xl px-4 py-10 text-sm text-base-content/60">Lade…</div>}>
          <LazyZai navVendors={NAV_VENDORS} lang={lang()} setLang={setLang} dark={dark()} setDark={setDark} />
        </Suspense>
      </Match>
      <Match when={route() === "mimo"}>
        <Suspense fallback={<div class="mx-auto max-w-6xl px-4 py-10 text-sm text-base-content/60">Lade…</div>}>
          <LazyMimo navVendors={NAV_VENDORS} lang={lang()} setLang={setLang} dark={dark()} setDark={setDark} />
        </Suspense>
      </Match>
      <Match when={route() === "ollama"}>
        <Suspense fallback={<div class="mx-auto max-w-6xl px-4 py-10 text-sm text-base-content/60">Lade…</div>}>
          <LazyOllama navVendors={NAV_VENDORS} lang={lang()} setLang={setLang} dark={dark()} setDark={setDark} />
        </Suspense>
      </Match>
      <Match when={route() === "impressum"}>
        <Suspense fallback={<div class="mx-auto max-w-6xl px-4 py-10 text-sm text-base-content/60">Lade…</div>}>
          <LazyImpressum lang={lang()} setLang={setLang} dark={dark()} setDark={setDark} />
        </Suspense>
      </Match>
      <Match when={route() === "datenschutz"}>
        <Suspense fallback={<div class="mx-auto max-w-6xl px-4 py-10 text-sm text-base-content/60">Lade…</div>}>
          <LazyDatenschutz lang={lang()} setLang={setLang} dark={dark()} setDark={setDark} />
        </Suspense>
      </Match>
    </Switch>
  );
}