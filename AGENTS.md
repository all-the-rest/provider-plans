# AGENTS.md

## Projektüberblick

Multi-Vendor-Preis-Tracker für Coding-Subscriptions: eine SPA (SolidJS) mit **einer Subseite pro
Provider** — z. B. `/` (Übersicht), `/z-ai` (GLM Coding Plan), `/mimo` (MiMo Token Plan). Gleiche
Komponenten für alle Vendors, aber **eigene Umrechnungsformeln je Vendor** (Credit-Pools, Peak-/
Off-Peak-Abzüge, Bindungs-Boni).

- Repo: `all-the-rest/provider-plans` · GitHub Pages Custom Domain:
  **`ai-vendor-price-tracking.all-the.rest`** (CNAME in `public/`, gesetzt).
- Referenz-Vorlagen: `~/dev/cc-price-tracker` (Komponenten/Formel-Layer), `~/dev/ocgo-price-tracker`
  (Peak-/Lokalzeit-Logik, Pattern-Parser). Übernahme erfolgt bewusst **manuell** (Muster, kein Copy-Paste-Fork).

## Stack

- SolidJS 1.9 + Vite 8 (`vite-plugin-solid`), TypeScript 7 strict (`tsc --noEmit`), Node ≥ 22
- Tailwind CSS 4 + daisyUI 5 (`pnpm-workspace.yaml`: `allowBuilds.esbuild: true`/`onlyBuiltDependencies`)
- Scraper: Node ESM (`scripts/*.mjs`, cheerio + zod), z.ai-Plan-Preise per **Playwright** (CI-Image)
- Paketmanager: pnpm — `packageManager` in `package.json` ist maßgeblich
- Tests: `node --import tsx --test` (tsx importiert TS/JSON; `tests/**/*.test.ts`)

## Befehle

```bash
pnpm install          # Lockfile versioniert; esbuild-Build via pnpm-workspace.yaml
pnpm scrape           # Live: alle Vendors + Anfragemuster holen (z.ai-Subscribe per Playwright, Fallback committet)
pnpm scrape:stub      # Offline: alle Parser gegen tests/fixtures → data/stub/ (Verifikation ohne Netz)
pnpm test             # Tests: Parser gegen Stubs + Formeln (Vendor-Module)
pnpm dev              # Dev-Server (SPA mit clientseitigem Router)
pnpm build            # typecheck + Prerender (scripts/prerender.mjs) → dist/ (Routen-HTML, 404.html, robots.txt, sitemap.xml, data/latest.<vendor>.json)
pnpm preview          # dist/ lokal serven (deep-link /z-ai testen)
pnpm smoke            # Smoke-Test auf dist/: Artefakte + Assets + Preview-HTTP (/, /de/, /z-ai/, robots.txt, sitemap.xml, /data/latest.<vendor>.json) — ohne Browser
pnpm typecheck        # nur tsc --noEmit
```

> **Daten-Commits:** `src/vendors/<vendor>/data/latest.json` + `data/history.json` +
> `src/vendors/<vendor>/data/changelog.json` werden bei Änderungen vom CI committet.
> **Changelog-Bremse:** max. 1 Eintrag pro Tag und Vendor — Same-Day-Changes werden in den
> neuesten Eintrag gemergt (`mergeChangelog`/`mergeChangeLists` in `scripts/lib.mjs`).

## Architektur

- **`src/vendors/<id>/`** ist ein abgeschlossenes Vendor-Modul (`index.ts`: `VendorModule`,
  `formulas.ts`, `peak.ts`, `i18n.ts`, `data/latest.json`, `data/changelog.json`).
- **`src/vendors/shared.ts`** — gemeinsame Formel-Helfer (`monthlyCredits` **Woche × 4**,
  `planPriceMonth`, `patternCost`, `patternApiCost`, `usdPerCredit`, `fieldPriceUsd`,
  `requestsPerMonth`). `Formulas`-Interface dient als Vertrag für alle UI-Komponenten.
- **`src/vendors/registry.ts`** — Auflistung aller Module (Übersicht + Routing + Header-Nav).
- **Geteilte UI** (`src/components/*`): Header/, StartPage, Hero, PlanTabs, PriceTable,
  PlanComparison, Changelog, Legal, Footer, Tooltip, Heading, PeakIndicator (`src/peak.tsx`).
  Komponenten lesen **nie** vendor-spezifische Typen — nur `VendorModule`.
