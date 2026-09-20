import { createContext, createSignal, onCleanup, onMount, useContext, type JSX } from "solid-js";
import { normalizePath } from "./routes";

interface RouterCtx {
  /** Aktueller, normalisierter Pfad (ohne Query/Hash), z. B. "/de/z-ai". */
  path: () => string;
  /** Navigation per pushState; akzeptiert Pfad + optionale Query. */
  navigate: (to: string) => void;
  /** URL ersetzen (kein History-Eintrag); aktualisiert den Pfad-Signalwert. */
  replace: (to: string) => void;
}

const Ctx = createContext<RouterCtx>();

export function RouterProvider(props: { children: JSX.Element; initialPath?: string }) {
  const initial =
    props.initialPath ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  const [path, setPath] = createSignal(normalizePath(initial));

  const navigate = (to: string) => {
    const target = to || "/";
    if (typeof window === "undefined") return;
    const current = window.location.pathname + window.location.search;
    if (target === current) return;
    window.history.pushState(null, "", target);
    setPath(normalizePath(target));
    window.scrollTo({ top: 0 });
  };

  const replace = (to: string) => {
    const target = to || "/";
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", target);
    setPath(normalizePath(target));
  };

  onMount(() => {
    const onPop = () => setPath(normalizePath(window.location.pathname));
    const onClick = (e: MouseEvent) => {
      // Bereits behandelte Klicks (z. B. Anker-Links mit preventDefault +
      // eigenem replaceState + smooth scroll) nicht erneut routen — sonst
      // würde der Router den Hash per pushState + Scroll-to-top zerstören.
      if (e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      const a = el?.closest?.<HTMLAnchorElement>("a");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (
        !href.startsWith("/") ||
        href.startsWith("//") ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        e.button !== 0
      )
        return;
      e.preventDefault();
      navigate(href);
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", onClick);
    onCleanup(() => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick);
    });
  });

  return <Ctx.Provider value={{ path, navigate, replace }}>{props.children}</Ctx.Provider>;
}

export function useRouter(): RouterCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRouter must be used within RouterProvider");
  return ctx;
}
