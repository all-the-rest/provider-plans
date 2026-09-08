import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = import.meta.dirname;

const buildTimeIso = new Date().toISOString();

export default defineConfig({
  base: "./",
  define: {
    __BUILD_TIME_ISO__: JSON.stringify(buildTimeIso),
  },
  plugins: [
    solid(),
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
        // SPA-Fallback für GitHub Pages: index.html zusätzlich als 404.html ausspielen.
        copyFileSync(resolve(dist, "index.html"), resolve(dist, "404.html"));
      },
    },
  ],
});