# Provider Plans — AI Coding-Subscriptions im Vergleich

Preis-Tracking für Coding-Subscriptions **mehrerer Anbieter** auf einer Seite —
eine SPA mit einer **Subseite je Provider**, gemeinsamen Komponenten und **eigenen
Umrechnungsformeln je Vendor** (Credit-Pools, Peak/Off-Peak-Abzüge, Bindungs-Boni).

**Site:** https://ai-vendor-price-tracking.all-the.rest
**Daten:** `/data/latest.zai.json` · `/data/latest.mimo.json` (maschinenlesbar)
**Repo:** [all-the-rest/provider-plans](https://github.com/all-the-rest/provider-plans)

## Seiten & Routen

| Route | Inhalt |
|---|---|
| `/` | Übersicht aller Vendors mit Kern-Statistiken und CTA |
| `/z-ai` | **z.ai — GLM Coding Plan** (Lite/Pro/Max), Credits/Woche, Off-Peak −50 %, Wochenende |
| `/mimo` | **Xiaomi MiMo — Token Plan** (Lite/Standard/Pro/Max), Monats-Credits, Nacht-Rabatt −20 % |
| `/impressum`, `/datenschutz` | Eigene Rechtsseiten (keine Duplikation auf den Vendor-Seiten) |

## Features

- **Gleiche UI, getrennte Formeln:** Jeder Vendor ist ein Modul (`src/vendors/<id>/`),
  das die gemeinsamen `Formulas`/`PeakConfig`-Interfaces implementiert — Preistabelle,
  Plan-Vergleich, Changelog usw. bleiben vendor-neutral. Neue Vendors = neuer Ordner +
  Registry-Eintrag.
- **Preisbasis umschaltbar:** `API-Listenpreis` (USD/1M Tokens, Pay-as-you-go) ·
  `Credit-Pool` (Kreditkosten auf Listenpreis-/Credit-Parität) · `Was du zahlst`
  (inkl. Rabatt des gewählten Abrechnungszyklus).
- **Abrechnungszyklus oben** (Monat/Quartal/Jahr): ändert Preis & Wert live; es werden
  nur Zyklen gezeigt, die der Anbieter tatsächlich führt (MiMo z. B. kein Quartal).
- **Peak/Off-Peak als zwei Zeilen** je Modell: die aktuell inaktive Zeile ist ausgegraut
  und zeigt einen Live-Countdown bis zum nächsten Wechsel (z. B. z.ai: Mo–Fr 14–18 Uhr
  SGT, MiMo: Peking 00–08 Uhr = UTC 16–24, inkl. Wochenende-Regeln).
- **Requests/Monat** auf Basis gescrappter **Anfragemuster** aus der
  [OpenCode-Go-Doku](https://opencode.ai/docs/de/go/); Monats-Pool = Wochen-Credits × 4
  („4 Wochen pro Monat") bzw. Monats-Credits direkt.
- **USD/Umrechnung transparent:** die Logik hinter `≈ $/Anfrage` und `Requests/Monat`
  steht in den Tooltips.
- **Bindungs-Boni:** Jahr/Quartal-Rabatte (z.ai −30 %/−20 %), MiMo Jahr −12 % + Erstkauf
  −12 %, im Plan-Vergleich sichtbar.
- **Changelog** je Vendor mit Pagination, **GitHub-Releases + RSS** automatisiert aus den
  Changelog-Einträgen (Release-Tag = Run-id).

## Stack

- SolidJS 1.9 + Vite 8 + TypeScript 7 (strict) · Tailwind CSS 4 + daisyUI 5 · pnpm
- Scraper: Node ESM (`scripts/*.mjs`, cheerio + zod); z.ai-Plan-Preise per **Playwright**
- Tests: Unit/Parser-Tests (tsx + `node --test`), **Playwright-UI-E2E** und Screenshot-Set

## Lokal entwickeln

```bash
pnpm install           # Lockfile versioniert; esbuild-Build via pnpm-workspace.yaml
pnpm dev               # Dev-Server (http://localhost:5174)
pnpm test              # Parser- + Formel-Tests (15)
pnpm test:e2e          # Playwright-UI-Tests (Sprache, Cycle, CTA, Badges, Peak-UI, Rechtsseiten)
pnpm test:screenshots  # Screenshot-Set (Desktop/Mobile) → test-results/ui-screenshots
pnpm scrape:stub       # Offline: Scraper gegen tests/fixtures → data/stub/ (kein Netz)
pnpm scrape            # Live: alle Daten + Anfragemuster holen (z.ai-Subscribe per Playwright, Fallback committet)
pnpm release:notes     # Neueste Release-Notizen anzeigen
pnpm typecheck
pnpm build             # typecheck + vite build → dist/ (inkl. 404.html-SPA-Fallback, dist/data/*.json, CNAME)
pnpm preview           # build testen (Deep-Links wie /z-ai liefern 200)
```

## Datenmodell (`src/vendors/<id>/data/latest.json`)

```jsonc
{
  "vendorId": "zai" | "mimo",
  "fetchedAt": "…",
  "sourceUrls": [ "…" ],
  "plans": [{
    "id": "lite", "name": "Lite", "kind": "weekly" | "monthly",
    "priceMonthly": 18, "priceQuarterlyMonthly": 14.4, "priceYearlyMonthly": 12.6,
    "credits5h": 2000, "creditsWeekly": 10000, "creditsMonthly": null,
    "notes": "Quartal −20 % · Jahr −30 %", "sourceUrl": "…"
  }],
  "models": [{
    "id": "glm-5.3", "name": "GLM-5.3", "tier": "peak" | "off-peak" | null,
    "contextWindow": 1000000,
    "creditPerM": { "input": 690, "cached": 170, "output": 2400 },   // Credits/1M Tokens (Feld je Vendor)
    "apiPrice":   { "input": 1.4,  "cached": 0.26, "output": 4.4 },  // USD/1M Tokens
    "pattern": { "input": 700, "cached": 52000, "output": 150 },     // OpenCode-Doku
    "note": null
  }],
  "peak": { "windows": [[6,10]], "phaseFactor": { "peak": 1, "off-peak": 0.5 },
            "weekendOffPeak": true, "tzOffsetMin": 480,
            "timezoneLabel": "SGT (UTC+8)", "phaseLabel": { "peak": "Peak", "off-peak": "Off-Peak" },
            "effectiveFromMs": … }
}
```

- MiMo nutzt zusätzlich das Feld `inputMiss` (Cache-Miss) in `creditPerM`/`apiPrice`;
  das Pattern-Mapping ist vendor-spezifisch (z. B. MiMo: Pattern-Input → `inputMiss`).
- `derived`: `creditsPerRequest` = Pattern × Credit-Kosten; `requestsPerMonth` =
  Monats-Credit-Pool ÷ (Credits/Anfrage × Phasen-Faktor).

## Architektur

```
src/
  vendors/            // je Modul: index.ts, formulas.ts, peak.ts, i18n.ts, data/*.json
    shared.ts         // gemeinsame Formel-Helfer (Woche×4, fieldPrice, requestsPerMonth, …)
    registry.ts       // alle Module (Routing, Übersicht, Header)
    stats/opencode-patterns.json   // kommittierter Pattern-Snapshot (Offline-Fallback)
  components/         // geteilte UI (Header, Hero, PlanTabs, PriceTable, PlanComparison, …)
  pages/LegalPage.tsx // Impressum/Datenschutz als eigene Seiten
  router.tsx          // Mini-Router (clientseitig, History-API)
  AppRoutes.tsx       // Routen: /, /z-ai, /mimo, /impressum, /datenschutz
```

Details, Datenquellen und Arbeitsweise (Delegation + unabhängige Verifikation) siehe
[`AGENTS.md`](AGENTS.md).

## Quellen

- z.ai: [DevPack-Übersicht](https://docs.z.ai/devpack/overview) · [API-Preise](https://docs.z.ai/guides/overview/pricing) · [Subscribe](https://z.ai/subscribe)
- MiMo: [Token Plan](https://mimo.mi.com/docs/en-US/price/token-plan) · [Pay-as-you-go](https://mimo.mi.com/docs/en-US/price/pay-as-you-go)
- Anfragemuster: [OpenCode Go Doku](https://opencode.ai/docs/de/go/)

## CI/CD

`.github/workflows/provider-plans.yml`: täglicher Cron + `workflow_dispatch` + `push` →
install → test → Playwright-Browser → live-scrape → build → Daten-Commit (nur bei
Änderung) → **GitHub-Release pro Changelog-Tag** (`ensure-release`, `check-release-sync`) →
deploy-pages. Um Preisänderungen per E-Mail zu verfolgen: Repo unter
`Watch → Releases` beobachten.

## Lizenz

Projekt-Code: MIT. Preise gehören ihren jeweiligen Anbietern.