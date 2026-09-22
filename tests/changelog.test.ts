// tests/changelog.test.ts — Changelog-Bremse: max. 1 Eintrag pro Tag und Vendor.
// mergeChangelog mergt Same-Day-Changes in den neuesten Eintrag statt neu anzulegen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mergeChangelog, buildChangelogEntries } from "../scripts/lib.mjs";

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

function snap(priceMonthly) {
  return {
    vendorId: "zai",
    plans: [
      {
        id: "lite",
        name: "Lite",
        kind: "weekly",
        priceMonthly,
        priceQuarterlyMonthly: null,
        priceYearlyMonthly: null,
        credits5h: 2000,
        creditsWeekly: 10000,
        creditsMonthly: null,
        notes: null,
        sourceUrl: "https://z.ai/subscribe",
      },
    ],
    models: [],
  };
}

async function tmpChangelog(seed) {
  const dir = await mkdtemp(join(tmpdir(), "changelog-"));
  const file = join(dir, "changelog.json");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(file, JSON.stringify(seed ?? { entries: [] }));
  return file;
}

async function readChangelog(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

test("changelog: Merge am selben Tag (kein zweiter Eintrag)", async () => {
  const date = today();
  const file = await tmpChangelog({
    entries: [{ id: `zai-${date}`, date, changes: [{ de: "Alt", en: "Old" }] }],
  });
  // prev → next ändert den Monatspreis → frischer Change für heute.
  const out = await mergeChangelog("zai", snap(20), snap(18), { changelogPath: file });
  assert.equal(out.entries.length, 1);
  assert.equal(out.entries[0].id, `zai-${date}`);
  assert.equal(out.entries[0].changes.length, 2);
  assert.ok(out.entries[0].changes.some((c) => c.de === "Alt"));
  assert.ok(out.entries[0].changes.some((c) => c.de.includes("Monatspreis")));
  assert.deepEqual(await readChangelog(file), out);
});

test("changelog: neuer Eintrag an neuem Tag", async () => {
  const date = today();
  const prev = yesterday();
  const file = await tmpChangelog({
    entries: [{ id: `zai-${prev}`, date: prev, changes: [{ de: "Alt", en: "Old" }] }],
  });
  const out = await mergeChangelog("zai", snap(20), snap(18), { changelogPath: file });
  assert.equal(out.entries.length, 2);
  assert.equal(out.entries[0].id, `zai-${date}`);
  assert.equal(out.entries[1].id, `zai-${prev}`);
});

test("changelog: Idempotenz (Wiederholung ändert nichts)", async () => {
  const file = await tmpChangelog();
  const first = await mergeChangelog("zai", snap(20), snap(18), { changelogPath: file });
  // Gleicher Diff erneut (prev/next unverändert): kein neuer Eintrag, keine Duplikate.
  const second = await mergeChangelog("zai", snap(20), snap(18), { changelogPath: file });
  assert.deepEqual(second, first);
  assert.equal(second.entries.length, 1);
  // Auch ohne Diff bleibt der Stand stabil und legt nichts an.
  const third = await mergeChangelog("zai", snap(20), snap(20), { changelogPath: file });
  assert.deepEqual(third, second);
});

test("changelog: keine leeren Einträge", async () => {
  const date = today();
  const file = await tmpChangelog({
    entries: [
      { id: `zai-${date}`, date, changes: [] },
      { id: "zai-2000-01-01", date: "2000-01-01", changes: [] },
    ],
  });
  // Kein Diff → keine neuen Einträge; leere Alt-Einträge werden entfernt.
  const out = await mergeChangelog("zai", snap(18), snap(18), { changelogPath: file });
  assert.deepEqual(out.entries, []);
});

test("changelog: unparsebares Datum → neuer Eintrag", async () => {
  const date = today();
  const file = await tmpChangelog({
    entries: [{ id: "zai-manual", date: "unbekannt", changes: [{ de: "Alt", en: "Old" }] }],
  });
  const out = await mergeChangelog("zai", snap(20), snap(18), { changelogPath: file });
  assert.equal(out.entries.length, 2);
  assert.equal(out.entries[0].id, `zai-${date}`);
});

function modelRow(id, tier) {
  return {
    id,
    name: id,
    provider: "Xiaomi",
    tier,
    contextWindow: null,
    creditPerM: { input: 2500000, output: 600000000, inputMiss: 300000000 },
    apiPrice: { input: 0.0036, output: 0.87, inputMiss: 0.435 },
    pattern: { input: 790, cached: 86000, output: 305 },
    note: null,
  };
}

function planRow(id, priceMonthly) {
  return {
    id,
    name: id[0].toUpperCase() + id.slice(1),
    kind: "monthly",
    priceMonthly,
    priceQuarterlyMonthly: null,
    priceYearlyMonthly: null,
    credits5h: null,
    creditsWeekly: null,
    creditsMonthly: 4100000000,
    notes: null,
    sourceUrl: "https://mimo.mi.com/docs/en-US/price/token-plan",
  };
}

test("changelog: Modelltausch 2.5 → 2.6 ergibt Add/Remove statt Stille", () => {
  const prev = {
    vendorId: "mimo",
    plans: [planRow("lite", 6)],
    models: [
      modelRow("mimo-v2.5-pro", "peak"),
      modelRow("mimo-v2.5-pro", "off-peak"),
      modelRow("mimo-v2.5", "peak"),
      modelRow("mimo-v2.5", "off-peak"),
    ],
  };
  const next = {
    vendorId: "mimo",
    plans: [planRow("lite", 6)],
    models: [
      modelRow("mimo-v2.6-pro", "peak"),
      modelRow("mimo-v2.6-pro", "off-peak"),
      modelRow("mimo-v2.6-flash", "peak"),
      modelRow("mimo-v2.6-flash", "off-peak"),
    ],
  };
  const [entry] = buildChangelogEntries(prev, next, "mimo");
  assert.ok(entry, "Eintrag erwartet");
  assert.equal(entry.changes.length, 4);
  const deAll = entry.changes.map((c) => c.de);
  assert.ok(deAll.includes("mimo-v2.6-pro: Modell hinzugefügt"));
  assert.ok(deAll.includes("mimo-v2.6-flash: Modell hinzugefügt"));
  assert.ok(deAll.includes("mimo-v2.5-pro: Modell entfernt"));
  assert.ok(deAll.includes("mimo-v2.5: Modell entfernt"));
  assert.ok(entry.changes.every((c) => /model (added|removed)/.test(c.en)));
});

test("changelog: Plan hinzugefügt/entfernt wird erkannt", () => {
  const prev = { vendorId: "mimo", plans: [planRow("lite", 6)], models: [] };
  const next = {
    vendorId: "mimo",
    plans: [planRow("lite", 6), planRow("ultra", 200)],
    models: [],
  };
  const [added] = buildChangelogEntries(prev, next, "mimo");
  assert.ok(added.changes[0].de.includes("Ultra: Plan hinzugefügt"));
  const [removed] = buildChangelogEntries(next, prev, "mimo");
  assert.ok(removed.changes[0].de.includes("Ultra: Plan entfernt"));
});

test("changelog: API-Preis-Änderung wird erkannt", () => {
  const prev = {
    vendorId: "mimo",
    plans: [planRow("lite", 6)],
    models: [modelRow("mimo-v2.6-pro", "peak")],
  };
  const next = JSON.parse(JSON.stringify(prev));
  next.models[0].apiPrice.input = 0.0072;
  const [entry] = buildChangelogEntries(prev, next, "mimo");
  assert.ok(entry.changes[0].de.includes("input-API-Preis"));
  assert.ok(entry.changes[0].en.includes("input API price"));
});
