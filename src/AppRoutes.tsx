import { createEffect, createMemo, createSignal, Match, onMount, Switch } from "solid-js";
import { useRouter } from "./router";
import { NAV_VENDORS } from "./vendors/registry";
import type { Lang, VendorId, VendorModule } from "./types";
import StartPage from "./StartPage";
import VendorPage from "./VendorPage";
import LegalPage from "./pages/LegalPage";
import { canonicalPath, langFromPath, normalizePath, stripLangPrefix } from "./routes";
import { applyHead } from "./seo";

type Route = "home" | "zai" | "mimo" | "ollama" | "impressum" | "datenschutz";

export interface AppRoutesProps {
  /** Initiale Sprache (SSR). Ohne Angabe wird sie aus dem Pfadpräfix abgeleitet. */
  lang?: Lang;
  /** Synchron verfügbare Vendor-Module. */
  vendors: VendorModule[];
}

export default function AppRoutes(props: AppRoutesProps) {
  const { path, navigate, replace } = useRouter();
  const fullPath = () => normalizePath(path());
  const routePath = () => stripLangPrefix(fullPath());

  const route = createMemo<Route>(() => {
    const p = routePath();
    if (p === "/z-ai") return "zai";
    if (p === "/mimo") return "mimo";
    if (p === "/ollama") return "ollama";
    if (p === "/impressum") return "impressum";
    if (p === "/datenschutz") return "datenschutz";
    return "home";
  });

  // Default ist Englisch (bzw. das `lang`-Prop des SSR-Laufs). Der Pfadpräfix
  // entscheidet beim Client synchron — dadurch passt die Hydration exakt zum
  // vorgerenderten File (`/` = en, `/de` = de).
  const [lang, setLang] = createSignal<Lang>(props.lang ?? langFromPath(fullPath()));
  const [dark, setDark] = createSignal(false);

  const vendor = (id: VendorId): VendorModule =>
    props.vendors.find((m) => m.meta.id === id) ?? props.vendors[0]!;

  /** Sprachumschalter: navigiert zwischen `/…` und `/de/…` per pushState.
   *  Query-Params (außer `lang`) und Hash bleiben erhalten. */
  const setLangAndNavigate = (l: Lang) => {
    if (l === lang()) return;
    setLang(l);
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    sp.delete("lang");
    const qs = sp.toString();
    navigate(canonicalPath(routePath(), l) + (qs ? "?" + qs : "") + window.location.hash);
  };

  onMount(() => {
    const url = new URL(window.location.href);
    const qLang = url.searchParams.get("lang");
    const stored = localStorage.getItem("lang");
    const route = routePath();
    const pathLang = langFromPath(fullPath());

    // Ziel-URL in der kanonischen Pfadform, Query (ohne `lang`) + Hash bleiben erhalten.
    const buildTarget = (target: Lang, dropLang: boolean) => {
      const sp = new URLSearchParams(url.search);
      if (dropLang) sp.delete("lang");
      const qs = sp.toString();
      return canonicalPath(route, target) + (qs ? "?" + qs : "") + url.hash;
    };

    if (qLang === "de" || qLang === "en") {
      // `?lang=…` bleibt als Alias erhalten: Sprache anwenden und in die Pfadform überführen.
      setLang(qLang);
      replace(buildTarget(qLang, true));
    } else if (fullPath() === "/") {
      // Präfixlose Standardseite: gespeicherte Sprache, sonst Browser-Sprache.
      // `/de/` wird NIE überschrieben (Pfad ist die Quelle der Wahrheit).
      const storedLang: Lang | null = stored === "de" || stored === "en" ? stored : null;
      const browserDe =
        typeof navigator !== "undefined" && (navigator.language || "").toLowerCase().startsWith("de");
      const desired: Lang = storedLang ?? (browserDe ? "de" : "en");
      if (desired !== pathLang) {
        setLang(desired);
        replace(buildTarget(desired, false));
      }
    }

    if (url.searchParams.get("theme") === "dark" || localStorage.getItem("theme") === "dark") {
      setDark(true);
    }
  });

  createEffect(() => {
    const l = lang();
    applyHead(fullPath(), l, props.vendors);
    if (typeof localStorage !== "undefined") localStorage.setItem("lang", l);
  });

  createEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    if (dark()) {
      el.setAttribute("data-theme", "dark");
      if (typeof localStorage !== "undefined") localStorage.setItem("theme", "dark");
    } else {
      el.removeAttribute("data-theme");
      if (typeof localStorage !== "undefined") localStorage.setItem("theme", "light");
    }
  });

  const shared = () => ({
    lang: lang(),
    setLang: setLangAndNavigate,
    dark: dark(),
    setDark,
    navVendors: NAV_VENDORS,
  });

  return (
    <Switch fallback={<StartPage {...shared()} vendors={props.vendors} />}>
      <Match when={route() === "zai"}>
        <VendorPage {...shared()} module={vendor("zai")} />
      </Match>
      <Match when={route() === "mimo"}>
        <VendorPage {...shared()} module={vendor("mimo")} />
      </Match>
      <Match when={route() === "ollama"}>
        <VendorPage {...shared()} module={vendor("ollama")} />
      </Match>
      <Match when={route() === "impressum"}>
        <LegalPage {...shared()} kind="impressum" />
      </Match>
      <Match when={route() === "datenschutz"}>
        <LegalPage {...shared()} kind="datenschutz" />
      </Match>
    </Switch>
  );
}