- **Router** (`src/router.tsx`): Mini-Router über `location.pathname` + `popstate`; interne Links
  per `<a href>` (Klicks werden abgefangen). Pfade werden normalisiert (`/z-ai/` → `/z-ai`, Query/Hash
  getrennt), `RouterProvider` akzeptiert `initialPath` für den SSR-Lauf. Zustand
  (plan/basis/cycle/lang/theme) über URL-Query-Params + `history.replaceState` (pro Vendor-Seite),
  lang/theme zusätzlich in `localStorage`. Sprach-Subrouten: `/` = Englisch (Default), `/de/` = Deutsch.
- **Anfragemuster** kommen gescrapt von `opencode.ai/docs/de/go/` →
  kommittierter Snapshot `src/vendors/stats/opencode-patterns.json` (Offline-Fallback für Builds).

## Datenquellen

| Quelle | Inhalt | Technik |
|---|---|---|
| `docs.z.ai/devpack/overview.md` + `…/guides/overview/pricing.md` | Credit-Multiplier, 5h/Wochen-Credits, Peak-Zeiten, API-Preise | `scripts/scrape-zai.mjs` (Playwright nur für Subscribe-Preise) |
| `z.ai/subscribe` | Plan-Preise (Monat/Quartal/Jahr — client-rendered) | Playwright; **Fallback auf committete Preise** wenn Browser fehlt; Stub `tests/fixtures/zai/subscribe.html` |
| `mimo.mi.com/docs/…/token-plan` + `…/pay-as-you-go` | Pläne, Credits, Nacht-Rabatt, API-Preise | `scripts/scrape-mimo.mjs` (Cheerio/Markdown) |
| `opencode.ai/docs/de/go/` | Anfragemuster je Modell (Tokens/Anfrage) | `scripts/extract-patterns.mjs` |

**Lokale Stubs für Tests:** `tests/fixtures/{zai,mimo,opencode}/*` — die Parser-Kernfunktionen
(`parseZaiOverview`, `parseZaiPricing`, `parseZaiSubscribe`, `parseMimoTokenPlan`,
`parseMimoApiPricing`, `parsePatternItems`) sind pur und werden in Tests gegen diese Stubs geprüft.

## Formel-Zusammenfassung (je Vendor in `formulas.ts`)

- **z.ai:** `credits/Tok = multiplier / 10.000` (GLM-5.3: 6,9/1,7/24; Flash: 2,3/0,56/8) →
  `creditPerM` = ×1M. Off-Peak (Mo–Fr 14–18 SGT + ganze Wochenenden) = **50 % Credits**.
  Wochen-Credits × 4 = Monats-Pool.
- **MiMo:** Credits direkte pro Tok (v2.6-pro: hit 2,5 / miss 300 / out 600; v2.6-flash: 2/100/200) →
  `creditPerM` = ×1M. Nacht (Peking 00–08 = UTC 16–24) = **0,8×**. Monats-Credits direkt.
- **Requests/Monat = Monats-Credit-Pool ÷ (Kreditkosten pro Anfrage × Phase-Faktor)**.
- **Basis:** `list` = API-Listenpreis (USD/1M), `full` = Credit-Preis auf Listenpreis-Parität,
  `paid` = Credit-Preis auf tatsächlichem Monatspreis (inkl. Bindungs-Rabatt des Zyklus).

## UI-Regeln (daisyUI 5 / Tailwind 4)

- Nur daisyUI-/Tailwind-Klassen; semantische Farben (`base-*`, `primary`, `badge-*`), kein `dark:`.
- Kein `tailwind.config.js` — Tailwind 4: `@import "tailwindcss";` + `@plugin "daisyui";` in `src/index.css`.
- Sprache: **Englisch ist Default** unter `/`, Deutsch als echte Subroute `/de/` (je eigenes
  vorgerendertes HTML). Der Pfad ist die Quelle der Wahrheit; gespeicherte Sprache (`localStorage lang`),
  `?lang=de|en` (Alias) und Browser-Sprache werden erst NACH der Hydration angewandt. Theme via `data-theme`.

## SEO / Prerender + Routen (HTTP 200)

- **Statisches Pre-Rendering:** `pnpm build` = `tsc --noEmit && node scripts/prerender.mjs`. Das Skript
  baut zuerst den Client (Repo-Vite-Config), dann die App als SSR-Bundle (`.ssr-build/`, `src/ssr-entry.tsx`,
  Solid `renderToString`) und ersetzt den leeren `<div id="root">` in den HTML-Dateien durch das
  vorgerenderte Markup. Crawler ohne JS sehen damit Pläne, Preise, Modell-Übersicht, Ranking und FAQ.
