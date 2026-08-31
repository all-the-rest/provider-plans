# AGENTS.md

## Projektüberblick

Multi-Vendor-Preis-Tracker für Coding-Subscriptions: eine SPA (SolidJS) mit **einer Subseite pro
Provider** — z. B. `/` (Übersicht), `/z-ai` (GLM Coding Plan), `/mimo` (MiMo Token Plan). Gleiche
Komponenten für alle Vendors, aber **eigene Umrechnungsformeln je Vendor** (Credit-Pools, Peak-/
Off-Peak-Abzüge, Bindungs-Boni).

- Repo (geplant): `all-the-rest/provider-plans` · GitHub Pages Custom Domain:
  **`ai-vendor-price-tracking.all-the-rest`** (CNAME in `public/`, gesetzt).
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
pnpm build            # typecheck + vite build → dist/ (inkl. dist/404.html SPA-Fallback + dist/data/latest.<vendor>.json)
pnpm preview          # dist/ lokal serven (deep-link /z-ai testen)
pnpm typecheck        # nur tsc --noEmit
```

> **Daten-Commits:** `src/vendors/<vendor>/data/latest.json` + `data/history.json` +
> `src/vendors/<vendor>/data/changelog.json` werden bei Änderungen vom CI committet.

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
  per `<a href>` (Klicks werden abgefangen). Zustand (plan/basis/cycle/lang/theme) über URL-Query-Params
  + `history.replaceState` (pro Vendor-Seite), lang/theme zusätzlich in `localStorage`.
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
- **MiMo:** Credits direkte pro Tok (v2.5-pro: hit 2,5 / miss 300 / out 600; v2.5: 2/100/200) →
  `creditPerM` = ×1M. Nacht (Peking 00–08 = UTC 16–24) = **0,8×**. Monats-Credits direkt.
- **Requests/Monat = Monats-Credit-Pool ÷ (Kreditkosten pro Anfrage × Phase-Faktor)**.
- **Basis:** `list` = API-Listenpreis (USD/1M), `full` = Credit-Preis auf Listenpreis-Parität,
  `paid` = Credit-Preis auf tatsächlichem Monatspreis (inkl. Bindungs-Rabatt des Zyklus).

## UI-Regeln (daisyUI 5 / Tailwind 4)

- Nur daisyUI-/Tailwind-Klassen; semantische Farben (`base-*`, `primary`, `badge-*`), kein `dark:`.
- Kein `tailwind.config.js` — Tailwind 4: `@import "tailwindcss";` + `@plugin "daisyui";` in `src/index.css`.
- Sprache: localStorage `lang`, sonst Browser-Locale; Theme via `data-theme`.

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

## CI/CD (geplant: `.github/workflows/provider-plans.yml`)

- Trigger: täglicher Cron + `workflow_dispatch` + `push` auf `main`.
- Pipeline: install (`--frozen-lockfile`, esbuild-approve via pnpm-workspace.yaml) → `pnpm test` →
  `pnpm scrape` (z.ai-Plan-Preise per Playwright im Prebuilt-Browser-Image) → `pnpm build` →
  Commit (nur bei Änderung) → Release/RSS → deploy-pages (CNAME).
- `repository_dispatch` an `ai-10-usd` nur, wenn ein Vendor-Plan *unrabattiert* ≈ $10 erreicht
  (Flag in Config; aktuell kein Plan qualifiziert).

## Tests

- `tests/zai.test.ts` / `tests/mimo.test.ts` / `tests/patterns.test.ts` — Parser gegen Fixtures.
- `tests/formulas.test.ts` — Formel-Mathe gegen Vendor-Module (z. B. GLM-5.3 credits/request 9,683,
  Lite peak ≈ 4.131 Requests/Monat; MiMo-v2.5-pro credits/request 635.000, planValue ≈ 0,99).
- Fixtures sind fixiert — Tests müssen deterministisch laufen.

## Verifikation

Nach jeder Umsetzung prüft ein unabhängiger Agent: `pnpm test` grün, `pnpm typecheck` grün,
`pnpm build` grün, `dist/` enthält `data/latest.{zai,mimo}.json` + `404.html` + `CNAME`,
`pnpm preview` liefert 200 für `/`, `/z-ai`, `/mimo`. Node ≥ 22, pnpm aus `packageManager`.