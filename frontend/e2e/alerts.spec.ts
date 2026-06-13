/**
 * E2E: Alerts page. Requires backend + seed (make dev + make seed).
 */
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("mlro@vasp.pk");
  await page.getByLabel("Password").fill("demo123");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/overview/, { timeout: 10000 });
});

test("navigates to alerts and loads table", async ({ page }) => {
  await page.goto("/analytics/alerts");
  await expect(page.getByRole("heading", { name: /Alerts/i })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/Severity|Source|Summary|No alerts/i)).toBeVisible({ timeout: 5000 });
});
