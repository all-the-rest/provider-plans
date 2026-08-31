import { expect, test, type Page } from "@playwright/test";

const ROUTES = ["/", "/z-ai", "/mimo"] as const;

async function goto(page: Page, route: string) {
  await page.goto(route, { waitUntil: "networkidle" });
  // Sprache zurücksetzen: de-EE Locale → Default deutsch; sicherstellen, dass
  // Nicht-Assert-Aussagen unabhängig vom gespeicherten Zustand sind.
}

async function bodyText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText);
}

let errors = "";
test.beforeEach(async ({ page }) => {
  errors = "";
  page.on("console", (m) => {
    if (m.type() === "error") errors += m.text() + "\n";
  });
  page.on("pageerror", (e) => (errors += String(e) + "\n"));
});
test.afterEach(() => {
  expect(errors, "keine console/page errors").toBe("");
});

test.describe("Smoke: alle Routen rendern", () => {
  for (const route of ROUTES) {
    test(`${route} lädt ohne Fehler`, async ({ page }) => {
      await goto(page, route);
      expect(await bodyText(page)).toBeTruthy();
    });
  }
});

test.describe("Sprach-Switch DE/EN", () => {
  test("//z-ai: DE→EN→DE wechselt sichtbaren Text", async ({ page }) => {
    await goto(page, "/z-ai");
    await page.getByTitle("Deutsch").click();
    const tDe = await bodyText(page);
    expect(tDe).toContain("Preise");
    expect(tDe).toContain("Monatlich");
    expect(tDe).toContain("Plan-Vergleich");
    expect(tDe).not.toContain("Prices");

    await page.getByTitle("English").click();
    const tEn = await bodyText(page);
    expect(tEn).toContain("Prices");
    expect(tEn).toContain("Monthly");
    expect(tEn).toContain("Plan comparison");
    expect(tEn).not.toContain("Preise");

    await page.getByTitle("Deutsch").click();
    expect(await bodyText(page)).toContain("Preise");
  });

  test("/ wechselt zwischen Provider-Pläne und Provider Plans", async ({ page }) => {
    await goto(page, "/");
    await page.getByTitle("Deutsch").click();
    expect(await bodyText(page)).toContain("Provider-Pläne");
    await page.getByTitle("English").click();
    expect(await bodyText(page)).toContain("Provider Plans");
  });
});

test.describe("Billing-Cycle oben + Wert ändert sich", () => {
  test("/z-ai: Cycle-Umschalter liegt über der Preistabelle und ändert den Preis", async ({ page }) => {
    await goto(page, "/z-ai");
    await page.getByTitle("Deutsch").click();

    const cycle = page.getByTestId("cycle-selector");
    const priceStat = page.getByTestId("hero-price");
    await expect(cycle).toBeVisible();

    // Umschalter ist ÜBER der Preistabelle (§ Preise).
    const cy = (await cycle.boundingBox())!.y;
    const pricesHeading = page.locator("#prices");
    const py = (await pricesHeading.boundingBox())!.y;
    expect(cy).toBeLessThan(py);

    // Lite monatlich → $18.00
    expect((await priceStat.textContent())!.trim()).toBe("$18.00");

    await page.getByRole("button", { name: "Quartal (−20%)" }).click();
    expect((await priceStat.textContent())!.trim()).toBe("$14.40");
    await expect(page.getByTestId("cycle-badge")).toContainText("Quartal");

    await page.getByRole("button", { name: "Jährlich (−30%)" }).click();
    expect((await priceStat.textContent())!.trim()).toBe("$12.60");
    await expect(page.getByTestId("cycle-badge")).toContainText("Jährlich");
  });

  test("/mimo: Jahres-Zyklus ändert Preis (Lite $6 → $5.28)", async ({ page }) => {
    await goto(page, "/mimo");
    await page.getByTitle("Deutsch").click();
    const priceStat = page.getByTestId("hero-price");
    expect((await priceStat.textContent())!.trim()).toBe("$6.00");
    await page.getByRole("button", { name: /Jährlich/i }).click();
    expect((await priceStat.textContent())!.trim()).toBe("$5.28");
  });
});

test.describe("Startseite: Karten + logischer CTA", () => {
  test("beide Vendor-Karten mit erklärendem CTA verlinken korrekt", async ({ page }) => {
    await goto(page, "/");
    await page.getByTitle("Deutsch").click();
    const text = await bodyText(page);
    expect(text).toContain("z.ai — GLM Coding Plan");
    expect(text).toContain("Xiaomi MiMo — Token Plan");
    expect(text).toContain("Plan ansehen");

    const zaiCard = page.locator('a[aria-label="z.ai — GLM Coding Plan"]');
    await expect(zaiCard).toHaveAttribute("href", "/z-ai");
    await zaiCard.click();
    await page.waitForURL("**/z-ai");
    expect(new URL(page.url()).pathname).toBe("/z-ai");
    await expect(bodyText(page)).resolves.toContain("GLM-5.3");

    await page.goto("/", { waitUntil: "networkidle" });
    const mimoCard = page.locator('a[aria-label="Xiaomi MiMo — Token Plan"]');
    await expect(mimoCard).toHaveAttribute("href", "/mimo");
    await mimoCard.click();
    await page.waitForURL("**/mimo");
    expect(new URL(page.url()).pathname).toBe("/mimo");
    await expect(bodyText(page)).resolves.toContain("mimo-v2.5");
  });
});

