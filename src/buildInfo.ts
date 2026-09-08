declare const __BUILD_TIME_ISO__: string | undefined;

/**
 * Grobe CI-Build-Zeit für Footer/Hero/Cards.
 * Kommt per Vite-`define` aus dem Build; im Dev/Test Fallback auf "jetzt".
 */
export const BUILD_TIME_ISO: string =
  typeof __BUILD_TIME_ISO__ !== "undefined" ? __BUILD_TIME_ISO__ : new Date().toISOString();
