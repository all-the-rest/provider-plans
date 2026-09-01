import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = import.meta.dirname;

/** Überschreibt `fetchedAt` mit der Build-Zeit (wie cc-price-tracker). */
function stampFetchedAt(raw: string): string {
  const data = JSON.parse(raw);
  data.fetchedAt = new Date().toISOString();
  return JSON.stringify(data, null, 2);
}

export default defineConfig({
  base: "./",
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
          writeFileSync(
            resolve(dist, `data/latest.${vendor}.json`),
            stampFetchedAt(readFileSync(src, "utf8"))
          );
        }
        // SPA-Fallback für GitHub Pages: index.html zusätzlich als 404.html ausspielen.
        copyFileSync(resolve(dist, "index.html"), resolve(dist, "404.html"));
      },
    },
  ],
});