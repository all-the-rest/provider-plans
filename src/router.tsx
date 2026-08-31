import { createContext, createSignal, onCleanup, onMount, useContext, type JSX } from "solid-js";

interface RouterCtx {
  path: () => string;
  navigate: (to: string) => void;
}

const Ctx = createContext<RouterCtx>();

export function RouterProvider(props: { children: JSX.Element }) {
  const [path, setPath] = createSignal(window.location.pathname);

  const navigate = (to: string) => {
    if (to === window.location.pathname) return;
    window.history.pushState(null, "", to);
    setPath(to);
    window.scrollTo({ top: 0 });
  };

  onMount(() => {
    const onPop = () => setPath(window.location.pathname);
    const onClick = (e: MouseEvent) => {
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

  return <Ctx.Provider value={{ path, navigate }}>{props.children}</Ctx.Provider>;
}

export function useRouter(): RouterCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRouter must be used within RouterProvider");
  return ctx;
}