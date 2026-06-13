/**
 * E2E: Screening flows. Requires backend + seed (make dev + make seed).
 */
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("mlro@vasp.pk");
  await page.getByLabel("Password").fill("demo123");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/overview/, { timeout: 10000 });
});

test.describe("Screening Results", () => {
  test("navigates to screening results and loads table", async ({ page }) => {
    await page.goto("/screening/results");
    await expect(page.getByRole("heading", { name: /Screening Results/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Screened Name|No screening results/i)).toBeVisible({ timeout: 5000 });
  });

  test("status filter dropdown works", async ({ page }) => {
    await page.goto("/screening/results");
    await expect(page.getByRole("heading", { name: /Screening Results/i })).toBeVisible({ timeout: 5000 });
    const statusSelect = page.locator("select").first();
    await statusSelect.selectOption("pending");
    await expect(page).toHaveURL(/\?.*status=pending/);
  });
});

test.describe("Batch Screening", () => {
  test("navigates to batch jobs", async ({ page }) => {
    await page.goto("/screening/batch");
    await expect(page.getByRole("heading", { name: /Batch Screening/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/job|records|status|No batch jobs/i)).toBeVisible({ timeout: 5000 });
  });
});
