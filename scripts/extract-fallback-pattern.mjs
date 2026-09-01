// scripts/extract-fallback-pattern.mjs — Fallback-Anfragemuster aus
// https://commandcode.ai/docs/resources/pricing-limits → src/vendors/stats/fallback-pattern.json.
//
// Quelle: Prosa-Zeile „A typical request: ~700–1K input tokens, ~125–200 output
// tokens, plus ~42K-56K cache reads" — Mittelwerte der Spannen.
// Kein Hardcode — live gescrapt, Fixture-Fallback bei Netzwerkfehler/STUB.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { FALLBACK_FIXTURE, FALLBACK_JSON_PATH, FALLBACK_URL, fetchText, parseFallbackPattern, readTextFile, repoRoot } from "./lib.mjs";

async function loadFallbackText({ stub }) {
  const envStub = process.env.COMMANDCODE_STUB;
  if (envStub) return readTextFile(envStub);
  if (stub) return readTextFile(resolve(repoRoot, FALLBACK_FIXTURE));
  try {
    return await fetchText(FALLBACK_URL);
  } catch (err) {
    console.error(`[fallback] Netzwerk-Fehler – nutze Fixture: ${err.message}`);
    return readTextFile(resolve(repoRoot, FALLBACK_FIXTURE));
  }
}

/**
 * Extrahiert das Fallback-Muster.
 * @param {{stub?: boolean, write?: boolean}} [opts]
 * @returns {Promise<{generatedAt:string, sourceUrl:string, pattern:{input:number,cached:number,output:number}}>}
 */
export async function extractFallbackPattern(opts = {}) {
  const stub = opts.stub ?? process.argv.includes("--stub");
  const text = await loadFallbackText({ stub });
  const pattern = parseFallbackPattern(text);
  if (!pattern) {
    throw new Error("extractFallbackPattern: kein Muster aus Fallback-Quelle parsebar");
  }
  const result = { generatedAt: new Date().toISOString(), sourceUrl: FALLBACK_URL, pattern };
  const write = opts.write ?? !stub;
  if (write) {
    const file = resolve(repoRoot, FALLBACK_JSON_PATH);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(result, null, 2) + "\n");
  }
  return result;
}

// Direktaufruf: node scripts/extract-fallback-pattern.mjs [--stub]
if (import.meta.url === `file://${process.argv[1]}`) {
  extractFallbackPattern().then((r) => console.log(`✓ fallback-pattern.json ${r.pattern.input}/${r.pattern.cached}/${r.pattern.output}`));
}
