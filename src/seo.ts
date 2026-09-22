import type { Lang, VendorModule } from "./types";
import {
  alternateUrls,
  canonicalUrl,
  SITE_NAME,
  SITE_ORIGIN,
  stripLangPrefix,
} from "./routes";

export interface RouteSeo {
  title: string;
  description: string;
}

const TITLES: Record<string, Record<Lang, string>> = {
  "/": {
    de: "Coding-Subscriptions im Vergleich — GLM, MiMo & Ollama Plans (2026)",
    en: "Coding subscriptions compared — GLM, MiMo & Ollama plans (2026)",
  },
  "/z-ai": {
    de: "z.ai GLM Coding Plan — Preis, Credits & lohnt es sich?",
    en: "z.ai GLM Coding Plan — price, credits & is it worth it?",
  },
  "/mimo": {
    de: "Xiaomi MiMo Token Plan — Preis, Credits & lohnt es sich?",
    en: "Xiaomi MiMo Token Plan — price, credits & is it worth it?",
  },
  "/ollama": {
    de: "Ollama Cloud Plans — Preis, Credits & lohnt es sich?",
    en: "Ollama Cloud plans — price, credits & is it worth it?",
  },
  "/impressum": { de: "Impressum — Provider Plans", en: "Imprint — Provider Plans" },
  "/datenschutz": { de: "Datenschutz — Provider Plans", en: "Privacy — Provider Plans" },
};

const DESCRIPTIONS: Record<string, Record<Lang, string>> = {
  "/": {
    de: "GLM Coding Plan (z.ai), MiMo Token Plan (Xiaomi) und Ollama Cloud im Vergleich: Preise, Credits, Requests pro Monat, Peak/Off-Peak und enthaltene Modelle — automatisch aktualisiert.",
    en: "GLM Coding Plan (z.ai), MiMo Token Plan (Xiaomi) and Ollama Cloud compared: prices, credits, requests per month, peak/off-peak and included models — updated automatically.",
  },
  "/z-ai": {
    de: "z.ai GLM Coding Plan: Preise ab $18/Monat, Wochen-Credits, Off-Peak −50 % und Requests/Monat für GLM-5.3 & GLM-5.3-Flash — inklusive Einschätzung, ob sich der Plan lohnt.",
    en: "z.ai GLM Coding Plan: prices from $18/month, weekly credits, off-peak −50% and requests/month for GLM-5.3 & GLM-5.3-Flash — including a verdict on whether the plan is worth it.",
  },
  "/mimo": {
    de: "Xiaomi MiMo Token Plan: Preise ab $6/Monat, monatliche Credits, Nacht-Rabatt −20 % und Requests/Monat für mimo-v2.6-flash & mimo-v2.6-pro — inklusive Einschätzung, ob sich der Plan lohnt.",
    en: "Xiaomi MiMo Token Plan: prices from $6/month, monthly credits, night discount −20% and requests/month for mimo-v2.6-flash & mimo-v2.6-pro — including a verdict on whether the plan is worth it.",
  },
  "/ollama": {
    de: "Ollama Cloud Plans: Pro $20/Monat mit $60 Credits, Max $100/Monat mit $300 Credits — DeepSeek, GLM, Kimi, Qwen und mehr, Peak/Off-Peak und Requests/Monat.",
    en: "Ollama Cloud plans: Pro $20/month with $60 credits, Max $100/month with $300 credits — DeepSeek, GLM, Kimi, Qwen and more, peak/off-peak and requests/month.",
  },
  "/impressum": { de: "Impressum und Anbieterkennzeichnung.", en: "Imprint and provider information." },
  "/datenschutz": {
    de: "Datenschutzhinweise: keine Cookies, kein Tracking, keine Analyse- oder Werbedienste.",
    en: "Privacy notice: no cookies, no tracking, no analytics or advertising services.",
  },
};

