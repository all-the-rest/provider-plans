// OG-Image + SEO-Tags. (Als .test.ts, damit der Glob `tests/**/*.test.ts` aus
// package.json (`pnpm test`) den Test aufnimmt — .mjs würde nicht laufen.)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://ai-vendor-price-tracking.all-the.rest";

describe("og/seo", () => {
  it("index.html enthält og:image absolut + twitter:card + canonical", () => {
    const html = readFileSync(resolve(root, "index.html"), "utf8");
    assert.match(html, /<html lang="de"/);
    assert.ok(html.includes(`<link rel="canonical" href="${BASE}/" />`));
    assert.ok(html.includes(`<meta property="og:image" content="${BASE}/share/og.png"`));
    assert.ok(html.includes(`<meta property="og:image:width" content="1200"`));
    assert.ok(html.includes(`<meta property="og:image:height" content="630"`));
    assert.ok(html.includes(`<meta property="og:locale" content="de_DE"`));
    assert.ok(html.includes(`<meta name="twitter:card" content="summary_large_image"`));
    assert.ok(html.includes(`<meta name="twitter:image" content="${BASE}/share/og.png"`));
    // og:title/description identisch zu <title>/description.
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.ok(title);
    assert.ok(html.includes(`<meta property="og:title" content="${title}"`));
    assert.ok(html.includes(`<meta name="twitter:title" content="${title}"`));
    const desc = html.match(/<meta\s+name="description"\s+content="([^"]+)"\s*\/>/)?.[1];
    assert.ok(desc);
    assert.ok(html.includes(`property="og:description"`));
    assert.ok(html.includes(`content="${desc}"`));
  });

  it("Generator erzeugt public/share/og.png (PNG, 1200x630)", () => {
    execFileSync("node", ["scripts/generate-og.mjs"], { cwd: root, stdio: "pipe" });
    const p = resolve(root, "public/share/og.png");
    assert.ok(existsSync(p), "public/share/og.png fehlt");
    const b = readFileSync(p);
    assert.equal(b.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "keine PNG-Magic-Bytes");
    assert.equal(b.readUInt32BE(16), 1200, "IHDR-Breite");
    assert.equal(b.readUInt32BE(20), 630, "IHDR-Höhe");
  });
});
