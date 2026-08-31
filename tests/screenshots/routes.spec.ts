import { expect, test } from "@playwright/test";

const ROUTES = [
  { path: "/", name: "start" },
  { path: "/z-ai", name: "zai" },
  { path: "/mimo", name: "mimo" },
] as const;

for (const { path, name } of ROUTES) {
  test(`Screenshot ${name}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: `test-results/ui-screenshots/${name}.png`, fullPage: true });
  });
}