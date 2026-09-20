// Statisches Pre-Rendering (SSR) + SEO-Artefakte.
//
// 1. Client-Build über die Repo-Config (Vite JS API) → dist/ (Assets, data/…, 404.html).
// 2. SSR-Build von src/ssr-entry.tsx (Solid `renderToString`) → .ssr-build/.
// 3. Pro Route × Sprache: vorgerendertes Markup + SEO-Head in eine echte
//    HTML-Datei schreiben (dist/index.html, dist/z-ai/index.html, dist/de/…).
// 4. robots.txt + sitemap.xml erzeugen.
//
// Ein einziger BUILD_STAMP für Client UND SSR → identischer „Stand" (hydration-stabil).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import solid from "vite-plugin-solid";

process.env.BUILD_STAMP ??= new Date().toISOString();

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(root, "dist");
const SSR_OUT = resolve(root, ".ssr-build");

const ROUTES = ["/", "/z-ai", "/mimo", "/ollama", "/impressum", "/datenschutz"];
const LANGS = ["en", "de"];
// Nur indexierbare Routen in die Sitemap (Legal-Seiten sind noindex).
const SITEMAP_ROUTES = ["/", "/z-ai", "/mimo", "/ollama"];

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function fullPath(route, lang) {
  if (lang !== "de") return route;
  return route === "/" ? "/de" : "/de" + route;
}

function outFile(route, lang) {
  const p = fullPath(route, lang);
  return p === "/" ? "index.html" : p.slice(1) + "/index.html";
}

function replaceTag(html, re, replacement) {
  if (re.test(html)) return html.replace(re, replacement);
  return html;
}

function upsertMeta(html, attr, key, value) {
  const re = new RegExp(`<meta\\s+${attr}="${escRe(key)}"[^>]*>`, "i");
  const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `  ${tag}\n  </head>`);
}

function upsertLink(html, rel, href) {
  const re = new RegExp(`<link\\s+rel="${escRe(rel)}"[^>]*>`, "i");
  const tag = `<link rel="${rel}" href="${esc(href)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `  ${tag}\n  </head>`);
}

function injectPage(shell, { body, head, hydration, vendorsJson, lang, noindex }) {
  let html = shell;
  html = replaceTag(html, /<html lang="[^"]*"/, `<html lang="${lang}"`);
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/, `<title>${esc(head.title)}</title>`);
  html = upsertMeta(html, "name", "description", head.description);
  html = upsertMeta(html, "property", "og:title", head.title);
  html = upsertMeta(html, "property", "og:description", head.description);
  html = upsertMeta(html, "property", "og:url", head.canonical);
  html = upsertMeta(html, "property", "og:locale", head.ogLocale);
  html = upsertMeta(
    html,
    "property",
    "og:locale:alternate",
    head.ogLocale === "de_DE" ? "en_US" : "de_DE"
  );
  html = upsertMeta(html, "name", "twitter:title", head.title);
  html = upsertMeta(html, "name", "twitter:description", head.description);
  html = upsertLink(html, "canonical", head.canonical);

  const headExtra = [
    `<link rel="alternate" hreflang="en" href="${esc(head.alternates.en)}" />`,
    `<link rel="alternate" hreflang="de" href="${esc(head.alternates.de)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(head.alternates.xDefault)}" />`,
    `<link rel="alternate" type="application/rss+xml" title="Provider Plans releases" href="https://github.com/all-the-rest/provider-plans/releases.atom" />`,
    noindex ? `<meta name="robots" content="noindex,follow" />` : "",
    hydration,
    ...head.jsonLd.map(
      (entry) =>
        `<script type="application/ld+json">${JSON.stringify(entry).replace(/</g, "\\u003c")}</script>`
    ),
  ]
    .filter(Boolean)
    .join("\n    ");

  html = html.replace("</head>", `    ${headExtra}\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  html = html.replace(
    "</body>",
    `  <script type="application/json" id="__VENDORS__">${vendorsJson}</script>\n  </body>`
  );
  return html;
}

function writeSitemap(entries) {
  const urls = entries
    .map(
      ({ loc, alternates }) => `  <url>
    <loc>${esc(loc)}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${esc(alternates.en)}" />
    <xhtml:link rel="alternate" hreflang="de" href="${esc(alternates.de)}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(alternates.xDefault)}" />
  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

async function main() {
  console.log(`[prerender] BUILD_STAMP ${process.env.BUILD_STAMP}`);

  // 1. Client-Build (Repo-Config inkl. base "/" und copy-provider-data).
  await build({ root, mode: "production", logLevel: "error" });

  // 2. SSR-Build.
  await build({
    configFile: false,
    root,
    base: "/",
    logLevel: "error",
    define: { __BUILD_TIME_ISO__: JSON.stringify(process.env.BUILD_STAMP) },
    plugins: [solid({ ssr: true })],
    build: {
      ssr: "src/ssr-entry.tsx",
      outDir: ".ssr-build",
      emptyOutDir: true,
      copyPublicDir: false,
      minify: false,
      sourcemap: false,
    },
  });

  const ssrEntry = pathToFileURL(resolve(SSR_OUT, "ssr-entry.js")).href;
  const { renderRoute, headTags, hydrationScript, embeddedVendorsJson } = await import(ssrEntry);

  const shell = readFileSync(resolve(DIST, "index.html"), "utf8");
  const hydration = hydrationScript();
  const vendorsJson = embeddedVendorsJson().replace(/</g, "\\u003c");

  // 404.html bewusst als leere SPA-Shell belassen (Client-Router fängt Deep-Links).
  writeFileSync(resolve(DIST, "404.html"), shell);

  const sitemapEntries = [];
  for (const lang of LANGS) {
    for (const route of ROUTES) {
      const path = fullPath(route, lang);
      const body = renderRoute(path, lang);
      const head = headTags(path, lang);
      const noindex = route === "/impressum" || route === "/datenschutz";
      const html = injectPage(shell, { body, head, hydration, vendorsJson, lang, noindex });
      const file = resolve(DIST, outFile(route, lang));
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, html);
      console.log(`[prerender] ${path} → dist/${outFile(route, lang)} (${html.length} bytes)`);

      if (!noindex && SITEMAP_ROUTES.includes(route)) {
        sitemapEntries.push({ loc: head.canonical, alternates: head.alternates });
      }
    }
  }

  const origin = sitemapEntries[0]?.alternates?.en
    ? new URL(sitemapEntries[0].alternates.en).origin
    : "https://ai-vendor-price-tracking.all-the.rest";
  writeFileSync(
    resolve(DIST, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`
  );
  writeFileSync(resolve(DIST, "sitemap.xml"), writeSitemap(sitemapEntries));
  console.log(`[prerender] robots.txt + sitemap.xml (${sitemapEntries.length} URLs)`);
}

main().catch((e) => {
  console.error(`[prerender] FEHLER: ${e instanceof Error ? e.stack || e.message : String(e)}`);
  process.exit(1);
});
