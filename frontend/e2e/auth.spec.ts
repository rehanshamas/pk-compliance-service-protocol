/**
 * E2E: Auth flows. Requires backend + seed (make dev + make seed).
 */
import { test, expect } from "@playwright/test";

test.describe("Login", () => {
  test("shows login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /CIP Dashboard/i })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
  });

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("wrong@example.com");
    await page.getByLabel("Password").fill("wrong");
    await page.getByRole("button", { name: /Sign in/i }).click();
    await expect(page.getByText(/login failed|invalid/i)).toBeVisible({ timeout: 5000 });
  });

  test("MLRO login redirects to overview", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("mlro@vasp.pk");
    await page.getByLabel("Password").fill("demo123");
    await page.getByRole("button", { name: /Sign in/i }).click();
    await expect(page).toHaveURL(/\/overview/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: /Overview/i })).toBeVisible({ timeout: 5000 });
  });

  test("Admin login redirects to admin tenants", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@cip.pk");
    await page.getByLabel("Password").fill("admin123");
    await page.getByRole("button", { name: /Sign in/i }).click();
    await expect(page).toHaveURL(/\/admin\/tenants/, { timeout: 10000 });
  });
});