test.describe("Badges sichtbar", () => {
  test("/ : pool- und Plan-Badges haben sichtbaren Hintergrund/Rahmen", async ({ page }) => {
    await goto(page, "/");
    await page.getByTitle("Deutsch").click();

    const badges = page.locator(".badge");
    const n = await badges.count();
    expect(n).toBeGreaterThan(4); // 2× pool + ≥2× plan-Namen

    // mindestens je einmal: primary (gefüllt) und outline (Rahmen)
    const primary = page.locator(".badge.badge-primary").first();
    await expect(primary).toBeVisible();
    const bg = await primary.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(alphaOf(bg)).toBeGreaterThan(0);

    const outline = page.locator(".badge.badge-outline").first();
    await expect(outline).toBeVisible();
    const border = await outline.evaluate((el) =>
      getComputedStyle(el).borderTopColor ? getComputedStyle(el).borderTopColor : ""
    );
    // outline-Badges bekommen über box-shadow/Border einen sichtbaren Rahmen in daisyUI 5.
    const style = await outline.evaluate((el) => {
      const cs = getComputedStyle(el);
      return `${cs.backgroundColor} | ${cs.boxShadow} | ${cs.borderTopWidth} ${cs.borderTopStyle}`;
    });
    expect(style).not.toContain("none 0px");
  });

  test("/z-ai : Cycle-Badge + Titel sind sichtbar (nicht transparent)", async ({ page }) => {
    await goto(page, "/z-ai");
    await page.getByTitle("Deutsch").click();
    const badge = page.getByTestId("cycle-badge");
    await expect(badge).toBeVisible();
    const bg = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(alphaOf(bg)).toBeGreaterThan(0);
  });
});

test.describe("Peak/Off-Peak-Zeilen", () => {
  test("/z-ai: GLM-5.3 als peak+off-peak, inaktive Zeile gedimmt (Timer sichtbar)", async ({ page }) => {
    await goto(page, "/z-ai");
    await page.getByTitle("Deutsch").click();
    const glm53 = page.locator("tr", { hasText: "GLM-5.3", hasNotText: "Flash" });
    await expect(glm53).toHaveCount(2);
    // genau eine gedimmt (aktuell inaktive Phase), eine normal
    const dimmed = page.locator("tr.opacity-50", { hasText: "GLM-5.3", hasNotText: "Flash" });
    const other = page.locator("tr:not(.opacity-50)", { hasText: "GLM-5.3", hasNotText: "Flash" });
    await expect(dimmed).toHaveCount(1);
    await expect(other).toHaveCount(1);
    // Timer (PeakIndicator) vorhanden
    await expect(page.locator("[class*='schedule']").first()).toBeVisible();
  });
});

test.describe("Impressum/Datenschutz (eigene Seiten)", () => {
  test("/impressum enthält Name, Adresse, E-Mail und Rechts-Hinweis", async ({ page }) => {
    await goto(page, "/impressum");
    await page.getByTitle("Deutsch").click();
    const text = await bodyText(page);
    expect(text).toContain("Florian Reisinger");
    expect(text).toContain("4020 Linz");
    expect(text).toContain("hello@all-the.rest");
    expect(text).toContain("§ 5 ECG");
  });

  test("/datenschutz enthält Datenschutz-Rechte, aber kein Impressum-Duplikat", async ({ page }) => {
    await goto(page, "/datenschutz");
    await page.getByTitle("Deutsch").click();
    const text = await bodyText(page);
    expect(text).toContain("Datenschutzbehörde");
    expect(text).not.toContain("Robert-Stolz-Straße");
  });

  test("/ und /z-ai zeigen keine eingebetteten Rechtssektionen (kein Duplikat)", async ({ page }) => {
    await goto(page, "/");
    await page.getByTitle("Deutsch").click();
    expect(await bodyText(page)).not.toContain("Robert-Stolz-Straße");
    await page.goto("/z-ai", { waitUntil: "networkidle" });
    expect(await bodyText(page)).not.toContain("Robert-Stolz-Straße");
  });
});

test.describe("Abrechnungszeiträume", () => {
  test("/mimo zeigt keine Quartals-Felder (nur Monat + Jahr)", async ({ page }) => {
    await goto(page, "/mimo");
    await page.getByTitle("Deutsch").click();
    const labels = await page.locator('[data-testid="cycle-selector"] button').allTextContents();
    expect(labels.join(" | ")).toContain("Monatlich");
    expect(labels.join(" | ")).toContain("Jährlich");
    expect(labels.join(" | ")).not.toContain("Quartal");
    const comp = await page.locator("#comparison").textContent();
    expect(comp).not.toContain("Quartal");
  });

  test("/z-ai zeigt Quartal + Jahr", async ({ page }) => {
    await goto(page, "/z-ai");
    await page.getByTitle("Deutsch").click();
    const labels = await page.locator('[data-testid="cycle-selector"] button').allTextContents();
    expect(labels.join(" | ")).toContain("Quartal");
    expect(labels.join(" | ")).toContain("Jährlich");
  });
});

test.describe("Header-Navigation", () => {
  test("kein separates Start/Home-Nav-Item; nur Vendor-Tabs", async ({ page }) => {
    await goto(page, "/z-ai");
    await page.getByTitle("Deutsch").click();
    const labels = await page.locator('[role="navigation"] [role="tab"]').allTextContents();
    expect(labels.join(" | ")).not.toContain("Start");
    expect(labels.length).toBe(2);
  });
});

function alphaOf(rgba: string): number {
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) return 1;
  const parts = m[1].split(",").map((s) => parseFloat(s));
  return parts.length === 4 ? parts[3] : 1; // rgb(a) ohne Alpha → 1
}