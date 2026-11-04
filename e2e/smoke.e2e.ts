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

  await page.getByRole("button", { name: /add to bag/i }).click();
  // The bag is written after the confirmation's delay; leaving before it would lose the item.
  await expect(page.getByText("Added to your bag")).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByText(E2E_PRODUCT.name).first()).toBeVisible();
  await expect(page.getByText(/your bag is empty/i)).toHaveCount(0);

  // Checkout snapshots the cart once; it must wait for the saved cart, not snapshot nothing.
  await page.goto("/checkout");
  // A phone folds the summary's lines (StoreCheckout); open it as a buyer would. The name is in the
  // page twice (the phone's fold and the tablet's open column), so look for the one on screen.
  const fold = page.locator("summary", { hasText: /order summary/i });
  if (await fold.isVisible()) await fold.click();
  await expect(page.getByText(E2E_PRODUCT.name).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/your bag is empty/i)).toHaveCount(0);
});

test("an empty bag says so", async ({ page }) => {
  await page.goto("/cart");
  await expect(page.getByText(/your bag is empty/i).first()).toBeVisible();
});

test("sign-in offers email and password", async ({ page }) => {
  const response = await page.goto("/signin");
  expect(response?.status()).toBe(200);
  await expect(page.getByLabel(/email/i).first()).toBeVisible();
  await expect(page.getByLabel(/password/i).first()).toBeVisible();
});

// htmlLimitedBots itself is proved by the unit test of its pattern; this checks what Google is served.
test("a product page tells search what it costs", async ({ request }) => {
  const response = await request.get(`/product/${E2E_PRODUCT.slug}`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
  });
  expect(response.status()).toBe(200);
  const html = await response.text();
  const head = html.slice(0, html.indexOf("</head>"));
  expect(head).toContain(`rel="canonical"`);
  expect(head).toMatch(new RegExp(`<title>${E2E_PRODUCT.name} — Bhendi Bazaar</title>`));

  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "{}";
  const ld = JSON.parse(block);
  expect(ld["@type"]).toBe("Product");
  expect(ld.offers.price).toBe("499.00");
  expect(ld.offers.availability).toBe("https://schema.org/InStock");
});
