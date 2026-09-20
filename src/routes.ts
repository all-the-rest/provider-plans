import type { Lang } from "./types";

/** Kanonische Domain der GitHub-Pages-Seite (CNAME im public/). */
export const SITE_ORIGIN = "https://ai-vendor-price-tracking.all-the.rest";
export const SITE_NAME = "Provider Plans";

/** Englisch ist der Default; Deutsch liegt unter dem Präfix `/de`. */
export const DEFAULT_LANG: Lang = "en";

/** Sprachneutrale Route-Pfade (ohne `/de`-Präfix, ohne Trailing Slash). */
export const ROUTE_PATHS = [
  "/",
  "/z-ai",
  "/mimo",
  "/ollama",
  "/impressum",
  "/datenschutz",
] as const;

export type RoutePath = (typeof ROUTE_PATHS)[number];

/**
 * Pfad normalisieren: Query/Hash entfernen, führenden Slash erzwingen,
 * Mehrfach-Slashes und Trailing Slash (außer `/`) entfernen.
 * So routen `/z-ai`, `/z-ai/` und `/z-ai?x=1` identisch.
 */
export function normalizePath(p: string): string {
  let path = (p || "/").split("?")[0].split("#")[0];
  if (!path.startsWith("/")) path = "/" + path;
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

/** Sprache aus dem Pfadpräfix ableiten (`/de`, `/de/...` → de, sonst en). */
export function langFromPath(p: string): Lang {
  const n = normalizePath(p);
  return n === "/de" || n.startsWith("/de/") ? "de" : "en";
}

/** `/de`-Präfix entfernen → sprachneutraler Route-Pfad. */
export function stripLangPrefix(p: string): string {
  const n = normalizePath(p);
  if (n === "/de") return "/";
  if (n.startsWith("/de/")) return normalizePath(n.slice(3));
  return n;
}

/** Sprachneutralen Route-Pfad mit Sprachpräfix versehen. */
export function withLangPrefix(routePath: string, lang: Lang): string {
  const n = normalizePath(routePath);
  if (lang !== "de") return n;
  return n === "/" ? "/de" : "/de" + n;
}

/** Kanonische Pfadform mit Trailing Slash (Verzeichnis-URL), z. B. `/de/`, `/z-ai/`. */
export function canonicalPath(routePath: string, lang: Lang): string {
  const p = withLangPrefix(routePath, lang);
  return p === "/" ? "/" : p + "/";
}

/** Kanonische absolute URL einer Route in einer Sprache (Trailing Slash für Verzeichnisse). */
export function canonicalUrl(routePath: string, lang: Lang): string {
  const p = withLangPrefix(routePath, lang);
  return SITE_ORIGIN + (p === "/" ? "/" : p + "/");
}

/** hreflang-Alternates (en/de/x-default) einer Route. */
export function alternateUrls(routePath: string): { en: string; de: string; xDefault: string } {
  return {
    en: canonicalUrl(routePath, "en"),
    de: canonicalUrl(routePath, "de"),
    xDefault: canonicalUrl(routePath, "en"),
  };
}
