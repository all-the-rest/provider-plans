import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = import.meta.dirname;

// Einmaliger Build-Stempel: `scripts/prerender.mjs` setzt BUILD_STAMP vor dem
// Client- UND SSR-Build → beide sehen denselben "Stand" (hydration-stabil).
const buildTimeIso = process.env.BUILD_STAMP ?? new Date().toISOString();

export default defineConfig({
  // Custom Domain am Root → absolute Asset-Pfade, damit auch Unterrouten
  // (`/z-ai/`, `/de/`, `/de/z-ai/`) korrekt laden.
  base: "/",
  define: {
    __BUILD_TIME_ISO__: JSON.stringify(buildTimeIso),
  },
  plugins: [
    // `ssr: true` schaltet im Client-Build auf `generate: "dom", hydratable: true`
    // (Hydration-Marker) und im SSR-Environment auf `generate: "ssr"`.
    solid({ ssr: true }),
    tailwindcss(),
    {
      name: "copy-provider-data",
      apply: "build",
      closeBundle() {
        const dist = resolve(root, "dist");
        mkdirSync(resolve(dist, "data"), { recursive: true });
        for (const vendor of ["zai", "mimo", "ollama"]) {
          const src = resolve(root, `src/vendors/${vendor}/data/latest.json`);
          // Daten werden 1:1 kopiert — kein fetchedAt-Stempel mehr.
          // Die angezeigte "Stand"-Zeit ist die Build-Zeit (src/buildInfo.ts).
          copyFileSync(src, resolve(dist, `data/latest.${vendor}.json`));
        }
        // SPA-Fallback für GitHub Pages: der noch leere Shell-Index wird als
        // 404.html gesichert (prerender.mjs ersetzt danach dist/index.html).
        copyFileSync(resolve(dist, "index.html"), resolve(dist, "404.html"));
      },
    },
  ],
});
