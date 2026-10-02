// tests/peak.test.ts — datengetriebene Peak-Regeln: Auswertung (§2), zod-Invarianten (§1),
// Feiertagskalender und Zonenrand. Rein lokal, deterministisch (feste UTC-Zeitstempel).
import { test } from "node:test";
import assert from "node:assert/strict";
import { HOLIDAY_CALENDARS, holidayCalendarsSchema, validateVendorData } from "../scripts/lib.mjs";
import { isPeakActive, isoWeekday, localIsoDate, nextTransition } from "../src/peakLogic.ts";
import { peak as zaiPeak } from "../src/vendors/zai/peak.ts";
import { peak as mimoPeak } from "../src/vendors/mimo/peak.ts";
import { peak as ollamaPeak } from "../src/vendors/ollama/peak.ts";

const at = (iso: string) => Date.parse(iso);
const clone = (o: object) => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------------------
// §2 Auswertung — je Vendor: Werktag im Fenster, Werktag außerhalb, Wochenende
// ---------------------------------------------------------------------------

test("zai: Werktag im Fenster = Peak, außerhalb = Off-Peak", () => {
  // Wed 2026-09-16, SGT 16:00 = UTC 08:00 → im Fenster [6,10)
  assert.equal(isPeakActive(at("2026-09-16T08:00:00Z"), zaiPeak), true);
  // Wed 12:00 UTC (SGT 20:00) → außerhalb
  assert.equal(isPeakActive(at("2026-09-16T12:00:00Z"), zaiPeak), false);
});

test("zai: Wochenendtag ist ganztägig Off-Peak (auch im Fenster)", () => {
  // Sat 2026-09-19 08:00 UTC (SGT 16:00) → day 6 nicht in peak.days
  assert.equal(isoWeekday("2026-09-19"), 6);
  assert.equal(isPeakActive(at("2026-09-19T08:00:00Z"), zaiPeak), false);
});

test("zai: kein Feiertags-Sonderfall (Quelle nennt keine) → 01.10. ist Peak", () => {
  // Thu 2026-10-01 (chinesischer Nationalfeiertag), SGT 16:00 = UTC 08:00 → im Fenster.
  assert.equal(isoWeekday("2026-10-01"), 4);
  assert.equal(zaiPeak.holidays, undefined, "z.ai nennt keine permanente Feiertags-Regel");
  assert.equal(isPeakActive(at("2026-10-01T08:00:00Z"), zaiPeak), true);
});

test("zai: vor effectiveFrom gilt kein Peak (Vorlaufzeit)", () => {
  // 2026-07-01 liegt vor 2026-07-30T00:00+08:00
  assert.equal(isPeakActive(at("2026-07-01T08:00:00Z"), zaiPeak), false);
  // direkt nach effectiveFrom: Werktagsfenster greift wieder
  assert.equal(isPeakActive(at("2026-08-05T08:00:00Z"), zaiPeak), true);
});

test("mimo: täglich im UTC-Fenster 16–24 = Peak, sonst Off-Peak", () => {
  assert.equal(isPeakActive(at("2026-09-16T20:00:00Z"), mimoPeak), true);
  assert.equal(isPeakActive(at("2026-09-16T12:00:00Z"), mimoPeak), false);
  // Wochenende ist KEIN Sonderfall (offPeak.days leer)
  assert.equal(isPeakActive(at("2026-09-19T20:00:00Z"), mimoPeak), true);
  // Feiertag ist KEIN Sonderfall (keine holidays-Referenz)
  assert.equal(isPeakActive(at("2026-10-01T20:00:00Z"), mimoPeak), true);
});

test("ollama: Mo–Fr 12–18 UTC = Peak, Wochenende Off-Peak", () => {
  assert.equal(isPeakActive(at("2026-09-16T15:00:00Z"), ollamaPeak), true);
  assert.equal(isPeakActive(at("2026-09-16T09:00:00Z"), ollamaPeak), false);
  assert.equal(isPeakActive(at("2026-09-19T15:00:00Z"), ollamaPeak), false);
});

test("Zonenrand: Feiertags-/Wochentagsdatum wird in der Regel-Zone gebildet", () => {
  // 00:00 UTC = 08:00 Shanghai (gleicher Kalendertag), 16:00 UTC = 00:00 Shanghai (Folgetag)
  assert.equal(localIsoDate(at("2026-09-16T00:00:00Z"), "Asia/Shanghai"), "2026-09-16");
  assert.equal(localIsoDate(at("2026-09-16T16:00:00Z"), "Asia/Shanghai"), "2026-09-17");
  assert.equal(localIsoDate(at("2026-09-16T00:00:00Z"), "Asia/Singapore"), "2026-09-16");
  // mimo-Fenster [16,24): 16:00 UTC ist Peak (Shanghai 00:00 des Folgetags)
  assert.equal(isPeakActive(at("2026-09-16T16:00:00Z"), mimoPeak), true);
});

