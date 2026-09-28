/**
 * A brand page is a fixed sequence of sections that self-omit (brand-page R1, R2, D4).
 *
 * The rule is a property of `brandPageSections`, not a review item: an empty slice is
 * absent from the list, the order never changes, and the page renders the list. These
 * tests pin both halves — and the one section that never omits, because a shop with
 * nothing listed shows the storefront's honest empty state rather than a gap (A1).
 */
import { describe, expect, it } from "vitest";
import {
  BRAND_PAGE_SECTION_ORDER,
  brandPageSections,
  buyersSaySlice,
  newestSlice,
  storySlice,
} from "@/components/storefront/brand-page/sections";
import { brandNamesCarried } from "@server/catalog/storefront.types";
import type { BrandPage } from "@/data-access-layer/storefront.dal";
import type { Category } from "@/domain/category";
import type { Product } from "@/domain/product";
import type { ShopReviewDto } from "@server/catalog/review.types";

const category = { id: "c1", slug: "silks", name: "Silks" } as Category;
const product = { id: "p1", slug: "saree", name: "Saree" } as Product;
const review = (id: string): ShopReviewDto => ({
  id,
  rating: 5,
  comment: "Lovely.",
  authorName: "A buyer",
  isVerifiedPurchase: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  product: { name: "Saree", slug: "saree" },
});

/** A shop that has filled everything in. Overrides take it back towards a bare one. */
const full = (overrides: Partial<BrandPage> = {}): BrandPage => ({
  id: "org_1",
  handle: "silks",
  name: "Silks & Co",
  tagline: "Silks since 1985",
  heroUrl: "https://img.example/hero.webp",
  logoUrl: "https://img.example/logo.webp",
  accent: null,
  location: "Mumbai",
  since: 2021,
  about: "Who we are.",
  story: "The longer story.",
  deliveryPolicy: "3 to 5 days",
  returnsPolicy: "7 days",
  brands: ["Silks & Co", "Zari House"],
  social: [{ network: "instagram", label: "Instagram", handle: "silks", href: "https://www.instagram.com/silks/" }],
  proof: null,
  buyersSay: [review("r1"), review("r2"), review("r3")],
  categories: [category],
  newest: [product],
  ...overrides,
});

/** A shop with only a name and a handle (spec A1). */
const bare = (): BrandPage =>
  full({
    tagline: null,
    heroUrl: null,
    logoUrl: null,
    location: null,
    about: null,
    story: null,
    deliveryPolicy: null,
    returnsPolicy: null,
    brands: null,
    social: null,
    buyersSay: null,
    categories: [],
    newest: [],
  });

describe("brandPageSections", () => {
  it("renders every section, in the platform's order, when everything is present", () => {
    expect(brandPageSections(full())).toEqual([...BRAND_PAGE_SECTION_ORDER]);
  });

  it("opens with the hero and closes with the ways to follow", () => {
    expect(BRAND_PAGE_SECTION_ORDER[0]).toBe("hero");
    expect(BRAND_PAGE_SECTION_ORDER.at(-1)).toBe("social");
  });

  it("keeps the order fixed whatever is missing", () => {
    const some = brandPageSections(full({ about: null, story: null, brands: null }));
    const positions = some.map((key) => BRAND_PAGE_SECTION_ORDER.indexOf(key));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(some).not.toContain("story");
    expect(some).not.toContain("brands");
  });

  it("gives a shop with only a name a hero and the honest goods state, and nothing else (A1)", () => {
    expect(brandPageSections(bare())).toEqual(["hero", "newest"]);
  });

  it("omits the story when neither the introduction nor the longer story is written", () => {
    expect(brandPageSections(full({ about: null, story: null }))).not.toContain("story");
    expect(brandPageSections(full({ about: null }))).toContain("story");
    expect(brandPageSections(full({ story: null }))).toContain("story");
    expect(storySlice(full({ about: null, story: null }))).toBeNull();
  });

  it("omits the categories when the shop sells in none", () => {
    expect(brandPageSections(full({ categories: [] }))).not.toContain("categories");
  });

  it("omits brands carried with one brand, through the service's rule (D8)", () => {
    expect(brandPageSections(full({ brands: brandNamesCarried([{ name: "Only" }]) }))).not.toContain("brands");
    expect(brandPageSections(full({ brands: [] }))).not.toContain("brands");
    expect(brandPageSections(full({ brands: brandNamesCarried([{ name: "A" }, { name: "B" }]) }))).toContain("brands");
  });

  it("shows the terms when either policy is written, and neither when both are blank", () => {
    expect(brandPageSections(full({ returnsPolicy: null }))).toContain("policies");
    expect(brandPageSections(full({ deliveryPolicy: null }))).toContain("policies");
    expect(brandPageSections(full({ deliveryPolicy: null, returnsPolicy: null }))).not.toContain("policies");
  });

  it("omits the ways to follow when no handle survived the allowlist", () => {
    expect(brandPageSections(full({ social: null }))).not.toContain("social");
    expect(brandPageSections(full({ social: [] }))).not.toContain("social");
  });

  it("places what buyers say after the brands and before the newest goods (R1)", () => {
    const order: readonly string[] = BRAND_PAGE_SECTION_ORDER;
    expect(order.indexOf("buyersSay")).toBe(order.indexOf("brands") + 1);
    expect(order.indexOf("newest")).toBe(order.indexOf("buyersSay") + 1);
  });

  it("omits what buyers say under the floor — the DTO carries null (D3) — and with nothing quoted", () => {
    expect(brandPageSections(full({ buyersSay: null }))).not.toContain("buyersSay");
    expect(brandPageSections(full({ buyersSay: [] }))).not.toContain("buyersSay");
    expect(buyersSaySlice(full({ buyersSay: null }))).toBeNull();
    expect(buyersSaySlice(full())).toEqual({ reviews: [review("r1"), review("r2"), review("r3")] });
  });

  it("never omits the newest goods: an empty shop shows its honest state, not a gap", () => {
    expect(brandPageSections(full({ newest: [] }))).toContain("newest");
    expect(newestSlice(full({ newest: [] }))).toEqual({ handle: "silks", name: "Silks & Co", products: [] });
  });
});
