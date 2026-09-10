// tests/changelog.test.ts — Changelog-Bremse: max. 1 Eintrag pro Tag und Vendor.
// mergeChangelog mergt Same-Day-Changes in den neuesten Eintrag statt neu anzulegen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mergeChangelog } from "../scripts/lib.mjs";

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
