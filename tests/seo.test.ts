// tests/seo.test.ts — prüft die vorgerenderten HTML-Dateien + SEO-Artefakte in dist/.
// Läuft nur, wenn ein Build existiert (`pnpm build`); sonst wird der Test geskippt,
// weil `pnpm test` in CI VOR dem Build läuft (Absicherung übernimmt der Smoke-Test).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(root, "dist");
const ORIGIN = "https://ai-vendor-price-tracking.all-the.rest";

interface PageSpec {
  file: string;
  path: string;
  lang: "en" | "de";
  names: string[];
  indexable: boolean;
  title: RegExp;
}

const PAGES: PageSpec[] = [
  {
    file: "index.html",
    path: "/",
    lang: "en",
    names: ["z.ai", "MiMo", "Ollama"],
    indexable: true,
    title: /Coding subscriptions compared/,
  },
  {
    file: "z-ai/index.html",
    path: "/z-ai",
    lang: "en",
    names: ["GLM-5.3", "Lite"],
    indexable: true,
    title: /z\.ai GLM Coding Plan/,
  },
  {
    file: "mimo/index.html",
    path: "/mimo",
    lang: "en",
    names: ["mimo-v2.6-flash", "Lite"],
    indexable: true,
    title: /Xiaomi MiMo Token Plan/,
  },
  {
    file: "ollama/index.html",
    path: "/ollama",
    lang: "en",
    names: ["deepseek", "Pro"],
    indexable: true,
    title: /Ollama Cloud plans/,
  },
  {
    file: "de/index.html",
    path: "/de",
    lang: "de",
    names: ["z.ai", "MiMo", "Ollama"],
    indexable: true,
    title: /Coding-Subscriptions im Vergleich/,
  },
  {
    file: "de/z-ai/index.html",
    path: "/de/z-ai",
    lang: "de",
    names: ["GLM-5.3", "Lite"],
    indexable: true,
    title: /z\.ai GLM Coding Plan — Preis/,
  },
  {
    file: "de/mimo/index.html",
    path: "/de/mimo",
    lang: "de",
    names: ["mimo-v2.6-flash", "Lite"],
    indexable: true,
    title: /Xiaomi MiMo Token Plan — Preis/,
  },
  {
    file: "de/ollama/index.html",
    path: "/de/ollama",
    lang: "de",
    names: ["deepseek", "Pro"],
    indexable: true,
    title: /Ollama Cloud Plans — Preis/,
  },
  {
    file: "impressum/index.html",
    path: "/impressum",
    lang: "en",
    names: ["Florian Reisinger"],
    indexable: false,
    title: /Imprint/,
  },
  {
    file: "datenschutz/index.html",
    path: "/datenschutz",
    lang: "en",
    names: ["Barichgasse"],
    indexable: false,
    title: /Privacy/,
  },
];

const read = (file: string) => readFileSync(resolve(DIST, file), "utf8");
const hasDist = existsSync(resolve(DIST, "index.html"));
const opts = { skip: hasDist ? false : "dist/ fehlt — vorher `pnpm build` ausführen" };

function rootMarkup(html: string): string {
  const start = html.indexOf('<div id="root">');
  const end = html.indexOf('<script type="application/json" id="__VENDORS__">');
  if (start < 0 || end < 0) return "";
  return html.slice(start, end);
}

function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  for (const m of html.matchAll(re)) out.push(JSON.parse(m[1]));
  return out;
}

