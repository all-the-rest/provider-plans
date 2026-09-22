import type { Lang, Plan, VendorModule } from "./types";
import { fmt, fmtBig, fmtInt } from "./util";
import { flagshipModel } from "./vendors/shared";
import {
  alternateUrls,
  canonicalUrl,
  SITE_NAME,
  SITE_ORIGIN,
  stripLangPrefix,
} from "./routes";

export interface FaqItem {
  q: string;
  a: string;
}

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

function flagship(module: VendorModule) {
  return flagshipModel(module);
}

function planValueText(module: VendorModule, plan: Plan, lang: Lang): string | null {
  const v = module.formulas.planValue(plan, "monthly");
  if (v === null || Number.isNaN(v)) return null;
  const s = v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return lang === "de" ? `≈ ${s}× den API-Gegenwert` : `≈ ${s}× the API value`;
}

/** Nutzen-orientierte FAQ je Vendor — identisch für sichtbare Seite und JSON-LD. */
export function vendorFaq(module: VendorModule, lang: Lang): FaqItem[] {
  const de = lang === "de";
  const plans = module.data.plans;
  const first = plans[0];
  const model = flagship(module);
  const modelName = model?.name ?? module.meta.shortName;
  const pool = first ? module.formulas.monthlyCredits(first) : null;
  const req = first && model ? module.formulas.requestsPerMonth(model, first) : null;
  const value = first ? planValueText(module, first, lang) : null;
  const prices = plans.map((p) => p.priceMonthly).filter((n): n is number => typeof n === "number");
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const modelNames = [...new Set(module.data.models.map((m) => m.name))];
  const items: FaqItem[] = [];

  if (first && value) {
    items.push({
      q: de ? `Lohnt sich der ${module.meta.shortName}-Plan?` : `Is the ${module.meta.shortName} plan worth it?`,
      a: de
        ? `Der Einstiegsplan „${first.name}“ kostet ${fmt(first.priceMonthly)}/Monat und liefert rechnerisch ${value} des enthaltenen Credit-Pools. Je nach Nutzung und Peak-/Off-Peak-Zeit lohnt er sich vor allem für Vielnutzer.`
        : `The entry plan “${first.name}” costs ${fmt(first.priceMonthly)}/month and delivers ${value} of its included credit pool. Depending on usage and peak/off-peak timing, it pays off mainly for heavy users.`,
    });
  }
  if (req !== null) {
    items.push({
      q: de ? "Wie viele Requests pro Monat sind enthalten?" : "How many requests per month are included?",
      a: de
        ? `Mit dem Flaggschiff-Modell ${modelName} sind im Plan „${first?.name ?? ""}“ ca. ${fmtInt(req, lang)} Requests/Monat enthalten (Peak); off-peak sind entsprechend mehr möglich.`
        : `With the flagship model ${modelName}, the “${first?.name ?? ""}” plan includes about ${fmtInt(req, lang)} requests/month (peak); off-peak allows correspondingly more.`,
    });
  }
  if (pool !== null) {
    items.push({
      q: de ? "Wie hoch ist der Credit-Pool?" : "How large is the credit pool?",
      a: de
        ? `Der Plan „${first?.name ?? ""}“ umfasst ${fmtBig(pool)} Credits pro Monat${first?.kind === "weekly" ? " (Wochen-Credits × 4)" : ""}.`
        : `The “${first?.name ?? ""}” plan includes ${fmtBig(pool)} credits per month${first?.kind === "weekly" ? " (weekly credits × 4)" : ""}.`,
    });
  }
  items.push({
    q: de ? "Gibt es Peak- und Off-Peak-Zeiten?" : "Are there peak and off-peak times?",
    a: module.i18n[lang].peakWeekendNote || module.peak.timezoneLabel,
  });
  items.push({
    q: de ? "Welche Modelle sind enthalten?" : "Which models are included?",
    a: de
      ? `${modelNames.join(", ")}.`
      : `${modelNames.join(", ")}.`,
  });
  if (minPrice !== null) {
    items.push({
      q: de ? "Was kostet der Plan?" : "How much does the plan cost?",
      a:
        minPrice === maxPrice
          ? de
            ? `${fmt(minPrice)}/Monat (monatliche Abrechnung).`
            : `${fmt(minPrice)}/month (monthly billing).`
          : de
            ? `Je nach Plan zwischen ${fmt(minPrice)} und ${fmt(maxPrice)} pro Monat (monatliche Abrechnung).`
            : `Depending on the plan, between ${fmt(minPrice)} and ${fmt(maxPrice)} per month (monthly billing).`,
    });
  }
  return items;
}

