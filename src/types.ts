export type Lang = "de" | "en";

export type VendorId = "zai" | "mimo" | "ollama";

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

/** Feiertagsregel einer Peak-Konfiguration: an Feiertagen ganztägig Off-Peak. */
export interface PeakHolidayRule {
  policy: "off-peak";
  /** Schlüssel in `HolidayCalendars`. */
  calendar: string;
}

/**
 * Datengetriebene Peak-Regel eines Vendors (eine Form für die ganze Tracker-Familie,
 * vgl. `ocgo-price-tracker`/`cc-price-tracker`). Der Wochentag wird in `timezone`
 * bewertet, die Zeitfenster in UTC — kein `weekendOffPeak`-Boolean und kein
 * Offset/Label mehr (eine Quelle der Wahrheit).
 */
export interface PeakConfig {
  /** IANA-Zeitzone, in der der Wochentag bewertet wird (z. B. „Asia/Singapore"). */
  timezone: string;
  /** Wochentage + UTC-Stunden-Fenster, in denen Peak gilt. */
  peak: {
    days: number[];
    /** UTC-Stunden-Fenster [start, end), z. B. [[6,10]] für SGT Mo–Fr 14–18. */
    windowsUtc: [number, number][];
  };
  /** Wochentage, an denen ganztägig Off-Peak gilt (`allDay` ist immer `true`). */
  offPeak: { days: number[]; allDay: true };
  /** Nur gesetzt, wenn die Quelle Feiertage nennt. */
  holidays?: PeakHolidayRule;
  /** Credit-Faktor je Phase: `peak` = 1.0 (Basis), `off-peak` = z. B. 0.5 / 0.8. */
  phaseFactor: Record<Phase, number>;
  /** Anzeige-Namen je Phase („Peak" / „Off-Peak", einheitlich für alle Vendors). */
  phaseLabel: Record<Phase, string>;
  /** Ab diesem Zeitpunkt gelten die Regeln (ms); davor kein Peak (Vorlaufzeit). */
  effectiveFromMs: number | null;
}

/** Feiertagskalender: lokale Kalendertage + letzter abgedeckter Tag (ISO-Datum). */
export interface HolidayCalendar {
  /** Aufsteigend sortierte ISO-Datumsstrings (lokale Kalendertage der Regel-Zone). */
  dates: string[];
  /** Letzter Kalendertag, den die Feiertagsquelle abdeckt (ISO-Datum). */
  coveredThrough: string;
}

export type HolidayCalendars = Record<string, HolidayCalendar>;

export interface VendorPriceData {
  vendorId: VendorId;
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

export type ChangelogChangeKind = "added" | "removed" | "changed";

export interface ChangelogChange {
  de: string;
  en: string;
  /** Steuert das ocgo-Badge: added = grün (+), removed = rot (−), changed = neutral (≈). */
  kind?: ChangelogChangeKind;
}

export interface ChangelogEntry {
  id: string;
  date: string;
  changes: ChangelogChange[];
}

export interface ChangelogData {
  entries: ChangelogEntry[];
}