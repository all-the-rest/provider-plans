// tests/patterns.test.ts — Anfragemuster-Parser (Opencode-Doku / Fixture).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, parsePatternItems, readFixture } from "../scripts/lib.mjs";

test("normalizeName: lowercase + non-alnum raus", () => {
  assert.equal(normalizeName("GLM-5.3"), "glm5.3");
  assert.equal(normalizeName("GLM-5.3-Flash"), "glm5.3flash");
  assert.equal(normalizeName("MiMo-V2.5"), "mimov2.5");
  assert.equal(normalizeName("MiMo-V2.5-Pro"), "mimov2.5pro");
});

test("patterns: liest Fixture go.md und handschuht Komma-Dezimale (32.500 → 32500)", async () => {
  const map = parsePatternItems(await readFixture("opencode/go.md"));

  // Kurzschreibweise GLM-5.3/5.2/5.1 → ein Eintrag je Teil, familienbewusst
  assert.deepEqual(map.get("glm5.3"), { input: 700, cached: 52000, output: 150 });
  assert.deepEqual(map.get("glm5.2"), { input: 700, cached: 52000, output: 150 });
  assert.deepEqual(map.get("glm5.1"), { input: 700, cached: 52000, output: 150 });
  assert.deepEqual(map.get("glm5.3flash"), { input: 1000, cached: 55000, output: 200 });

  assert.deepEqual(map.get("mimov2.5"), { input: 830, cached: 71500, output: 295 });
  assert.deepEqual(map.get("mimov2.5pro"), { input: 790, cached: 86000, output: 305 });
  assert.deepEqual(map.get("grok4.6"), { input: 390, cached: 32500, output: 120 });
  assert.deepEqual(map.get("longcat2.0"), { input: 920, cached: 88900, output: 200 });
});

test("patterns: Wird tiefer beim HTML-Pfad (li-Elemente) verarbeitet", () => {
  const html = `<ul>
    <li>GLM-5.3-Flash — 1.000 Input-, 55.000 Cached-, 200 Output-Tokens pro Anfrage</li>
    <li>MiMo-V2.5-Pro — 790 Input-, 86.000 Cached-, 305 Output-Tokens pro Anfrage</li>
  </ul>`;
  const map = parsePatternItems(html);
  assert.deepEqual(map.get("glm5.3flash"), { input: 1000, cached: 55000, output: 200 });
  assert.deepEqual(map.get("mimov2.5pro"), { input: 790, cached: 86000, output: 305 });
});