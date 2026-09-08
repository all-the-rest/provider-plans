// Share-Card-Vorschau: vertikaler Fit (Layout-Asserts, keine Screenshots).
// Stellt sicher, dass die SVG-Vorschau in allen Kartengrößen — v. a. Story 9:16 —
// vertikal in Wrapper, Dialog und Viewport passt (object-contain + 55vh-Schranke).
import { expect, test } from "@playwright/test";

const SIZES = ["og", "twitter", "ig45", "story"] as const;

async function openShare(page: import("@playwright/test").Page) {
  await page.goto("/z-ai");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("share-open").click();
  await expect(page.getByTestId("share-dialog")).toBeVisible({ timeout: 5000 });
}

async function fitBoxes(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const img = document.querySelector('[data-testid="share-preview-img"]')!;
    const wrap = document.querySelector('[data-testid="share-preview"]')!;
    const box = document.querySelector('[data-testid="share-dialog"] .modal-box')!;
    const q = (el: Element) => {
      const b = el.getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom) };
    };
    return { img: q(img), wrap: q(wrap), box: q(box), vh: window.innerHeight };
  });
}

test("share preview fits vertically in all sizes", async ({ page }) => {
  await openShare(page);
  for (const size of SIZES) {
    await page.getByTestId("share-size").selectOption(size);
    await page.waitForTimeout(250);
    const r = await fitBoxes(page);
    expect(r.img.bottom, `${size}: Bild läuft aus dem Wrapper`).toBeLessThanOrEqual(r.wrap.bottom + 1);
    expect(r.img.bottom, `${size}: Bild läuft aus dem Viewport`).toBeLessThanOrEqual(r.vh + 1);
    expect(r.img.top, `${size}: Bild oben abgeschnitten`).toBeGreaterThanOrEqual(-1);
    expect(r.box.bottom, `${size}: Dialog läuft aus dem Viewport`).toBeLessThanOrEqual(r.vh + 1);
  }
});

test("share preview story fits on short viewport", async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 360 });
  await openShare(page);
  await page.getByTestId("share-size").selectOption("story");
  await page.waitForTimeout(250);
  const r = await fitBoxes(page);
  expect(r.img.bottom, "story@360px: Bild läuft aus dem Wrapper").toBeLessThanOrEqual(r.wrap.bottom + 1);
  expect(r.img.bottom, "story@360px: Bild läuft aus dem Viewport").toBeLessThanOrEqual(r.vh + 1);
  expect(r.img.top, "story@360px: Bild oben abgeschnitten").toBeGreaterThanOrEqual(-1);
});
