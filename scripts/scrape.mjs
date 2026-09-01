// scripts/scrape.mjs — Orchestrator: Patterns → Fallback → zai → mimo → ollama.
// Env-Flag STUB=1 nutzt für alle Quellen die committeten Fixtures.
import { extractFallbackPattern } from "./extract-fallback-pattern.mjs";
import { extractPatterns } from "./extract-patterns.mjs";
import { scrapeMimo } from "./scrape-mimo.mjs";
import { scrapeOllama } from "./scrape-ollama.mjs";
import { scrapeZai } from "./scrape-zai.mjs";

async function main() {
  const stub = process.env.STUB === "1";
  const patterns = await extractPatterns({ stub, write: !stub });
  if (!stub) console.log(`✓ opencode-patterns.json (${Object.keys(patterns.patterns).length} Muster)`);
  else console.log(`✓ Anfragemuster aus Fixture (${Object.keys(patterns.patterns).length} Muster)`);

  const fallback = await extractFallbackPattern({ stub, write: !stub });
  if (!stub) console.log(`✓ fallback-pattern.json (${fallback.pattern.input}/${fallback.pattern.cached}/${fallback.pattern.output})`);
  else console.log(`✓ Fallback-Muster aus Fixture (${fallback.pattern.input}/${fallback.pattern.cached}/${fallback.pattern.output})`);

  const zai = await scrapeZai({ stub, patterns: patterns.patterns, fallbackPattern: fallback.pattern });
  const mimo = await scrapeMimo({ stub, patterns: patterns.patterns, fallbackPattern: fallback.pattern });
  const ollama = await scrapeOllama({ stub, patterns: patterns.patterns, fallbackPattern: fallback.pattern });

  console.log(`✓ zai:  ${zai.plans.length} Pläne · ${zai.models.length} Modell-Zeilen · fetchedAt ${zai.fetchedAt}`);
  console.log(`✓ mimo: ${mimo.plans.length} Pläne · ${mimo.models.length} Modell-Zeilen · fetchedAt ${mimo.fetchedAt}`);
  console.log(`✓ ollama: ${ollama.plans.length} Pläne · ${ollama.models.length} Modell-Zeilen · fetchedAt ${ollama.fetchedAt}`);
}

main().catch((err) => {
  console.error("Scrape fehlgeschlagen:");
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});