import { test, expect } from "@playwright/test";

test("foundation landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Husholdningsapp foundation er opprettet")).toBeVisible();
});
