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
- [ ] **Changelog-Event für Peak-Änderungen** — `buildChangelogEntries` (`scripts/lib.mjs`) vergleicht `peak` und `holidayCalendars` **nicht**; eine geänderte Peak-Regel (Fenster/Wochentage/Faktor/Feiertage) ist damit ein **stiller** Daten-Write ohne Changelog/Release. Bewusst so (Spezifikation §6/§8), aber offen: wer Peak-Änderungen sichtbar machen will, ergänzt ein `peak_changed`-Event in `buildChangelogEntries`.


## Peak-Regeln datengetrieben (2026-09-30, Spezifikation `peak-spec.md` §6)

Entscheidungen/Ergebnisse des Umbaus (`PeakConfig` von `windows` + `weekendOffPeak` +
`tzOffsetMin`/`timezoneLabel` auf `timezone` + `peak.days`/`peak.windowsUtc` +
`offPeak.days`/`allDay` + optionales `holidays`). **Eine** Form wie in `ocgo-price-tracker`
und `cc-price-tracker`.

- [x] **`weekendOffPeak` → `peak.days`/`offPeak.days` (ISO 1=Mo…7=So).** Der Wochentags-Scope
  war als Boolean + Prosa doppelt gepflegt; jetzt generiert `src/peakScope.ts` die Anzeige-Prosa
  aus `days`. `tzOffsetMin`/`timezoneLabel` → `timezone` (IANA). `windows` → `peak.windowsUtc`.
- [x] **zod-Invarianten** (`scripts/lib.mjs`: `assertPeakInvariants`, `assertHolidayCalendars`):
  Disjunktion, Union `{1..7}`, Fenster `0 ≤ s < e ≤ 24` + überlappungsfrei, gültige IANA-Zone,
  Kalender-Referenz, ISO/aufsteigend/`≤ coveredThrough`.
- [x] **Feiertagskalender als Handpflege-Konfiguration** `src/vendors/holidays.json` —
  **aktuell leer `{}`**, da **keine** permanente Vendor-Quelle Feiertage nennt (Entscheidung
  unten). Bewusst **kein** `chinese-days`/Generator in diesem Repo (Aufgabe der Scraper-Repos);
  die Konfiguration bleibt als familienweit einheitlicher Erweiterungspunkt erhalten.
- [x] **`holidays` für `zai` entfernt (quellenbindend).** Provenienz hart geprüft:
  `tests/fixtures/zai/overview.md:28,30` („During off-peak hours … 50 % …", „Peak hours:
  Monday to Friday, 14:00–18:00 Singapore Standard Time (UTC+8)") — **keine** Feiertage.
  Live ebenso (`docs.z.ai/devpack/overview.md`, `…/faq.md`, `…/usage-policy.md`). Der einzige
  „public holidays"-Treffer ist der **temporäre** Kampagnen-Hinweis
  `docs.z.ai/devpack/notice/event-glm-5.3-flash.md` (GLM-5.3-Flash, 03.09.–07.10.2026,
  23:00–09:00 SGT, Zero-Quota) — daraus wird nichts abgeleitet. `PeakConfig.holidays` bleibt
  optional (Familien-Form), kein Vendor nutzt es.
- [x] **Auswertung** `src/peakLogic.ts` (JSX-frei): Feiertagsdatum (falls `holidays` gesetzt)
  in `rule.timezone`; vor `effectiveFrom` gilt kein Peak. UI nur noch in `src/peak.tsx`.
  Tests: `tests/peak.test.ts`.
- [x] **Vendor-Migration:** `zai` (Asia/Singapore, Mo–Fr, Sa/So off-peak, **kein** `holidays`),
  `mimo` (Asia/Shanghai, täglich, **kein** Wochenend-/Feiertags-Sonderfall), `ollama` (UTC, Mo–Fr).
  Scraper (`scrape-{zai,mimo,ollama}.mjs`) erzeugen den Block über `buildPeakConfig`.
- [x] **Pre-existing Test-Drift gefixt:** `tests/formulas.test.ts` war bereits auf HEAD rot
  (Commit `82dbb7a` „update prices 2026-09-29" hat Pattern/Multiplier geändert); Erwartungen
  an die aktuellen Daten angepasst (9,308 statt 9,683; 475.300 statt 635.000 usw.). Kein
  Peak-Bezug — rein Daten-Drift.

**Abweichungen zur Spezifikation (dokumentiert, kleinste semantisch korrekte Variante):**

- **`offPeak.days` darf leer sein — repo-übergreifende Regel.** §1.2 fordert „nicht leer", §6
  setzt für `mimo` aber `offPeak.days: []` — Widerspruch. Gültig in **allen** Tracker-Repos
  (`ocgo`/`cc` identisch, damit niemand eine strengere Variante fährt): **`peak.days` nie leer,
  `offPeak.days` darf leer sein**; Partition `{1..7}` bleibt erzwungen.
- **`effectiveFrom`-Anzeige:** §2 will die Vorlaufzeit „als solche kennzeichnen". Nicht umgesetzt,
  weil bei allen Vendors `effectiveFrom` in der Vergangenheit bzw. `null` ist (zustandslos) und
  eine eigene UI-Kennzeichnung außerhalb des Peak-Umbaus wäre. Verhalten ist korrekt: vor
  `effectiveFromMs` → Off-Peak.
- **Keine `chinese-days`-Frische-Guard/Kalender-Wartung** und **kein §7a-Footer** in diesem Repo
  (§7/§7a sind für `ocgo`/`cc`). Da `holidays`/der Kalender hier leer sind, gibt es derzeit
  nichts zu altern; sobald ein Kalender dazukommt, bleibt `coveredThrough` das ehrliche Datum.
- **Kein Prosa-`ScrapeError`** für „fehlender Wochentags-Scope"/„Feiertag ohne Land": provider-plans
  hat keinen Prosa-Wochentagsparser — `days` sind Scraper-Konfiguration, `holidays` wird nur bei
  belegter Quelle gesetzt (derzeit nirgends).

## Verworfen (nicht erneut implementieren)

- **`weekendOffPeak`/`tzOffsetMin`/`timezoneLabel` parallel beibehalten** — verworfen: die
  Spezifikation verlangt **eine** Form; Doppelpflege war genau das Problem. Nicht wieder einführen.
- **Feiertage für `zai` aus dem Kampagnen-Hinweis ableiten** — verworfen: „public holidays" steht
  nur im **temporären** Aktionsfenster (GLM-5.3-Flash, 03.09.–07.10.2026), nicht in der permanenten
  Peak-Regel. Quellenbindend wie `ocgo`/`cc`: kein `holidays` ohne permanente Belegstelle.
  Nicht wieder aus der Kampagne rekonstruieren.
- **Feiertagskalender per `chinese-days` in diesem Repo erzeugen** — verworfen: das ist Aufgabe
  der Scraper-Repos; hier bleibt es eine Handpflege-Konfiguration.

## Browser-Konsolen-Test (Playwright, Follow-up zum Smoke-Test)
- [ ] Playwright-Test, der die Seite im echten Browser lädt und Konsolen-Fehler/pageerrors
  als Fehler wertet (fängt JS-Laufzeitfehler, die Build + `pnpm smoke` nicht sehen).
  Eigene Suite/config (nicht in die Screenshot-Suite — die bleibt assertion-frei),
  in CI nach dem Smoke-Step. Browser via Container-Image oder `playwright install`.
