// Playwright-Konfiguration für den UI-Review-Screenshot-Satz (nur Screenshots, keine Asserts).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/screenshots",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 2,
  timeout: 120000,
  reporter: [["html", { open: "never", outputFolder: "playwright-report/ui-screenshots" }]],
  use: {
    baseURL: "http://localhost:5174",
    locale: "de-DE",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: "pnpm dev --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 120000,
  },
  outputDir: "test-results/ui-screenshots",
  projects: [
    { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 950 } } },
    { name: "Mobile Chrome", use: { ...devices["Galaxy A55"] } },
  ],
});