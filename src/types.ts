export type Lang = "de" | "en";

export type VendorId = "zai" | "mimo";

export type Phase = "peak" | "off-peak";

/** Abrechnungszyklus („Bindungs-Bonus"). */
export type Cycle = "monthly" | "quarterly" | "yearly";

/** Preisbasis in der Tabelle. `paid` entfällt — kein Provider verspricht $-Nutzung. */
export type Basis = "list" | "full";

/** Primäre Credit-Pool-Einheit eines Plans: wöchentlich (z.ai) vs. monatlich (MiMo). */
export type PoolKind = "weekly" | "monthly";

export interface Plan {
  id: string;
  name: string;
  kind: PoolKind;
  /** USD, monatliche Abrechnung (Listenpreis). */
  priceMonthly: number;
  /** Effektiver Monatspreis bei Quartals-Abrechnung (Listenpreis). */
  priceQuarterlyMonthly: number | null;
  /** Effektiver Monatspreis bei Jahres-Abrechnung (Listenpreis). */
  priceYearlyMonthly: number | null;
  credits5h: number | null;
  creditsWeekly: number | null;
  creditsMonthly: number | null;
  notes: string | null;
  sourceUrl: string;
}

/**
 * Creditschlüssel je Modell. z.ai: `input`/`cached`/`output` (über Multiplikatoren,
 * Credits pro 1M Tokens). MiMo: `input` = Cache-Hit, `inputMiss` = Cache-Miss,
 * `output` (Credits pro 1M Tokens direkt).
 */
export type CreditField = "input" | "cached" | "output" | "inputMiss";

export interface RequestPattern {
  input: number;
  cached: number;
  output: number;
}

export interface Model {
  id: string;
  name: string;
  /** Hersteller-Anzeigename (Overwrite via models.dev + Vendor-Overrides). */
  provider: string | null;
  tier: Phase | null;
  contextWindow: number | null;
  /** Credits pro 1M Tokens je CreditField (deterministisch aus der Provider-Formel). */
  creditPerM: Partial<Record<CreditField, number>>;
  /** Pay-as-you-go API-Preis (USD pro 1M Tokens) je CreditField. */
  apiPrice: Partial<Record<CreditField, number>>;
  /** Beobachtetes Anfragemuster (Input/Cached/Output pro Anfrage) — OpenCode-Doku. */
  pattern: RequestPattern | null;
  note: string | null;
}

export interface PeakConfig {
  /** UTC-Stunden-Fenster [start, end) — z.B. [[6,10]] für SGT Mo–Fr 14–18. */
  windows: [number, number][];
  /** Credit-Faktor je Phase: `peak` = 1.0 (Basis), `off-peak` = z. B. 0.5 / 0.8. */
  phaseFactor: Record<Phase, number>;
  /** Wochenenden (Vendor-Zeitzone) durchgehend off-peak? z.ai: ja, MiMo: nein. */
  weekendOffPeak: boolean;
  /** Zeitzonen-Offset der Vendor-Zeit in Minuten (z. B. +480 = UTC+8). */
  tzOffsetMin: number;
  /** Anzeige-Label der Zeitzone (z. B. „SGT (UTC+8)"). */
  timezoneLabel: string;
  /** Anzeige-Namen je Phase (z. B. MiMo: „Tag" / „Nacht −20 %"). */
  phaseLabel: Record<Phase, string>;
  /** Ab diesem Zeitpunkt gelten die Regeln (ms); davor alles wie peak. */
  effectiveFromMs: number | null;
}

export interface VendorPriceData {
  vendorId: VendorId;
  fetchedAt: string;
  sourceUrls: string[];
  plans: Plan[];
  models: Model[];
  peak: PeakConfig;
}

/** Offset/Hauptmodell eines Vendors für planValue („Flaggschiff"). */
export interface VendorMeta {
  id: VendorId;
  path: string;
  name: string;
  shortName: string;
  tagline: string;
  siteUrl: string;
  priceSourceUrl: string;
  flagshipId: string;
}

/** i18n: gemeinsame + vendor-spezifische Keys. */
export type Translation = Record<string, string> & {
  brand: string;
  navHome: string;
  basisLabel: string;
  basisList: string;
  basisFull: string;
  basisPaid: string;
  cycleLabel: string;
  cycleMonthly: string;
  cycleQuarterly: string;
  cycleYearly: string;
  colModel: string;
  colCost: string;
  colRequests: string;
  colCredits: string;
  colValue: string;
  per1m: string;
  per1mCredits: string;
  perReq: string;
  colCostCredits: string;
  perMonth: string;
  contextTokens: string;
  peakTooltip: string;
  peakWeekendNote: string;
  patternsSource: string;
  costTooltip: string;
  requestsTooltip: string;
  patternTooltip: string;
  headingPrices: string;
  headingComparison: string;
  headingChangelog: string;
  searchPlaceholder: string;
  cmpColumn: string;
  cmpPrice: string;
  cmpPool: string;
  cmpLimits: string;
  cmpBonus: string;
  cmpRequests: string;
  cmpValue: string;
  cmpUnitWeek: string;
  cmpUnitMonth: string;
  cmpLimit5h: string;
  cmpLimitWeekly: string;
  cmpLimitMonthly: string;
  chgNone: string;
  chgPrev: string;
  chgNext: string;
  chgPage: string;
  fetchedAt: string;
  sourceLink: string;
  footerNote: string;
  impressum: string;
  datenschutz: string;
};

export interface Formulas {
  /** Monatlicher Credit-Pool eines Plans (Wochen-Credits × 4 bei `weekly`, sonst direkt). */
  monthlyCredits(plan: Plan): number | null;
  /** Tatsächlicher Monatspreis je Abrechnungszyklus (USD). */
  planPriceMonth(plan: Plan, cycle: Cycle): number | null;
  /** Credits/Anfrage eines Modells (Basis-Faktor 1.0 = peak); null wenn Muster fehlt. */
  creditsPerRequest(model: Model): number | null;
  /**
   * USD/Anfrage über Plan-Parität: Credits/Anfrage × ($/Credit), phasen- und
   * zyklusabhängig. $/Credit = Monatspreis des gewählten Zyklus ÷ Monats-Credits
   * — echte $, ohne externe API-Listenpreise.
   */
  requestCostUsd(model: Model, plan: Plan, cycle: Cycle): number | null;
  /** Requests/Monat (4 Wochen bei Wochen-Pool) — berücksichtigt Phase. */
  requestsPerMonth(model: Model, plan: Plan): number | null;
  /** „Wert" eines Plans = API-Äquivalenz des Pools ÷ tatsächlicher Monatspreis. */
  planValue(plan: Plan, cycle: Cycle): number | null;
  /** USD/1M eines Feldes über Plan-Parität (phasen- und zyklusabhängig). */
  fieldPriceUsd(model: Model, field: CreditField, plan: Plan, cycle: Cycle): number | null;
}

export interface FieldLens {
  key: CreditField;
  labelKey: string;
}

export interface VendorModule {
  meta: VendorMeta;
  data: VendorPriceData;
  formulas: Formulas;
  fields: FieldLens[];
  peak: PeakConfig;
  i18n: Record<Lang, Translation>;
}

export interface ChangelogEntry {
  id: string;
  date: string;
  changes: { de: string; en: string }[];
}

export interface ChangelogData {
  entries: ChangelogEntry[];
}