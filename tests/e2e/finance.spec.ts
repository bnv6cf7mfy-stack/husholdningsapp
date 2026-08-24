// Finance v1.0 end-to-end flow. Requires a seeded test user with an existing
// household (E2E_TEST_EMAIL / E2E_TEST_PASSWORD) since Playwright drives the
// real login flow; skipped when those are not configured.
//
// Status as of this change: NOT executed in this environment (no Playwright
// browsers installed / no seeded E2E test account configured here). Run with
// `npm run test:e2e` once credentials are available.
import { test, expect } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured");

test("household member can register an account, a cash flow and run a forecast", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(email!);
  await page.getByLabel("Passord").fill(password!);
  await page.getByRole("button", { name: "Logg inn" }).click();

  await page.waitForURL(/\/dashboard/);
  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: "Oversikt" })).toBeVisible();

  await page.getByPlaceholder("Brukskonto").fill("E2E brukskonto");
  await page.getByRole("button", { name: "Legg til konto" }).click();
  await expect(page.getByText("E2E brukskonto")).toBeVisible();

  await page.getByPlaceholder("Lønn / Husleie").fill("E2E lønn");
  await page.locator("input[placeholder='0']").first().fill("50000");
  await page.getByRole("button", { name: "Legg til" }).click();
  await expect(page.getByText("E2E lønn")).toBeVisible();

  await page.getByRole("button", { name: "Kjør prognose" }).click();
  await expect(page.getByText("Minimum nødvendig buffer")).toBeVisible();
});
