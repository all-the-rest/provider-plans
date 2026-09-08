// Permanente Share-Dialog-Captures (ui-review-Skill).
// Pro Vendor-Route × Kartengröße × Viewport: geöffneter Dialog als PNG,
// plus eine Light-Theme-Variante (og) je Vendor.
// Nur Capture, keine Funktions-Asserts — separat von der E2E-Suite.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import path from "node:path";
import process from "node:process";
import { uiReviewConfig } from "./ui-review.config";
import type { UiReviewViewport } from "./ui-review.config";

const SCREENSHOT_OUTPUT_DIR = uiReviewConfig.outputDir;

const out = (viewport: UiReviewViewport, file: string) =>
  path.resolve(process.cwd(), SCREENSHOT_OUTPUT_DIR, "filled", viewport, file);

function viewportForProject(projectName: string): UiReviewViewport {
  return projectName === "Mobile Chrome" ? "mobile" : "desktop";
}

async function waitForAppSettled(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("main")).toBeVisible();
  await page.waitForTimeout(300);
}

const VENDORS = [
  { name: "zai", path: "/z-ai" },
  { name: "mimo", path: "/mimo" },
  { name: "ollama", path: "/ollama" },
] as const;

const SIZES = ["og", "twitter", "ig45", "story"] as const;

for (const vendor of VENDORS) {
  for (const viewport of ["desktop", "mobile"] as const) {
    test(
      `share dialog ${vendor.name} (${viewport})`,
      { tag: ["@screenshot"] },
      async ({ page }, testInfo) => {
        test.skip(
          viewportForProject(testInfo.project.name) !== viewport,
          `project ${testInfo.project.name} rendert den ${viewportForProject(testInfo.project.name)}-Viewport`
        );

        await page.goto(vendor.path);
        await waitForAppSettled(page);

        // Site-Theme dunkel setzen, damit die Default-Vorschau (folgt dem Site-Theme) dunkel bleibt.
        await page.evaluate(() => localStorage.setItem("theme", "dark"));
        await page.reload();
        await waitForAppSettled(page);

        const dialog = page.getByTestId("share-dialog");
        await page.getByTestId("share-open").click();
        await expect(dialog).toBeVisible();

        for (const size of SIZES) {
          await page.getByTestId("share-size").selectOption(size);
          await expect(page.getByTestId("share-preview-img")).toBeVisible();
          await page.waitForTimeout(300);
          await dialog.screenshot({ path: out(viewport, `share-${vendor.name}-${size}.png`) });
        }

        // Light-Theme-Variante (og-Größe): erster Button in share-theme ist Hell/Light.
        await page.getByTestId("share-size").selectOption("og");
        await page.getByTestId("share-theme").getByRole("button").first().click();
        await expect(page.getByTestId("share-preview-img")).toBeVisible();
        await page.waitForTimeout(300);
        await dialog.screenshot({ path: out(viewport, `share-${vendor.name}-og-light.png`) });

        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      }
    );
  }
}
