# Provider Plans

Preis-Tracking für Coding-Subscriptions mehrerer Anbieter — eine SPA mit einer Subseite je Provider.

**Site:** https://ai-vendor-price-tracking.all-the.rest · **Daten:** `/data/latest.zai.json`, `/data/latest.mimo.json`

## Was es ist

- **z.ai — GLM Coding Plan** (`/z-ai`): credit-basierter Plan, Credits pro Woche (Lite/Pro/Max),
  Off-Peak −50 % (Mo–Fr 14–18 SGT + ganze Wochenenden), Bindungs-Boni (Quartal −20 %, Jahr −30 %).
- **MiMo — Token Plan** (`/mimo`): monatliche Credit-Pakete, Nacht-Rabatt −20 % (Peking 00–08),
  Erstkauf −12 %, Jahresabonnement −12 %.
- **Übersicht** (`/`): Karten aller Vendors mit Kern-Statistiken.

Gleiche Komponenten für alle Vendors — aber eigene Umrechnungsformeln je Provider. Die API-Preise
werden „bei voller Nutzung“ so gut es geht in USD umgerechnet (Kreditkosten × USD/Credit), die Logik
steht in den Tooltips. Anfragemuster pro Modell werden aus der
[OpenCode-Go-Doku](https://opencode.ai/docs/de/go/) gescrapt.

## Lokal entwickeln

```bash
pnpm install
pnpm scrape:stub   # Offline-Verifikation der Scraper gegen tests/fixtures → data/stub/
pnpm test          # Parser- + Formel-Tests
pnpm dev           # Dev-Server (SPA-Router: /, /z-ai, /mimo)
pnpm scrape        # Live-Scrape (z.ai-Subscribe per Playwright, Fallback auf committete Preise)
pnpm build         # typecheck + build → dist/
pnpm preview
```

## Daten

Je Vendor unter `src/vendors/<id>/data/`:
- `latest.json` — Plans (Preis je Zyklus, Credits), Models (Credit-Kosten + API-Preise je Feld,
  Anfragemuster, peak/off-peak-Rows), Peak-Konfiguration
- `changelog.json` — Änderungs-Historie (bilinguale Einträge)
- `data/history.json` — Chronologie aller Snapshots

## Deployment

GitHub Pages (Custom Domain `ai-vendor-price-tracking.all-the.rest`), täglicher Cron + CI → deploy-pages.
Details in `AGENTS.md`.

## Lizenz

Projekt-Code: MIT. Preise gehören ihren jeweiligen Anbietern.