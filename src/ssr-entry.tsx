import { generateHydrationScript, renderToString } from "solid-js/web";
import App from "./App";
import { vendorModule as zai } from "./vendors/zai";
import { vendorModule as mimo } from "./vendors/mimo";
import { vendorModule as ollama } from "./vendors/ollama";
import { serializeVendors } from "./vendors/embed";
import { buildHead, type HeadTags } from "./seo";
import type { Lang, VendorModule } from "./types";

/**
 * Statisch importierte Vendor-Module für den SSR-Lauf. Bewusst KEIN `lazy()`/
 * `Suspense` — der Server-Render ist synchron und muss die Vendor-Inhalte
 * (Pläne, Modelle, Preise) direkt ausgeben.
 */
export const vendors: VendorModule[] = [zai, mimo, ollama];

/** Rendert eine Route zu einem HTML-String (ohne <html>/<head>). */
export function renderRoute(path: string, lang: Lang = "en"): string {
  return renderToString(() => <App initialPath={path} lang={lang} vendors={vendors} />);
}

/** Bequemer Alias: rendert die Startseite einer Sprache. */
export function renderApp(lang: Lang = "en"): string {
  return renderRoute("/", lang);
}

/** Route-spezifische SEO-Tags (Titel, Description, Canonical, JSON-LD). */
export function headTags(path: string, lang: Lang = "en"): HeadTags {
  return buildHead(path, lang, vendors);
}

/** Solid-Hydration-Script (`window._$HY`) — ohne dieses scheitert `hydrate()`. */
export function hydrationScript(): string {
  return generateHydrationScript();
}

/** Serialisierter Vendor-Zustand für das `#__VENDORS__`-JSON im Client. */
export function embeddedVendorsJson(): string {
  return JSON.stringify(serializeVendors(vendors));
}