describe("seo/prerender", () => {
  for (const page of PAGES) {
    it(`${page.file}: eigenständiges HTML mit <h1>, Inhalt, Titel, hreflang`, opts, () => {
      assert.ok(existsSync(resolve(DIST, page.file)), `dist/${page.file} fehlt`);
      const html = read(page.file);

      assert.match(html, new RegExp(`<html lang="${page.lang}"`), `dist/${page.file}: <html lang>`);
      assert.match(html, page.title, `dist/${page.file}: routenspezifischer <title>`);
      assert.match(html, /<h1[\s>]/, `dist/${page.file}: kein <h1>`);

      // Vorgerendertes Markup (nicht nur leere Shell).
      const body = rootMarkup(html);
      assert.ok(body.length > 1000, `dist/${page.file}: #root ist (fast) leer`);
      for (const name of page.names) {
        assert.ok(body.includes(name), `dist/${page.file}: "${name}" fehlt im vorgerenderten Inhalt`);
      }

      // Hydration-Script für interaktive Seiten.
      assert.ok(html.includes("_$HY"), `dist/${page.file}: Hydration-Script window._$HY fehlt`);

      // Canonical zeigt auf die eigene Sprach-URL.
      assert.ok(
        html.includes(`<link rel="canonical" href="${ORIGIN}${page.path === "/" ? "/" : page.path + "/"}"`),
        `dist/${page.file}: Canonical falsch`
      );
      // hreflang-Alternates.
      assert.ok(html.includes('hreflang="en"') && html.includes('hreflang="de"') && html.includes('hreflang="x-default"'));

      if (page.indexable) {
        const blocks = jsonLdBlocks(html);
        assert.ok(blocks.length >= 1, `dist/${page.file}: kein valides JSON-LD`);
        assert.ok(!html.includes('name="robots"'), `dist/${page.file}: indexierbar, aber robots-Meta vorhanden`);
      } else {
        assert.ok(html.includes('name="robots" content="noindex,follow"'), `dist/${page.file}: noindex fehlt`);
      }
    });
  }

  it("Vendor-Routen sind eigene Dateien (nicht index.html-Kopien)", opts, () => {
    const index = read("index.html");
    for (const file of ["z-ai/index.html", "mimo/index.html", "ollama/index.html"]) {
      const html = read(file);
      assert.notEqual(html, index, `dist/${file} ist identisch mit dist/index.html`);
    }
  });

  it("JSON-LD enthält Product/Offer und ItemList (keine FAQPage)", opts, () => {
    const html = read("z-ai/index.html");
    const [graph] = jsonLdBlocks(html) as { "@graph": { "@type": string }[] }[];
    const types = graph["@graph"].map((n) => n["@type"]);
    assert.ok(types.includes("Product"), "Product fehlt");
    assert.ok(types.includes("ItemList"), "ItemList fehlt");
    assert.ok(!types.includes("FAQPage"), "FAQPage sollte entfernt sein");
    const product = graph["@graph"].find((n) => n["@type"] === "Product") as {
      offers: { price: number; priceCurrency: string }[];
    };
    assert.ok(product.offers.length >= 1 && product.offers.every((o) => o.priceCurrency === "USD"));
  });

  it("robots.txt + sitemap.xml vorhanden und gültig", opts, () => {
    const robots = read("robots.txt");
    assert.match(robots, /User-agent: \*/);
    assert.ok(robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`));

    const sitemap = read("sitemap.xml");
    assert.match(sitemap, /^<\?xml/);
    assert.ok(sitemap.includes("<urlset"));
    assert.ok(sitemap.includes(`<loc>${ORIGIN}/</loc>`), "Root-URL fehlt");
    assert.ok(sitemap.includes(`<loc>${ORIGIN}/de/</loc>`), "deutsche URL fehlt");
    assert.ok(sitemap.includes(`<loc>${ORIGIN}/z-ai/</loc>`), "z-ai-URL fehlt");
    assert.ok(sitemap.includes('hreflang="x-default"'));
  });

  it("404.html bleibt leere SPA-Shell ohne vorgerenderten Inhalt", opts, () => {
    const html = read("404.html");
    assert.match(html, /<div id="root"><\/div>/);
    assert.ok(!html.includes("__VENDORS__"), "404.html sollte kein eingebettetes Vendor-JSON haben");
  });
});