- **`base: "/"`** (Custom Domain am Root) → absolute Asset-Pfade, damit auch Unterrouten (`/de/`, `/z-ai/`)
  korrekt laden. Vorher `base: "./"` brach die Assets unter `/de/`.
- **Routen-Dateien (HTTP 200, echte Dateien statt SPA-Fallback):**
  `dist/index.html` (en), `dist/z-ai/index.html`, `dist/mimo/index.html`, `dist/ollama/index.html`,
  `dist/de/index.html` (de) sowie `dist/de/{z-ai,mimo,ollama}/index.html`; Legal-Seiten
  `dist/{impressum,datenschutz}/index.html` + `/de/…` (bewusst als eigene Dateien mit HTTP 200, aber
  `noindex,follow`). `dist/404.html` bleibt die leere SPA-Shell (Fallback für unbekannte Pfade).
  GitHub Pages löst `/z-ai` → 301 auf `/z-ai/` (Verzeichnis-Index) auf; Canonical/Sitemap nutzen daher
  die Trailing-Slash-Form.
- **Hydration:** `src/index.tsx` ruft `hydrate()` (Fallback `render()` ohne Prerender). Der Client-Build
  nutzt `solid({ ssr: true })` → `generate: "dom", hydratable: true` (nur so findet `hydrate()` die
  Server-Marker); der SSR-Build nutzt `solid({ ssr: true })` im Server-Environment → `generate: "ssr"`.
  `generateHydrationScript()` (re-exportiert aus `src/ssr-entry.tsx`) wird pro HTML-Datei in den `<head>`
  injiziert — ohne `window._$HY` wirft `hydrate()` und die Seite bleibt nicht-interaktiv.
- **Synchroner Client-Zustand:** Der beim Prerender als JSON eingebettete Vendor-Zustand
  (`<script type="application/json" id="__VENDORS__">`) wird in `src/vendors/embed.ts` synchron
  rekonstruiert (Formeln via statisch importierte Factories) — dadurch passt der Client-Erstrender exakt
  zum Server-HTML. `loadAllVendors()` bleibt nur Fallback (Dev-Server ohne Prerender).
- **Sprach-Routing:** Client-Erstrender = Pfad-Sprache (`/de…` → de, sonst en). Nach `onMount`:
  `?lang=de|en` (Alias) → kanonische Pfadform via `replaceState`; auf der präfixlosen `/` gespeicherte
  Sprache, sonst Browser-Sprache (`navigator.language` beginnt mit `de` → `/de/`), sonst Englisch.
  `/de/` wird nie auf Englisch überschrieben. Der Sprachumschalter navigiert per `pushState` zwischen
  `/` und `/de/` und behält **alle** Query-Params (außer `lang`) + Hash. SSR/Crawler sehen auf `/` immer Englisch.
- **Head-SEO (build-generiert in `scripts/prerender.mjs`, Client-Update via `src/seo.ts:applyHead`):**
  Title/Description je Route und Sprache, Canonical je Datei auf die eigene Sprach-URL, `hreflang`
  `en`/`de`/`x-default`, `og:locale` (`en_US`/`de_DE`) + `og:locale:alternate`, RSS-Autodiscovery
  (`releases.atom`), JSON-LD (`Product`/`Offer` + `ItemList`; Home zusätzlich `WebSite`).
  Dazu `dist/robots.txt` und `dist/sitemap.xml` (beide Sprach-URLs).
- **Inhalte (server- und clientseitig identisch):** „Was bringt dir der Plan?" (`src/components/PlanValue.tsx`),
  „Modell-Übersicht" (`ModelOverview.tsx`),
  Startseiten-Ranking (`VendorRanking.tsx`). Keine `Date`/`window`-Abhängigkeit im Rendering.
- **Build-Stempel:** `process.env.BUILD_STAMP` wird einmalig in `scripts/prerender.mjs` gesetzt;
  `vite.config.ts` nutzt ihn für `__BUILD_TIME_ISO__` → Client und SSR zeigen denselben „Stand".
- **Tests:** `tests/seo.test.ts` prüft `dist/` (skip ohne Build); `scripts/smoke.mjs` prüft nach dem Build
  `/`, `/de/`, `/z-ai/` … (HTTP 200, `<h1>`, JSON-LD, `_$HY`) sowie `robots.txt`/`sitemap.xml`.

