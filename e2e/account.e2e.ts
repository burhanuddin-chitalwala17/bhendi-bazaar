import { expect, test } from "@playwright/test";
import { E2E_BUYER } from "./fixtures";

// A phone hides the navbar's profile menu, so the Account tab is the only way to a shop or out.

test.beforeEach(async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel(/email/i).first().fill(E2E_BUYER.email);
  await page.getByLabel(/^password$/i).first().fill(E2E_BUYER.password);
  await page.locator("form").getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).not.toHaveURL(/\/signin/);
});

test("signed in, the Account page leads to Your shop", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("link", { name: "Your shop" }).click();
  await expect(page).toHaveURL(/\/org(\/|$)/);
});

test("signed in, the Account page signs out", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).last().click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/profile");
  await expect(page.getByRole("link", { name: "Your shop" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});
