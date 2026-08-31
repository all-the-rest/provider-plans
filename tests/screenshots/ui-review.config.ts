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

const TITLE = "Provider Plans – Preis-Tracking für Coding-Subscriptions";

export const uiReviewConfig: UiReviewConfig = {
  outputDir: "test-results/ui-screenshots",
  routes: [
    {
      name: "start",
      path: "/",
      states: ["filled"],
      expectedTitle: TITLE,
      note: "Statische Startseite ohne Datenabhängigkeit; kein separater Empty-State.",
      nav: [{ kind: "goto", path: "/", reason: "Start-Route als Deep-Link" }],
    },
    {
      name: "zai",
      path: "/z-ai",
      states: ["filled"],
      expectedTitle: TITLE,
      note: "z.ai GLM Coding Plan — Daten gebündelt; kein separater Empty-State.",
      nav: [{ kind: "goto", path: "/z-ai", reason: "SPA-Deep-Link (Header-Nav auf Mobile versteckt)" }],
    },
    {
      name: "mimo",
      path: "/mimo",
      states: ["filled"],
      expectedTitle: TITLE,
      note: "MiMo Token Plan — Daten gebündelt; kein separater Empty-State.",
      nav: [{ kind: "goto", path: "/mimo", reason: "SPA-Deep-Link (Header-Nav auf Mobile versteckt)" }],
    },
    {
      name: "impressum",
      path: "/impressum",
      states: ["filled"],
      expectedTitle: TITLE,
      nav: [{ kind: "goto", path: "/impressum", reason: "Rechtsseite — nur per Link erreichbar" }],
    },
    {
      name: "datenschutz",
      path: "/datenschutz",
      states: ["filled"],
      expectedTitle: TITLE,
      nav: [{ kind: "goto", path: "/datenschutz", reason: "Rechtsseite — nur per Link erreichbar" }],
    },
  ],
};

export const routes = uiReviewConfig.routes;