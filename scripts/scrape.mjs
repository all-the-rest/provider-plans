// scripts/scrape.mjs — Orchestrator: Patterns → zai → mimo.
// Env-Flag STUB=1 nutzt für alle Quellen die committeten Fixtures.
import { extractPatterns } from "./extract-patterns.mjs";
import { scrapeMimo } from "./scrape-mimo.mjs";
import { scrapeZai } from "./scrape-zai.mjs";

async function main() {
  const stub = process.env.STUB === "1";
  const patterns = await extractPatterns({ stub, write: !stub });
  if (!stub) console.log(`✓ opencode-patterns.json (${Object.keys(patterns.patterns).length} Muster)`);
  else console.log(`✓ Anfragemuster aus Fixture (${Object.keys(patterns.patterns).length} Muster)`);

  const zai = await scrapeZai({ stub, patterns: patterns.patterns });
  const mimo = await scrapeMimo({ stub, patterns: patterns.patterns });

  console.log(`✓ zai:  ${zai.plans.length} Pläne · ${zai.models.length} Modell-Zeilen · fetchedAt ${zai.fetchedAt}`);
  console.log(`✓ mimo: ${mimo.plans.length} Pläne · ${mimo.models.length} Modell-Zeilen · fetchedAt ${mimo.fetchedAt}`);
}

main().catch((err) => {
  console.error("Scrape fehlgeschlagen:");
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});