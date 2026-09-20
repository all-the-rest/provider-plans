// UI-review route manifest — einzige Quelle, welche Seiten in welchen Zuständen
// gescreenschottet werden. Diese App ist rein datengetrieben (alles gebündelt),
// ein „empty“-Zustand existiert nicht → nur `filled`, dokumentiert je Route.
export type UiReviewState = "filled" | "empty";
export type UiReviewViewport = "desktop" | "mobile";

export interface UiReviewNavStep {
  kind: "goto";
  path: string;
  reason: string;
}

export interface UiReviewRoute {
  name: string;
  path: string;
  states: UiReviewState[];
  viewports?: UiReviewViewport[];
  note?: string;
  expectedTitle?: string;
  nav?: UiReviewNavStep[];
}

export interface UiReviewConfig {
  outputDir: string;
  routes: UiReviewRoute[];
}

const TITLES: Record<string, string> = {
  // Screenshot-Kontext nutzt locale "de-DE" → die präfixlose Startseite `/`
  // wählt nach der Hydration automatisch `/de` (Browser-Sprache).
  start: "Coding-Subscriptions im Vergleich — GLM, MiMo & Ollama Plans (2026)",
  zai: "z.ai GLM Coding Plan — price, credits & is it worth it?",
  mimo: "Xiaomi MiMo Token Plan — price, credits & is it worth it?",
  ollama: "Ollama Cloud plans — price, credits & is it worth it?",
  impressum: "Imprint — Provider Plans",
  datenschutz: "Privacy — Provider Plans",
};

export const uiReviewConfig: UiReviewConfig = {
  outputDir: "test-results/ui-screenshots",
  routes: [
    {
      name: "start",
      path: "/",
      states: ["filled"],
      expectedTitle: TITLES.start,
      note: "Statische Startseite ohne Datenabhängigkeit; kein separater Empty-State.",
      nav: [{ kind: "goto", path: "/", reason: "Start-Route als Deep-Link" }],
    },
    {
      name: "zai",
      path: "/z-ai",
      states: ["filled"],
      expectedTitle: TITLES.zai,
      note: "z.ai GLM Coding Plan — Daten gebündelt; kein separater Empty-State.",
      nav: [{ kind: "goto", path: "/z-ai", reason: "SPA-Deep-Link (Header-Nav auf Mobile versteckt)" }],
    },
    {
      name: "mimo",
      path: "/mimo",
      states: ["filled"],
      expectedTitle: TITLES.mimo,
      note: "MiMo Token Plan — Daten gebündelt; kein separater Empty-State.",
      nav: [{ kind: "goto", path: "/mimo", reason: "SPA-Deep-Link (Header-Nav auf Mobile versteckt)" }],
    },
    {
      name: "ollama",
      path: "/ollama",
      states: ["filled"],
      expectedTitle: TITLES.ollama,
      note: "Ollama Pro & Max — Daten gebündelt; kein separater Empty-State.",
      nav: [{ kind: "goto", path: "/ollama", reason: "SPA-Deep-Link (Header-Nav auf Mobile versteckt)" }],
    },
    {
      name: "impressum",
      path: "/impressum",
      states: ["filled"],
      expectedTitle: TITLES.impressum,
      nav: [{ kind: "goto", path: "/impressum", reason: "Rechtsseite — nur per Link erreichbar" }],
    },
    {
      name: "datenschutz",
      path: "/datenschutz",
      states: ["filled"],
      expectedTitle: TITLES.datenschutz,
      nav: [{ kind: "goto", path: "/datenschutz", reason: "Rechtsseite — nur per Link erreichbar" }],
    },
  ],
};

export const routes = uiReviewConfig.routes;