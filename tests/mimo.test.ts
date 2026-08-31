// tests/mimo.test.ts — Parser-Tests gegen die committeten Fixtures (deterministisch).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFixture } from "../scripts/lib.mjs";
import { parseMimoApiPricing, parseMimoTokenPlan } from "../scripts/scrape-mimo.mjs";

const close = (a, b) => Math.abs(a - b) < 1e-6;

test("mimo: parseMimoTokenPlan liefert Monats-Preise", async () => {
  const { plans } = parseMimoTokenPlan(await readFixture("mimo/token-plan.md"));
  assert.equal(plans.length, 4);

  const lite = plans.find((p) => p.id === "lite");
  assert.equal(lite.priceMonthly, 6);
  assert.equal(lite.creditsMonthly, 4.1e9);
  assert.ok(close(lite.priceYearlyMonthly, 63.36 / 12)); // ≈ 5.28

  const standard = plans.find((p) => p.id === "standard");
  assert.equal(standard.priceMonthly, 16);
  assert.equal(standard.creditsMonthly, 1.1e10);
  assert.ok(close(standard.priceYearlyMonthly, 168.96 / 12)); // ≈ 14.08

  const pro = plans.find((p) => p.id === "pro");
  assert.equal(pro.priceMonthly, 50);
  assert.equal(pro.creditsMonthly, 3.8e10);
  assert.ok(close(pro.priceYearlyMonthly, 528 / 12));

  const max = plans.find((p) => p.id === "max");
  assert.equal(max.priceMonthly, 100);
  assert.equal(max.creditsMonthly, 8.2e10);
  assert.ok(close(max.priceYearlyMonthly, 1056 / 12));

  for (const p of plans) {
    assert.equal(p.kind, "monthly");
    assert.equal(p.creditsWeekly, null);
  }
});

test("mimo: parseMimoTokenPlan liefert Nacht-Rabatt-Konfiguration", async () => {
  const { night } = parseMimoTokenPlan(await readFixture("mimo/token-plan.md"));
  assert.equal(night.factor, 0.8);
  assert.deepEqual(night.windows, [[16, 24]]);
  assert.equal(night.weekend, false);
  assert.equal(night.tz, 480);
});

test("mimo: parseMimoTokenPlan liefert Modell-Credit-Quoten", async () => {
  const { models } = parseMimoTokenPlan(await readFixture("mimo/token-plan.md"));
  assert.deepEqual(models["mimo-v2.5-pro"], { input: 2.5, inputMiss: 300, output: 600 });
  assert.deepEqual(models["mimo-v2.5"], { input: 2, inputMiss: 100, output: 200 });
});

test("mimo: parseMimoApiPricing liefert Overseas-Preise (USD/1M)", async () => {
  const { apiPrices } = parseMimoApiPricing(await readFixture("mimo/pay-as-you-go.md"));
  assert.deepEqual(apiPrices["mimo-v2.5-pro"], { input: 0.0036, inputMiss: 0.435, output: 0.87 });
  assert.deepEqual(apiPrices["mimo-v2.5"], { input: 0.0028, inputMiss: 0.14, output: 0.28 });
});