## Scrum/Arbeitsweise (Orchestrierung + Verifikation)

- **Der Build-Agent orchestriert zum überwiegenden Teil** und delegiert unabhängige Arbeitspakete an
  parallele Subagenten (z. B. Vendor-Module, Scraper/Tests, UI-Komponenten).
- **Kleine Änderungen** (einzelne Edits, Versionskosmetik) macht er direkt selbst.
- **Initialer Wurf** (Scaffolding, Router, App-Shell, Fixture-Stubs, i18n-Shell) wurde direkt vom
  Orchestrator erstellt — künftige größere Arbeiten wieder nach Delegations-Muster.
- **Unabhängige Verifikation:** Nach jeder Umsetzung prüft ein separater Verify-Agent (frischer
  Kontext, keine Annahmen) in `~/dev/provider-plans`:
  `pnpm typecheck`, `pnpm test`, `pnpm scrape:stub`, `pnpm build`, `pnpm preview`-200 plus
  `/z-ai`/`/mimo` Deep-Links und `dist/404.html`-Vorhandensein; Stub-Output vs. committete Daten abgleichen.
- **Screenshot-Pflicht:** Jede UI-Änderung mit visueller Wirkung muss permanente Captures in
  `tests/screenshots/` mitliefern (Manifest-Eintrag oder eigene Capture-only-Spec wie
  `share-dialog.spec.ts`); ein-/tmp-Skripte sind kein Ersatz. Vor Abschluss
  `pnpm test:screenshots` für die betroffenen Routen laufen lassen.

## CI/CD (`.github/workflows/provider-plans.yml`)

- Trigger: täglicher Cron + `workflow_dispatch` + `push` auf `main`.
- Pipeline: install (`--frozen-lockfile`, esbuild-approve via pnpm-workspace.yaml) →
  `pnpm test` (**nur** bei `push`/`pull_request` — `if: github.event_name == 'push' \|\| github.event_name == 'pull_request'`;
  bei `schedule`/`workflow_dispatch` übersprungen, da der Code unverändert ist) →
  `pnpm scrape` (z.ai-Plan-Preise per Playwright im Prebuilt-Browser-Image) → `pnpm build` →
  `pnpm smoke` (bricht rot ab, bevor kaputte Bundles auf Pages landen) →
  Commit (nur bei Änderung) → Release/RSS → deploy-pages (CNAME).
- `repository_dispatch` an `ai-10-usd` nur, wenn ein Vendor-Plan *unrabattiert* ≈ $10 erreicht
  (Flag in Config; aktuell kein Plan qualifiziert).

## Tests

- `tests/zai.test.ts` / `tests/mimo.test.ts` / `tests/patterns.test.ts` — Parser gegen Fixtures.
- `tests/formulas.test.ts` — Formel-Mathe gegen Vendor-Module (z. B. GLM-5.3 credits/request 9,683,
  Lite peak ≈ 4.131 Requests/Monat; MiMo-v2.6-pro credits/request 635.000, planValue ≈ 0,99).
- Fixtures sind fixiert — Tests müssen deterministisch laufen.

## Schwester-Projekte (Git-Remotes)

Tracker-Familie (alle unter `all-the-rest/`): `ocgo-price-tracker`, `ai-10-usd`,
`cc-price-tracker`, `provider-plans` (dieses Repo, `origin`). Lokale Checkouts als
Referenz-Vorlagen: `~/dev/cc-price-tracker`, `~/dev/ocgo-price-tracker` (siehe oben).

```bash
git remote add ocgo-price-tracker https://github.com/all-the-rest/ocgo-price-tracker.git
git remote add ai-10-usd https://github.com/all-the-rest/ai-10-usd.git
git remote add cc-price-tracker https://github.com/all-the-rest/cc-price-tracker.git
```

Vergleichen (read-only, `origin` bleibt unberührt):

```bash
git ls-remote ocgo-price-tracker HEAD
git log --oneline origin/main..ocgo-price-tracker/main --no-decorate | head
```

## Verifikation

Nach jeder Umsetzung prüft ein unabhängiger Agent: `pnpm test` grün, `pnpm typecheck` grün,
`pnpm build` grün, `pnpm smoke` grün, `dist/` enthält `data/latest.{zai,mimo,ollama}.json` + `404.html` + `CNAME`,
`pnpm preview` liefert 200 für `/`, `/z-ai`, `/mimo`. Node ≥ 22, pnpm aus `packageManager`.