# AGENTS.todo.md

Aus `AGENTS.md` ausgelagerte TODOs — verifiziert am 2026-09-01.

## Verifiziert abgeschlossen (aus TODO entfernt)

- `Repo (geplant): all-the-rest/provider-plans` — Repo existiert, Push `080cc70` erfolgreich, Pages-Domain `ai-vendor-price-tracking.all-the-rest` (CNAME `public/CNAME`) aktiv.
- `CI/CD (geplant: .github/workflows/provider-plans.yml)` — Workflow existiert (`provider-plans.yml:1`), Trigger `schedule`/`workflow_dispatch`/`push`, Container `mcr.microsoft.com/playwright:v1.62.1-jammy`, Steps `pnpm test`/`scrape`/`build`/`commit` vorhanden.

`AGENTS.md` enthält nun `Repo:` und `CI/CD (.github/workflows/provider-plans.yml)` ohne `(geplant)`-Marker (`AGENTS.md:10`, `AGENTS.md:98`), `grep -rn "geplant\|TODO\|FIXME" AGENTS.md` ohne Treffer.

## Offen — noch nicht umgesetzt (aus OpenCode-Plänen / Referenz-Tracker übernommen)

Quelle: manuelle Übernahme-Muster aus `~/dev/cc-price-tracker` und `~/dev/ocgo-price-tracker` (AGENTS.md:12), bisher nur Pattern-Quelle `opencode.ai/docs/de/go/` genutzt.

- [ ] **OpenCode Go als eigener Vendor** — analog `ocgo-price-tracker` als `src/vendors/opencode/` (Preistabelle mit `usage`/`multiplier`/`effective*`, `freeModels`, `privacy`, `capabilities` via `@opencode-ai/models`). Bisher nur `src/vendors/stats/opencode-patterns.json` als Pattern-Fallback.
- [ ] **Dynamisches Monatsguthaben/Monatspreis** — `ocgo` `parseMonthlyPricing`/`parseMonthlyCost`/`parseCreditFactor` (CTA `[data-slot="cta-price-old"]`/`cta-price` × Prosa-Faktor „das Sechsfache“ = 6, Fallback 60/10). Provider-Plans nutzt je Vendor statische `creditsWeekly`/`creditsMonthly` und feste `priceMonthly`, kein dynamischer Credit-Fallback.
- [ ] **Nutzungs-Boni (2x usage)** — `ocgo` `fetchUsageBonuses`/`applyUsageBonuses` (`<span data-bonus>2x usage</span>`, `data-model`-Slug). In provider-plans für z.ai/MiMo nicht abgebildet (dort Off-Peak/Nacht-Rabatt statt Bonus).
- [ ] **Privacy-Tabelle + Capabilities voll** — `ocgo` `privacy` (`training`/`retentionDays`/`validUntil`/`fallback`) + `capabilities` (`input`/`output`/`reasoning`/`toolCall`) aus `models.dev` via `@opencode-ai/models` (Live + Snapshot, `CAPABILITY_OVERRIDES`). Provider-Plans nur `contextWindow`/`provider` ( `loadModelsDev` + Overrides, `AGENTS.md:Architektur`).
- [ ] **Free-Models (Zen)** — `ocgo` `extractFreeModelsFromDocs` (`opencode.ai/docs/de/zen/`, `availableFrom`, `privacy.training=true`). In provider-plans nicht als Datenmodell vorhanden (`src/types.ts:VendorId` nur `zai|mimo|ollama`).
- [ ] **Feingranularer Changelog** — `ocgo` Events `price_changed` (fields), `usage_changed`, `capabilities_changed`, `privacy_changed`, `free_added/removed` (zod, `validateSnapshot`/`validateChangelog`). Provider-Plans Changelog nur generisch (`src/vendors/*/data/changelog.json`), kein Field-Diff.
- [ ] **Bonus/Privacy-Diff & stille Updates** — `ocgo` `privacySilentUpdate`/`validUntil`-still, `monthlyPricingChanged` ohne Changelog, `recomputeUsageDerived` nach Bonus. Für provider-plans analog zu prüfen (Off-Peak-Wechsel vs. Bonus).

