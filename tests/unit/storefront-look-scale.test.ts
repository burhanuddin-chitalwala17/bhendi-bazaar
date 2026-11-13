/**
 * A store's product page and themed type sit on the platform scale (storefront-look R1, R3; Q2, Q7).
 * The title is a headline in the theme's display face; the price is title size inside a store.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const DETAILS = readFileSync("src/components/product/product-details.tsx", "utf8");
const PRICE = readFileSync("src/components/shared/PriceDisplay.tsx", "utf8");
const CSS = readFileSync("src/app/globals.css", "utf8");

describe("product page title and price inside a store (storefront-look A1)", () => {
  it("the title is set in the display face at headline size, with the theme's weight", () => {
    const h1 = DETAILS.match(/<h1 className="([^"]+)"/)?.[1] ?? "";
    expect(h1.split(" ")).toEqual(expect.arrayContaining(["font-display", "text-headline", "font-display-weight"]));
    expect(h1).not.toMatch(/\bfont-heading\b|\bfont-semibold\b/);
  });

  it("the large price drops to title size inside a themed shell", () => {
    const lg = PRICE.match(/lg: \{ price: "([^"]+)"/)?.[1] ?? "";
    expect(lg.split(" ")).toEqual(expect.arrayContaining(["text-headline", "in-data-theme:text-title"]));
  });

  it("outside a theme the display weight and case fall back to the platform's", () => {
    expect(CSS).toMatch(/@utility font-display-weight \{\s*font-weight: var\(--font-display-weight, 600\);/);
    expect(CSS).toMatch(/@utility display-case \{\s*text-transform: var\(--display-case, none\);/);
  });
});
