// scripts/scrape-stub.mjs — Offline-Verifikation: alle Parser gegen die lokalen
// Fixtures (kein Netzwerk), Ausgabe nach data/stub/ (nicht src/vendors/).
//
//   node scripts/scrape-stub.mjs   (bzw. pnpm scrape:stub)
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractFallbackPattern } from "./extract-fallback-pattern.mjs";
import { extractPatterns } from "./extract-patterns.mjs";
import { repoRoot } from "./lib.mjs";
import { scrapeMimo } from "./scrape-mimo.mjs";
import { scrapeOllama } from "./scrape-ollama.mjs";
import { scrapeZai } from "./scrape-zai.mjs";

async function main() {
  const patterns = await extractPatterns({ stub: true, write: false });
  const fallback = await extractFallbackPattern({ stub: true, write: false });
  const zai = await scrapeZai({ stub: true, patterns: patterns.patterns, fallbackPattern: fallback.pattern, write: false });
  const mimo = await scrapeMimo({ stub: true, patterns: patterns.patterns, fallbackPattern: fallback.pattern, write: false });
  const ollama = await scrapeOllama({ stub: true, patterns: patterns.patterns, fallbackPattern: fallback.pattern, write: false });

  const outDir = resolve(repoRoot, "data", "stub");
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, "opencode-patterns.json"), JSON.stringify(patterns, null, 2) + "\n");
  await writeFile(resolve(outDir, "fallback-pattern.json"), JSON.stringify(fallback, null, 2) + "\n");
  await writeFile(resolve(outDir, "latest.zai.json"), JSON.stringify(zai, null, 2) + "\n");
  await writeFile(resolve(outDir, "latest.mimo.json"), JSON.stringify(mimo, null, 2) + "\n");
  await writeFile(resolve(outDir, "latest.ollama.json"), JSON.stringify(ollama, null, 2) + "\n");

  console.log(`✓ Stub-Snapshot → ${outDir}`);
  console.log(`  zai:  ${zai.plans.length} Pläne · ${zai.models.length} Modell-Zeilen`);
  console.log(`  mimo: ${mimo.plans.length} Pläne · ${mimo.models.length} Modell-Zeilen`);
  console.log(`  ollama: ${ollama.plans.length} Pläne · ${ollama.models.length} Modell-Zeilen`);
  console.log(`  patterns: ${Object.keys(patterns.patterns).length} Muster · fallback: ${fallback.pattern.input}/${fallback.pattern.cached}/${fallback.pattern.output}`);
}

main().catch((err) => {
  console.error("Stub-Scrape fehlgeschlagen:");
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});