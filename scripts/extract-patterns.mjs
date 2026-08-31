// scripts/extract-patterns.mjs — Anfragemuster (Input/Cached/Output Tokens pro
// Anfrage) von opencode.ai/docs/de/go/ → src/vendors/stats/opencode-patterns.json.
//
// Quellen-Reihenfolge: OPENCODE_STUB (env, Pfad zur Fixture) → Fixture (--stub/stub-Option
// oder Netzwerk-Fehler) → Live-Seite. In Stub-Modus wird nichts nach src/vendors geschrieben.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  fetchText,
  parsePatternItems,
  readTextFile,
  repoRoot,
} from "./lib.mjs";

export const OPENCODE_GO_URL = "https://opencode.ai/docs/de/go/";
export const PATTERNS_JSON_PATH = "src/vendors/stats/opencode-patterns.json";
export const PATTERNS_FIXTURE = "tests/fixtures/opencode/go.md";

async function loadPatternText({ stub }) {
  const envStub = process.env.OPENCODE_STUB;
  if (envStub) return readTextFile(envStub);
  if (stub) return readTextFile(resolve(repoRoot, PATTERNS_FIXTURE));
  try {
    return await fetchText(OPENCODE_GO_URL);
  } catch (err) {
    console.error(`[patterns] Netzwerk-Fehler – nutze Fixture: ${err.message}`);
    return readTextFile(resolve(repoRoot, PATTERNS_FIXTURE));
  }
}

/**
 * Extrahiert die Anfragemuster.
 * @param {{stub?: boolean, write?: boolean}} [opts]
 * @returns {Promise<{generatedAt: string, patterns: Record<string, {input:number,cached:number,output:number}>}>}
 */
export async function extractPatterns(opts = {}) {
  const stub = opts.stub ?? process.argv.includes("--stub");
  const text = await loadPatternText({ stub });
  const patterns = Object.fromEntries(parsePatternItems(text));
  const result = { generatedAt: new Date().toISOString(), patterns };

  const write = opts.write ?? !stub;
  if (write) {
    const file = resolve(repoRoot, PATTERNS_JSON_PATH);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(result, null, 2) + "\n");
  }
  return result;
}