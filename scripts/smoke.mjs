// Smoke-Test für den Produktions-Build: prüft dist-Artefakte, startet
// `vite preview` und verifiziert per HTTP, dass die Seite (inkl. Deep-Links)
// und die Vendor-Daten ausgeliefert werden. Läuft lokal (`pnpm smoke`) und
// in CI identisch — kein Browser nötig. Jeder Fehler → exit 1.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, "..");
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.SMOKE_PORT ?? 4173);
// 127.0.0.1 statt localhost: in Containern (CI) löst localhost teils nur nach
// ::1 auf, während der Preview-Server auf IPv4 lauscht (oder umgekehrt).
const BASE = `http://127.0.0.1:${PORT}`;

// Vendor-Routen (src/vendors/registry.ts) ↔ Daten-Artefakte (vite.config.ts).
const VENDORS = [
  { route: "/z-ai", file: "latest.zai.json", vendorId: "zai" },
  { route: "/mimo", file: "latest.mimo.json", vendorId: "mimo" },
  { route: "/ollama", file: "latest.ollama.json", vendorId: "ollama" },
];

// Vorgerenderte HTML-Dateien (scripts/prerender.mjs) — je Sprache eine echte Datei.
// Trailing Slash, weil `vite preview` (wie GitHub Pages) `/z-ai/` auf das
// Verzeichnis-Index auflöst; `/z-ai` ohne Slash ist die SPA-Fallback-Variante.
const PAGES = ["/", "/z-ai/", "/mimo/", "/ollama/", "/de/", "/de/z-ai/", "/de/mimo/", "/de/ollama/"];

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`[smoke] FAIL: ${msg}`);
};
const ok = (msg) => console.log(`[smoke] ok: ${msg}`);

