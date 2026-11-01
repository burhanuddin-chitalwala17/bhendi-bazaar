/**
 * Every theme looks finished with a name, a logo and one product (storefront-themes A4, R10,
 * Q17): no empty image box, the theme's pattern where a photo is missing, and sections with
 * nothing to show absent rather than blank. Proof stays derived and closes up under its
 * floors (A7, Q15, Q34); claims are drawn apart from facts (Q21).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/components/support/contact-launcher", () => ({
  ContactLauncher: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { ThemedSections } from "@/components/storefront/themed/themed-sections";
import {
  bestSellingSlice,
  whyBuySlice,
  type ThemedPageData,
} from "@/components/storefront/themed/page-data";
import type { Product } from "@/domain/product";
import { SECTION, THEME_KEYS } from "@server/catalog/storefront-themes";

const product = (id: string, overrides: Partial<Product> = {}): Product =>
  ({
    id,
    slug: `piece-${id}`,
    name: `Piece ${id}`,
    price: 120000,
    stock: 3,
    lowStockThreshold: 1,
    thumbnail: `/p-${id}.webp`,
    categorySlug: "attar",
    rating: 0,
    reviewsCount: 0,
    ...overrides,
  }) as Product;

const bare = (overrides: Partial<ThemedPageData> = {}): ThemedPageData => ({
  handle: "noor",
  name: "Noor Attar House",
  logoUrl: "/logo.webp",
  heroPhotos: [],
  heroLine: null,
  tagline: null,
  productCount: 1,
  bestSelling: [],
  newIn: [product("1")],
  collections: [],
  proof: null,
  since: 2024,
  dispatchDays: null,
  returns: { preset: "STANDARD", note: null },
  claims: [],
  about: null,
  owner: null,
  reviews: null,
  area: null,
  hoursToday: null,
  hiddenSections: [],
  ...overrides,
});

const sectionsOn = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-section]")].map((el) => el.getAttribute("data-section"));

describe.each(THEME_KEYS)("%s with a name, a logo and one product (A4)", (theme) => {
  it("draws the pattern where the hero photo is missing, and the product", () => {
    const { container } = render(<ThemedSections theme={theme} page={bare()} />);
    const hero = container.querySelector(`[data-section="${SECTION.HERO}"]`) as HTMLElement;
    expect(within(hero).getByTestId("theme-pattern")).toBeTruthy();
    expect(within(hero).getByRole("heading", { level: 1 }).textContent).toBe("Noor Attar House");
    expect(screen.getByText("Piece 1")).toBeTruthy();
    expect(container.textContent).not.toMatch(/undefined|null|NaN/);
  });

  it("closes up every section with nothing to show", () => {
    const { container } = render(<ThemedSections theme={theme} page={bare()} />);
    expect(sectionsOn(container)).toEqual(
      expect.not.arrayContaining([SECTION.BEST_SELLING, SECTION.WHY_BUY, SECTION.STORY, SECTION.REVIEWS, SECTION.COLLECTIONS, SECTION.DEALS]),
    );
    for (const img of container.querySelectorAll("img")) expect(img.getAttribute("src")).toBeTruthy();
  });

  it("with nothing on sale says the shop is setting up, and keeps its story and visit (ux.md landing Empty)", () => {
    const page = bare({ productCount: 0, newIn: [], about: "Three generations of attar." });
    const { container } = render(<ThemedSections theme={theme} page={page} />);
    expect(screen.getByText("Noor Attar House is setting up. Check back soon.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Shop all of Bhendi Bazaar" }).getAttribute("href")).toBe("/");
    expect([...sectionsOn(container)].sort()).toEqual([SECTION.HERO, SECTION.STORY, SECTION.VISIT].sort());
    expect(screen.queryByText(/Shop all \d/)).toBeNull();
  });
});

describe("a product with no photo draws the pattern, not an empty box (R10)", () => {
  it.each(THEME_KEYS)("%s", (theme) => {
    const { container } = render(
      <ThemedSections theme={theme} page={bare({ newIn: [product("1", { thumbnail: "" })] })} />,
    );
    const shelf = container.querySelector(`[data-section="${SECTION.NEW_IN}"]`) as HTMLElement;
    expect(within(shelf).getByTestId("theme-pattern")).toBeTruthy();
  });
});

describe("hidden sections are the shop's own words only (Q9)", () => {
  it("hiding story, collections and visit leaves them out of every theme", () => {
    const page = bare({
      about: "Our words.",
      collections: [{ slug: "attar", name: "Attar", photoUrl: null }],
      hiddenSections: [SECTION.STORY, SECTION.COLLECTIONS, SECTION.VISIT],
    });
    for (const theme of THEME_KEYS) {
      const { container, unmount } = render(<ThemedSections theme={theme} page={page} />);
      expect(sectionsOn(container)).toEqual(
        expect.not.arrayContaining([SECTION.STORY, SECTION.COLLECTIONS, SECTION.VISIT]),
      );
      unmount();
    }
  });
});

describe("best selling are derived and need four to be best (Q34, Q23)", () => {
  it("three close up; four show; never more than eight", () => {
    const n = (count: number) => Array.from({ length: count }, (_, i) => product(String(i)));
    expect(bestSellingSlice(bare({ bestSelling: n(3) }))).toBeNull();
    expect(bestSellingSlice(bare({ bestSelling: n(4) }))?.products).toHaveLength(4);
    expect(bestSellingSlice(bare({ bestSelling: n(12) }))?.products).toHaveLength(8);
  });
});

describe("why buy from us (Q21, R8, A7)", () => {
  it("a four-digit review count is grouped like every other count", () => {
    const slice = whyBuySlice(bare({ proof: { rating: { average: 4.8, count: 1212 }, ordersFulfilled: null } }));
    expect(slice?.facts[0].text).toBe("★ 4.8 from 1,212 reviews");
  });

  it("since-when and the returns preset alone are not a reason: the section closes up", () => {
    expect(whyBuySlice(bare())).toBeNull();
  });

  it("derived facts open it, worded as the copy deck", () => {
    const slice = whyBuySlice(
      bare({ proof: { rating: { average: 4.8, count: 212 }, ordersFulfilled: 1400 }, dispatchDays: 2 }),
    );
    expect(slice?.facts.map((f) => f.text)).toEqual([
      "★ 4.8 from 212 reviews",
      "1,400+ orders delivered",
      "Ships in 2 days",
      "On Bhendi Bazaar since 2024",
      "Bhendi Bazaar's standard returns",
    ]);
  });

  it("draws the shop's claims apart from what the platform knows", () => {
    const page = bare({
      proof: { rating: null, ordersFulfilled: 12 },
      claims: [{ label: "BIS hallmarked", detail: "every piece, card in the box" }],
    });
    render(<ThemedSections theme={THEME_KEYS[0]} page={page} />);
    const facts = screen.getByRole("list", { name: "What Bhendi Bazaar knows about this shop" });
    const claims = screen.getByRole("list", { name: "What the shop says" });
    expect(within(claims).getByText(/BIS hallmarked/)).toBeTruthy();
    expect(within(facts).queryByText(/BIS hallmarked/)).toBeNull();
  });

  it("a derived day count of 1 or 0 reads as words, not '1 days' (Q38)", () => {
    const text = (dispatchDays: number) =>
      whyBuySlice(bare({ proof: { rating: null, ordersFulfilled: 12 }, dispatchDays }))?.facts.find((f) => f.key === "dispatch")?.text;
    expect(text(1)).toBe("Ships in 1 day");
    expect(text(0)).toBe("Ships today");
    const { container } = render(<ThemedSections theme={THEME_KEYS[0]} page={bare({ dispatchDays: 1 })} />);
    const visit = container.querySelector(`[data-section="${SECTION.VISIT}"]`) as HTMLElement;
    expect(within(visit).getByText("Dispatch in 1 day")).toBeTruthy();
  });
});

describe("the hero counts one product in the singular", () => {
  it("never says '1 products', and says '1 product' where the count is shown", () => {
    const containers = THEME_KEYS.map(
      (theme) => render(<ThemedSections theme={theme} page={bare()} />).container,
    );
    for (const c of containers) expect(within(c).queryAllByText(/\b1 products/)).toHaveLength(0);
    // Per element, not the page's joined text: adjacent nodes glue ("1 productShop all").
    expect(containers.some((c) => within(c).queryAllByText(/\b1 product\b/).length > 0)).toBe(true);
  });
});