/** Nutzen-orientierte FAQ der Startseite. */
export function homeFaq(vendors: VendorModule[], lang: Lang): FaqItem[] {
  const de = lang === "de";
  const cheapest = vendors
    .map((m) => ({ m, plan: m.data.plans[0] }))
    .filter((x) => x.plan)
    .sort((a, b) => a.plan!.priceMonthly - b.plan!.priceMonthly)[0];
  const names = vendors.map((m) => m.meta.name).join(", ");
  const bestReq = vendors
    .map((m) => {
      const model = flagship(m);
      const plan = m.data.plans[0];
      const req = model && plan ? m.formulas.requestsPerMonth(model, plan) : null;
      return { m, req };
    })
    .filter((x) => x.req !== null)
    .sort((a, b) => (b.req ?? 0) - (a.req ?? 0))[0];

  const items: FaqItem[] = [];
  items.push({
    q: de ? "Welcher Coding-Plan ist am günstigsten?" : "Which coding plan is the cheapest?",
    a: cheapest
      ? de
        ? `${cheapest.m.meta.name} startet mit „${cheapest.plan!.name}“ ab ${fmt(cheapest.plan!.priceMonthly)}/Monat.`
        : `${cheapest.m.meta.name} starts at ${fmt(cheapest.plan!.priceMonthly)}/month with “${cheapest.plan!.name}”.`
      : de
        ? "Die Preise werden täglich automatisch aktualisiert."
        : "Prices are updated automatically every day.",
  });
  if (bestReq && bestReq.req !== null) {
    items.push({
      q: de ? "Wo bekomme ich die meisten Requests pro Monat?" : "Where do I get the most requests per month?",
      a: de
        ? `Im Einstiegsplan von ${bestReq.m.meta.name} sind mit dem Flaggschiff-Modell ca. ${fmtInt(bestReq.req, lang)} Requests/Monat enthalten.`
        : `The entry plan of ${bestReq.m.meta.name} includes about ${fmtInt(bestReq.req, lang)} requests/month with the flagship model.`,
    });
  }
  items.push({
    q: de ? "Was bedeutet Peak und Off-Peak?" : "What do peak and off-peak mean?",
    a: de
      ? "Zu Peak-Zeiten kosten Anfragen den vollen Credit-Satz, off-peak weniger (z. B. −50 % bei z.ai, −20 % bei MiMo). Die genauen Zeitfenster stehen auf jeder Vendor-Seite."
      : "During peak hours requests cost the full credit rate, off-peak less (e.g. −50% at z.ai, −20% at MiMo). The exact time windows are shown on each vendor page.",
  });
  items.push({
    q: de ? "Welche Anbieter vergleicht diese Seite?" : "Which providers does this site compare?",
    a: de ? `${names}.` : `${names}.`,
  });
  items.push({
    q: de ? "Lohnt sich ein Jahres-Abo?" : "Is an annual subscription worth it?",
    a: de
      ? "Viele Pläne gewähren bei Quartals- oder Jahreszahlung einen Rabatt (z. B. −20 % / −30 % bei z.ai). Der Umschalter auf der Vendor-Seite rechnet die Preise inklusive Rabatt."
      : "Many plans offer a discount for quarterly or annual billing (e.g. −20% / −30% at z.ai). The switcher on each vendor page recalculates prices including the discount.",
  });
  items.push({
    q: de ? "Wie aktuell sind die Preise?" : "How current are the prices?",
    a: de
      ? "Die Daten werden täglich automatisch aus den offiziellen Anbieter-Seiten gescrapt; der Stand steht im Footer jeder Seite."
      : "The data is scraped automatically from the official provider pages every day; the timestamp is shown in the footer of every page.",
  });
  return items;
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
    graph.push(faqPage(vendorFaq(vendor, lang)));
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
    graph.push(faqPage(homeFaq(vendors, lang)));
  }

  if (graph.length === 0) return [];
  return [{ "@context": "https://schema.org", "@graph": graph }];
}

function faqPage(items: FaqItem[]): unknown {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
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

