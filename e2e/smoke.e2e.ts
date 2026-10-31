import { expect, test } from "@playwright/test";
import { E2E_PRODUCT } from "./fixtures";

// The journeys a broken deploy would break first. Each must pass before production ships.

test("home renders with a nonce CSP", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src[^;]*'nonce-[^']+'/);
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  await expect(page.locator("body")).toBeVisible();
});

test("an unknown product or category answers 404, not a soft 200", async ({ request }) => {
  expect((await request.get("/product/zz-e2e-not-real")).status()).toBe(404);
  expect((await request.get("/category/zz-e2e-not-real")).status()).toBe(404);
});

test("browse a category, open the product, add it to the cart", async ({ page }) => {
  await page.goto("/category/test-fixtures");
  await page.getByRole("link", { name: new RegExp(E2E_PRODUCT.name, "i") }).first().click();

  await expect(page).toHaveURL(new RegExp(`/product/${E2E_PRODUCT.slug}$`));
  await expect(page.getByRole("heading", { name: E2E_PRODUCT.name })).toBeVisible();
  await expect(page.getByText("499").first()).toBeVisible();

  await page.getByRole("button", { name: /add to cart/i }).click();
  // The cart is written after the confirmation's delay; leaving before it would lose the item.
  await expect(page.getByText("Added to cart")).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByText(E2E_PRODUCT.name).first()).toBeVisible();
  await expect(page.getByText(/your cart is quiet/i)).toHaveCount(0);
});

test("an empty cart says so", async ({ page }) => {
  await page.goto("/cart");
  await expect(page.getByText(/your cart is quiet/i)).toBeVisible();
});

test("sign-in offers email and password", async ({ page }) => {
  const response = await page.goto("/signin");
  expect(response?.status()).toBe(200);
  await expect(page.getByLabel(/email/i).first()).toBeVisible();
  await expect(page.getByLabel(/password/i).first()).toBeVisible();
});
