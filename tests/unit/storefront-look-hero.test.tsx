/**
 * The hero is never bare (storefront-look R4, R5, R9; Q3, Q4, Q11) and Darbar's categories are
 * compact (R7, Q5). Layout against the prototype is checked by hand; these pin what each hero holds.
 */
import { describe, expect, it, vi } from "vitest";
import { render, within } from "@testing-library/react";

vi.mock("@/components/support/contact-launcher", () => ({
  ContactLauncher: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { ThemedSections } from "@/components/storefront/themed/themed-sections";
import { featuredProducts, type ThemedPageData } from "@/components/storefront/themed/page-data";
import type { Product } from "@/domain/product";
import { SECTION, THEME_KEYS } from "@server/catalog/storefront-themes";

const product = (id: string, overrides: Partial<Product> = {}): Product =>
  ({
    id, slug: `piece-${id}`, name: `Piece ${id}`, price: 65000, stock: 3, lowStockThreshold: 1,
    thumbnail: `/p-${id}.webp`, categorySlug: "bags", rating: 0, reviewsCount: 0, ...overrides,
  }) as Product;

const page = (overrides: Partial<ThemedPageData> = {}): ThemedPageData => ({
  handle: "niqab-boutique", name: "Niqab Boutique", logoUrl: "/logo.webp",
  heroPhotos: ["/hero.webp"], heroLine: "Crafted for Modesty", tagline: null, productCount: 112,
  bestSelling: ["1", "2", "3", "4", "5"].map((id) => product(id)), newIn: [product("9")],
  offers: [], dealProducts: [],
  collections: ["Handbags", "Abayas", "Niqabs", "Hijabs", "Kaftans", "Sling bags"].map((name) => ({ slug: name.toLowerCase(), name, photoUrl: null })),
  proof: { rating: { average: 4.7, count: 38 }, ordersFulfilled: null }, since: 2019, dispatchDays: null,
  returns: null, claims: [], about: null, owner: null, reviews: null, area: null, hoursToday: null, hiddenSections: [],
  ...overrides,
});

const heroOf = (container: HTMLElement) => container.querySelector(`[data-section="${SECTION.HERO}"]`) as HTMLElement;

describe.each(THEME_KEYS)("%s hero (storefront-look A2, A3)", (theme) => {
  it("holds the shop's identity beside or below the photo, never on it", () => {
    const hero = heroOf(render(<ThemedSections theme={theme} page={page()} />).container);
    expect(within(hero).getByRole("heading", { level: 1 }).textContent).toBe("Niqab Boutique");
    expect(within(hero).getByText("Crafted for Modesty")).toBeTruthy();
    expect(within(hero).getByText("Since 2019")).toBeTruthy();
    expect(within(hero).getByText("112 products")).toBeTruthy();
    expect(within(hero).getByText("★ 4.7 (38)")).toBeTruthy();
    // Text sits outside the photo box: no heading inside the photo slot (Q3).
    for (const photo of hero.querySelectorAll("[data-hero-photo]")) {
      expect(photo.querySelector("h1")).toBeNull();
    }
  });

  it("with no photo and one product still has no empty area (R9)", () => {
    const hero = heroOf(
      render(<ThemedSections theme={theme} page={page({ heroPhotos: [], productCount: 1, bestSelling: [], newIn: [product("1")], proof: null })} />).container,
    );
    expect(within(hero).getAllByTestId("theme-pattern").length).toBeGreaterThan(0);
    expect(within(hero).getByText("1 product")).toBeTruthy();
    expect(within(hero).queryByText(/★/)).toBeNull();
  });
});

describe("featured products (storefront-look Q11)", () => {
  it("are the first best selling, skipping sold out, then new in", () => {
    const p = page({ bestSelling: [product("1", { stock: 0 }), product("2"), product("3")], newIn: [product("2"), product("9")] });
    expect(featuredProducts(p, 3).map((x) => x.id)).toEqual(["2", "3", "9"]);
  });
});

describe("Darbar's categories are a compact rail (storefront-look A5)", () => {
  it("shows every collection in one rail, not three full-width tiles", () => {
    const { container } = render(<ThemedSections theme="darbar" page={page()} />);
    const section = container.querySelector(`[data-section="${SECTION.COLLECTIONS}"]`) as HTMLElement;
    const items = section.querySelectorAll("li");
    expect(items).toHaveLength(6);
    for (const item of items) expect(item.className).toMatch(/\bw-28\b/);
  });
});

describe("Daily's banner rail (storefront-look D3, Q3)", () => {
  const banner = (id: string, title?: string) => ({
    id,
    title,
    image: {
      alt: title ?? "",
      phone: { src: `/b-${id}-p.webp`, fit: "crop", position: { x: 0.5, y: 0.5 }, fill: null },
      desktop: { src: `/b-${id}-d.webp`, fit: "crop", position: { x: 0.5, y: 0.5 }, fill: null },
    } as never,
    actions: [{ label: "Shop now", href: "/store/niqab-boutique/shop" }],
  });

  it("leads with the shop's banners, then its photos, three at most, the title on a solid label", () => {
    const hero = heroOf(
      render(<ThemedSections theme="daily" page={page({ banners: [banner("a", "Eid Edit"), banner("b")], heroPhotos: ["/h1.webp", "/h2.webp"] })} />).container,
    );
    const slides = hero.querySelectorAll("li[class*='snap-start']");
    expect(slides).toHaveLength(3);
    const label = within(hero).getByText("Eid Edit");
    expect(label.closest("p")?.className).toMatch(/\bbg-card\b/);
    expect(within(hero).getAllByRole("link").some((a) => a.getAttribute("href") === "/store/niqab-boutique/shop")).toBe(true);
  });

  it("with two slides the main one never spans two rows, so no cell is left blank (R9)", () => {
    const hero = heroOf(render(<ThemedSections theme="daily" page={page({ heroPhotos: ["/h1.webp", "/h2.webp"] })} />).container);
    const slides = [...hero.querySelectorAll("li[class*='snap-start']")];
    expect(slides).toHaveLength(2);
    expect(slides[0].className).not.toMatch(/row-span-2/);
  });
});