async function main() {
  console.log(`[smoke] node ${process.version} ${process.platform}/${process.arch}`);
  // 1. Build-Artefakte vorhanden?
  const expected = [
    "index.html",
    "404.html",
    "CNAME",
    "robots.txt",
    "sitemap.xml",
    "z-ai/index.html",
    "mimo/index.html",
    "ollama/index.html",
    "de/index.html",
    "de/z-ai/index.html",
    ...VENDORS.map((v) => join("data", v.file)),
  ];
  for (const f of expected) {
    if (!existsSync(join(DIST, f))) fail(`dist/${f} fehlt (Build unvollständig?)`);
    else ok(`dist/${f} vorhanden`);
  }

  // 2. Alle in index.html referenzierten Assets existieren?
  // (Vite schreibt relative ./assets/…-Pfade — data:-URIs ausnehmen.)
  const html = existsSync(join(DIST, "index.html")) ? readFileSync(join(DIST, "index.html"), "utf8") : "";
  const refs = [...html.matchAll(/(?:src|href)="(\.?\/assets\/[^"]+)"/g)].map((m) => m[1].replace(/^\.\//, ""));
  if (refs.length === 0) fail("index.html referenziert keine assets-Dateien");
  for (const ref of new Set(refs)) {
    if (!existsSync(join(DIST, ref))) fail(`${ref} referenziert, aber nicht in dist/`);
  }
  if (refs.length > 0) ok(`${new Set(refs).size} referenzierte Assets vorhanden`);

  // 3. Preview-Server starten und per HTTP prüfen. stdout/stderr werden
  // mitgeschnitten, damit ein Startfehler in CI diagnostizierbar ist
  // (statt 30 s blind zu pollen).
  // Host explizit auf IPv4-Loopback pinnen: `localhost` löst je nach Umgebung
  // nach ::1 oder 127.0.0.1 auf — Server und Client müssen dieselbe Familie
  // treffen (in Playwright-Containern lauscht vite sonst nur auf ::1).
  const server = spawn(join(ROOT, "node_modules", ".bin", "vite"), ["preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  const keepLog = (chunk) => {
    serverLog = (serverLog + chunk.toString()).slice(-4000);
  };
  server.stdout?.on("data", keepLog);
  server.stderr?.on("data", keepLog);
  server.on("error", (e) => {
    serverLog += `\n[spawn-error] ${e.message}`;
  });
  const stop = () => {
    try {
      server.kill("SIGTERM");
    } catch {
      // bereits beendet
    }
  };
  process.on("exit", stop);
  try {
    // Einmal auf Bereitschaft warten; alle weiteren Endpunkte danach genau
    // einmal fetchen (schnelles Scheitern statt Minuten-Polling je Pfad).
    let root = null;
    let dead = false;
    for (let i = 0; i < 60; i++) {
      if (server.exitCode !== null) {
        dead = true;
        break;
      }
      try {
        const res = await fetch(`${BASE}/`);
        if (res.ok) {
          root = await res.text();
          break;
        }
      } catch {
        // noch nicht bereit
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (dead || root === null) {
      fail(`Preview-Server antwortet nicht auf ${BASE}/ (exit=${server.exitCode}) — Server-Log:\n${serverLog || "(leer)"}`);
    } else {
      ok("GET / → 200");
      if (!root.includes('id="root"')) fail('GET / enthält keinen App-Root (id="root") — kaputtes Bundle?');
      else ok("App-Root vorhanden");
    }

    const getOnce = async (path) => {
      try {
        const res = await fetch(`${BASE}${path}`);
        return res.ok ? await res.text() : null;
      } catch {
        return null;
      }
    };

    // Deep-Links (SPA-Fallback → index.html mit App-Root).
    for (const v of VENDORS) {
      const body = await getOnce(v.route);
      if (body === null) fail(`GET ${v.route} → kein 200 (SPA-Fallback kaputt?)`);
      else if (!body.includes('id="root"')) fail(`GET ${v.route} enthält keinen App-Root`);
      else ok(`GET ${v.route} → 200 mit App-Root`);
    }

    // Vorgerenderte Seiten: echtes <h1>, JSON-LD und Hydration-Script.
    for (const p of PAGES) {
      const body = await getOnce(p);
      if (body === null) {
        fail(`GET ${p} → kein 200 (Prerender-Datei fehlt?)`);
        continue;
      }
      if (!/<h1[\s>]/.test(body)) fail(`GET ${p} enthält kein <h1>`);
      else if (!body.includes("application/ld+json")) fail(`GET ${p} ohne JSON-LD`);
      else if (!body.includes("_$HY")) fail(`GET ${p} ohne Hydration-Script (window._$HY)`);
      else if (!body.includes('id="root"')) fail(`GET ${p} ohne App-Root`);
      else ok(`GET ${p} → 200 mit <h1>, JSON-LD, _$HY`);
    }

    // SEO-Fundament.
    const robots = await getOnce("/robots.txt");
    if (robots === null || !robots.includes("Sitemap:")) fail("GET /robots.txt → fehlt oder ohne Sitemap-Verweis");
    else ok("GET /robots.txt → 200");
    const sitemap = await getOnce("/sitemap.xml");
    if (sitemap === null || !sitemap.includes("<urlset")) fail("GET /sitemap.xml → fehlt oder ungültig");
    else if (!sitemap.includes("/de/")) fail("GET /sitemap.xml listet die deutsche URL nicht");
    else ok("GET /sitemap.xml → 200");

    for (const v of VENDORS) {
      try {
        const res = await fetch(`${BASE}/data/${v.file}`);
        if (!res.ok) {
          fail(`GET /data/${v.file} → HTTP ${res.status}`);
          continue;
        }
        const data = await res.json();
        ok(`GET /data/${v.file} → 200, valides JSON`);
        if (data.vendorId !== v.vendorId) fail(`${v.file}: vendorId=${data.vendorId}, erwartet ${v.vendorId}`);
        if (!Array.isArray(data.plans) || data.plans.length === 0) fail(`${v.file} ohne plans[]`);
        else ok(`${v.vendorId}: ${data.plans.length} Pläne`);
        if (!Array.isArray(data.models) || data.models.length === 0) fail(`${v.file} ohne models[]`);
        else ok(`${v.vendorId}: ${data.models.length} Modelle`);
        if (Array.isArray(data.plans) && data.plans.length > 0) {
          const withPool = data.plans.filter((p) => p.creditsMonthly != null || p.creditsWeekly != null);
          if (withPool.length === 0) fail(`${v.file}: kein Plan mit Credit-Pool (creditsMonthly/creditsWeekly)`);
        }
        if (Array.isArray(data.models) && data.models.length > 0) {
          for (const m of data.models) {
            if (m.pattern != null) {
              const hasApi =
                m.apiPrice != null &&
                Object.values(m.apiPrice).some((x) => typeof x === "number" && Number.isFinite(x));
              if (!hasApi)
                fail(`${v.file}: Modell "${m.id}" (${m.tier ?? "?"}) mit Pattern, aber ohne apiPrice`);
            }
          }
        }
      } catch (e) {
        fail(`/data/${v.file}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } finally {
    stop();
  }

  if (failures > 0) {
    console.error(`[smoke] ${failures} Fehler — nichts davon darf auf prod.`);
    process.exit(1);
  }
  console.log("[smoke] alles grün.");
}

main().catch((e) => {
  console.error(`[smoke] FEHLER: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
