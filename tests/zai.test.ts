// tests/zai.test.ts — Parser-Tests gegen die committeten Fixtures (deterministisch).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrice, readFixture } from "../scripts/lib.mjs";
import { parseZaiOverview, parseZaiPricing, parseZaiSubscribe } from "../scripts/scrape-zai.mjs";

const overview = () => readFixture("zai/overview.md");
const pricing = () => readFixture("zai/pricing.md");
const subscribe = () => readFixture("zai/subscribe.html");

test("zai: parsePrice liest Now-Preise (Strikethrough übersprungen)", async () => {
  const md = await overview();
  assert.equal(parsePrice("$1.4"), 1.4);
  assert.equal(parsePrice("~~$0.15~~ $0.075"), 0.075);
  assert.equal(parsePrice("~~$0.03~~ $0.015"), 0.015);
  assert.equal(parsePrice("$0.26"), 0.26);
  assert.equal(parsePrice("Limited-time Free"), null);
  assert.equal(parsePrice("—"), null);
  void md;
});

test("zai: parseZaiOverview liefert Allowances (5h/Woche)", async () => {
  const parsed = parseZaiOverview(await overview());
  assert.deepEqual(parsed.allowance.lite, { h5: 2000, weekly: 10000 });
  assert.deepEqual(parsed.allowance.pro, { h5: 12000, weekly: 60000 });
  assert.deepEqual(parsed.allowance.max, { h5: 28000, weekly: 140000 });
});

test("zai: parseZaiOverview liefert Credit-Multiplier", async () => {
  const parsed = parseZaiOverview(await overview());
  assert.deepEqual(parsed.multipliers["glm-5.3"], { input: 6.9, cached: 1.7, output: 24 });
  assert.deepEqual(parsed.multipliers["glm-5.3-flash"], { input: 2.3, cached: 0.56, output: 8 });
});

test("zai: parseZaiOverview liefert Peak-Konfiguration", async () => {
  const parsed = parseZaiOverview(await overview());
  assert.deepEqual(parsed.peak.windows, [[6, 10]]);
  assert.equal(parsed.peak.factor, 0.5);
  assert.equal(parsed.peak.weekend, true);
  assert.equal(parsed.peak.tz, 480);
  assert.equal(parsed.peak.effectiveFrom, Date.parse("2026-07-30T00:00:00+08:00"));
});

test("zai: parseZaiPricing liefert API-Preise (USD/1M)", async () => {
  const { apiPrices } = parseZaiPricing(await pricing());
  assert.deepEqual(apiPrices["glm-5.3"], { input: 1.4, cached: 0.26, output: 4.4 });
  assert.deepEqual(apiPrices["glm-5.3-flash"], { input: 0.075, cached: 0.015, output: 0.25 });
});

test("zai: parseZaiSubscribe parst Karten (Monat + Jahres-Effektivpreis)", async () => {
  const plans = parseZaiSubscribe(await subscribe(), {
    sourceUrl: "https://z.ai/subscribe",
  });
  assert.equal(plans.length, 3);

  const lite = plans.find((p) => p.id === "lite");
  assert.equal(lite.priceMonthly, 18);
  assert.equal(lite.priceYearlyMonthly, 12.6);
  assert.equal(lite.creditsWeekly, 10000);
  assert.equal(lite.kind, "weekly");
  // Fakturierungs-Leiste: Quarterly-20% → 18 × 0,8 = 14,4
  assert.ok(Math.abs(lite.priceQuarterlyMonthly - 14.4) < 1e-6);

  const pro = plans.find((p) => p.id === "pro");
  assert.equal(pro.priceMonthly, 80);
  assert.equal(pro.priceYearlyMonthly, 56);
  assert.equal(pro.creditsWeekly, 60000); // 6× Lite

  const max = plans.find((p) => p.id === "max");
  assert.equal(max.priceMonthly, 168);
  assert.equal(max.priceYearlyMonthly, 117.6);
  assert.equal(max.creditsWeekly, 140000); // 14× Lite
});