export function routeSeo(routePath: string, lang: Lang): RouteSeo {
  const key = stripLangPrefix(routePath);
  return {
    title: (TITLES[key] ?? TITLES["/"])[lang],
    description: (DESCRIPTIONS[key] ?? DESCRIPTIONS["/"])[lang],
  };
}

export interface HeadTags extends RouteSeo {
  canonical: string;
  htmlLang: Lang;
  ogLocale: string;
  alternates: { en: string; de: string; xDefault: string };
  jsonLd: unknown[];
}

export function buildHead(routePath: string, lang: Lang, vendors: VendorModule[]): HeadTags {
  const key = stripLangPrefix(routePath);
  const seo = routeSeo(key, lang);
  return {
    ...seo,
    canonical: canonicalUrl(key, lang),
    htmlLang: lang,
    ogLocale: lang === "de" ? "de_DE" : "en_US",
    alternates: alternateUrls(key),
    jsonLd: buildJsonLd(key, lang, vendors),
  };
}

export function buildJsonLd(routePath: string, lang: Lang, vendors: VendorModule[]): unknown[] {
  const key = stripLangPrefix(routePath);
  const seo = routeSeo(key, lang);
  const canonical = canonicalUrl(key, lang);
  const graph: unknown[] = [];

  const vendor = vendors.find((m) => m.meta.path === key);
  if (vendor) {
    graph.push({
      "@type": "Product",
      name: vendor.meta.name,
      description: seo.description,
      brand: { "@type": "Brand", name: vendor.meta.shortName },
      offers: vendor.data.plans.map((p) => ({
        "@type": "Offer",
        name: p.name,
        price: p.priceMonthly,
        priceCurrency: "USD",
        url: canonical,
        availability: "https://schema.org/InStock",
      })),
    });
    graph.push({
      "@type": "ItemList",
      name: lang === "de" ? "Enthaltene Modelle" : "Included models",
      itemListElement: [...new Set(vendor.data.models.map((m) => m.name))].map((name, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name,
      })),
    });
  } else if (key === "/") {
    graph.push({
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_ORIGIN + "/",
      inLanguage: lang,
      description: seo.description,
    });
    graph.push({
      "@type": "ItemList",
      name: lang === "de" ? "Verglichene Anbieter" : "Compared providers",
      itemListElement: vendors.map((m, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: m.meta.name,
        url: canonicalUrl(m.meta.path, lang),
      })),
    });
  }

  if (graph.length === 0) return [];
  return [{ "@context": "https://schema.org", "@graph": graph }];
}

/* ---------------------------------------------------------------------------
 * Client-seitige Head-Aktualisierung (nach Navigation). Nur im Browser aktiv.
 * ------------------------------------------------------------------------- */

function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string, hreflang?: string): void {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    if (hreflang) el.setAttribute("hreflang", hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertJsonLd(jsonLd: unknown[]): void {
  const id = "__JSONLD__";
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  if (jsonLd.length === 0) return;
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = id;
  script.textContent = JSON.stringify(jsonLd);
  document.head.appendChild(script);
}

/** Titel/Description/Canonical/hreflang/og/JSON-LD nach Client-Navigation setzen. */
export function applyHead(routePath: string, lang: Lang, vendors: VendorModule[]): void {
  if (typeof document === "undefined") return;
  const head = buildHead(routePath, lang, vendors);
  document.title = head.title;
  document.documentElement.lang = lang;
  upsertMeta("name", "description", head.description);
  upsertMeta("property", "og:title", head.title);
  upsertMeta("property", "og:description", head.description);
  upsertMeta("property", "og:url", head.canonical);
  upsertMeta("property", "og:locale", head.ogLocale);
  upsertMeta("name", "twitter:title", head.title);
  upsertMeta("name", "twitter:description", head.description);
  upsertLink("canonical", head.canonical);
  upsertLink("alternate", head.alternates.en, "en");
  upsertLink("alternate", head.alternates.de, "de");
  upsertLink("alternate", head.alternates.xDefault, "x-default");
  upsertJsonLd(head.jsonLd);
}