test("nextTransition: Fensterende wird als nächster Wechsel erkannt", () => {
  // Wed 08:00 UTC mitten im zai-Peak → nächster Wechsel 10:00 UTC (Fensterende)
  assert.equal(nextTransition(at("2026-09-16T08:00:00Z"), zaiPeak), at("2026-09-16T10:00:00Z"));
  // Wed 12:00 UTC off-peak → nächster Wechsel Donnerstag 06:00 UTC (Fensterstart)
  assert.equal(nextTransition(at("2026-09-16T12:00:00Z"), zaiPeak), at("2026-09-17T06:00:00Z"));
});

// ---------------------------------------------------------------------------
// §1 zod-Invarianten (Negativtests)
// ---------------------------------------------------------------------------

function snapshot(peak: object, vendorId = "zai") {
  return {
    vendorId,
    sourceUrls: ["https://docs.z.ai/devpack/overview.md"],
    plans: [
      {
        id: "lite",
        name: "Lite",
        kind: "weekly",
        priceMonthly: 18,
        priceQuarterlyMonthly: null,
        priceYearlyMonthly: null,
        credits5h: 2000,
        creditsWeekly: 10000,
        creditsMonthly: null,
        notes: null,
        sourceUrl: "https://z.ai/subscribe",
      },
    ],
    models: [
      {
        id: "glm-5.3",
        name: "GLM-5.3",
        provider: "Z.ai",
        tier: "peak",
        contextWindow: null,
        creditPerM: { input: 6900000, cached: 1700000, output: 24000000 },
        apiPrice: { input: 1.4, cached: 0.26, output: 4.4 },
        pattern: null,
        note: null,
      },
    ],
    peak,
  };
}

test("zod: gültige Peak-Regel passiert validateVendorData", () => {
  assert.doesNotThrow(() => validateVendorData(snapshot(clone(zaiPeak)), "zai"));
});

test("zod: peak.days ∩ offPeak.days ≠ ∅ → rot", () => {
  const peak = clone(zaiPeak);
  peak.peak.days = [1, 2, 3, 4, 5, 6];
  peak.offPeak.days = [6, 7];
  assert.throws(() => validateVendorData(snapshot(peak), "zai"), /peak\.days ∩ offPeak\.days/);
});

test("zod: peak.days ∪ offPeak.days ≠ {1..7} → rot", () => {
  const peak = clone(zaiPeak);
  peak.peak.days = [1, 2, 3, 4, 5];
  peak.offPeak.days = [6];
  assert.throws(() => validateVendorData(snapshot(peak), "zai"), /≠ \{1\.\.7\}/);
});

test("zod: leeres peak.days → rot (offPeak.days darf leer sein)", () => {
  const peak = clone(zaiPeak);
  peak.peak.days = [];
  assert.throws(() => validateVendorData(snapshot(peak), "zai"), /peak\.days ist leer/);
  assert.doesNotThrow(
    () => validateVendorData(snapshot(clone(mimoPeak), "mimo"), "mimo"),
    "mimo: offPeak.days leer ist gültig"
  );
});

test("zod: ungültige IANA-Zeitzone → rot", () => {
  const peak = clone(zaiPeak);
  peak.timezone = "Mars/Phobos";
  assert.throws(() => validateVendorData(snapshot(peak), "zai"), /ungültige IANA-Zeitzone/);
});

test("zod: unbekannter Feiertagskalender → rot", () => {
  const peak = clone(zaiPeak);
  peak.holidays = { policy: "off-peak", calendar: "atlantis" };
  assert.throws(() => validateVendorData(snapshot(peak), "zai"), /fehlt in holidayCalendars/);
});

test("zod: ungültiges/überlappendes UTC-Fenster → rot", () => {
  const bad = clone(zaiPeak);
  bad.peak.windowsUtc = [[10, 6]];
  assert.throws(() => validateVendorData(snapshot(bad), "zai"), /0 ≤ start < end ≤ 24/);
  const overlap = clone(zaiPeak);
  overlap.peak.windowsUtc = [[6, 10], [9, 12]];
  assert.throws(() => validateVendorData(snapshot(overlap), "zai"), /überlappen/);
});

test("zod: kein UTC-Fenster → rot", () => {
  const peak = clone(zaiPeak);
  peak.peak.windowsUtc = [];
  assert.throws(() => validateVendorData(snapshot(peak), "zai"), /kein UTC-Fenster/);
});

test("zod: entfernte Altfelder (weekendOffPeak) → rot (strict)", () => {
  const peak = clone(zaiPeak);
  peak.weekendOffPeak = true; // alte Form — darf nicht still durchgehen
  assert.throws(() => validateVendorData(snapshot(peak), "zai"));
});

// ---------------------------------------------------------------------------
// Feiertagskalender (Handpflege-Konfiguration)
// ---------------------------------------------------------------------------

test("Feiertagskalender: aktuell leer (keine Vendor-Quelle nennt Feiertage)", () => {
  assert.deepEqual(HOLIDAY_CALENDARS, {}, "kein Kalender ohne Quellenbeleg erfinden");
});

test("Feiertagskalender: zod lehnt Nicht-ISO-Daten und unsortierte Einträge ab", () => {
  assert.throws(() => holidayCalendarsSchema.parse({ x: { dates: ["2026/01/01"], coveredThrough: "2026-12-31" } }));
});
