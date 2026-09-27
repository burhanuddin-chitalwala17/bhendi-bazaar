/**
 * A buyer learns an organisation's public face and nothing else (seller-identity R5,
 * seller-profile R2/A3). The storefront reads `OrgProfile` and takes only identity from
 * `Org`; these tests hold the two selects to an allowlist, so adding a column to either
 * table cannot widen a public payload without failing here. Mutation-tested by adding
 * `email: true` to the identity select.
 *
 * The brand page's DTO (brand-page D1, A7) is held the same way, by a literal key list —
 * and its brands slice is checked against the whole serialised payload, so a manufacturer
 * mapped through by accident fails here rather than reaching a page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PUBLIC_ORG_IDENTITY_SELECT,
  PUBLIC_PROFILE_SELECT,
} from "@server/catalog/org-profile.repository";
import { brandNamesCarried, toBrandPageDto } from "@server/catalog/storefront.types";

/** Everything a seller would happily print on a shop sign, and nothing they would not. */
const PUBLIC_PROFILE_FIELDS = [
  "tagline",
  "description",
  "logoUrl",
  "heroUrl",
  "accent",
  "deliveryPolicy",
  "returnsPolicy",
  "story",
  "location",
  "social",
].sort();
const PUBLIC_IDENTITY_FIELDS = ["id", "handle", "name", "joinedAt"].sort();

/** The private face, named so a future column that joins this list is caught by intent, not by luck. */
const PRIVATE_ORG_FIELDS = [
  "email",
  "phone",
  "contactPerson",
  "businessName",
  "gstNumber",
  "panNumber",
  "isVerified",
  "commissionBps",
  "maxDiscountBps",
];

/** What a brand knows that a buyer never learns (brand-page R10). */
const PRIVATE_BRAND_FIELDS = ["manufacturer", "packerOrImporter", "countryOfOrigin", "isDefault"];

/** The brand page's keys, as a literal: a new key is a decision made here, not a side effect. */
const BRAND_PAGE_FIELDS = [
  "id",
  "handle",
  "name",
  "tagline",
  "heroUrl",
  "logoUrl",
  "accent",
  "location",
  "since",
  "about",
  "story",
  "deliveryPolicy",
  "returnsPolicy",
  "brands",
  "social",
  "proof",
].sort();

describe("the storefront's public selects", () => {
  it("select exactly the public face of the profile", () => {
    expect(Object.keys(PUBLIC_PROFILE_SELECT).sort()).toEqual(PUBLIC_PROFILE_FIELDS);
  });

  it("take only identity from the organisation", () => {
    expect(Object.keys(PUBLIC_ORG_IDENTITY_SELECT).sort()).toEqual(PUBLIC_IDENTITY_FIELDS);
    for (const field of PRIVATE_ORG_FIELDS) {
      expect(field in PUBLIC_ORG_IDENTITY_SELECT, `${field} is private face`).toBe(false);
    }
  });
});

const fixture = {
  tagline: "Silks since 1985",
  description: "Who we are.",
  logoUrl: "https://img.example/logo.webp",
  heroUrl: "https://img.example/hero.webp",
  accent: "primary",
  deliveryPolicy: "3 to 5 days",
  returnsPolicy: "7 days",
  story: "A longer story.",
  location: "Bhendi Bazaar, Mumbai",
  social: { instagram: "silks" },
  org: { id: "org_1", handle: "silks", name: "Silks & Co", joinedAt: new Date("2021-03-04") },
};

/** The portal's own brand DTOs, private fields and all — what a careless mapping would leak. */
const brands = [
  { id: "b1", name: "Silks & Co", manufacturer: "Secret Mills Ltd", packerOrImporter: "Packers Inc", countryOfOrigin: "IN", isDefault: true, retiredAt: null },
  { id: "b2", name: "Zari House", manufacturer: "Other Mills", packerOrImporter: null, countryOfOrigin: "CN", isDefault: false, retiredAt: null },
];

/**
 * The about page's DTO is what it was before the columns moved (seller-profile A6): the same
 * keys, the same values, read from the profile instead of the org row.
 */
describe("storefrontDAL.getByHandle after the profile split", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@server/catalog/org-profile.repository", () => ({
      orgProfileRepository: {
        findPublicByHandle: vi.fn(async (handle: string) => (handle === "silks" ? fixture : null)),
        listPublicShops: vi.fn(async () => []),
      },
      PUBLIC_PROFILE_SELECT,
      PUBLIC_ORG_IDENTITY_SELECT,
    }));
  });

  it("returns the storefront shape unchanged", async () => {
    const { storefrontDAL } = await import("@/data-access-layer/storefront.dal");
    await expect(storefrontDAL.getByHandle("silks")).resolves.toEqual({
      id: "org_1",
      handle: "silks",
      name: "Silks & Co",
      about: "Who we are.",
      tagline: "Silks since 1985",
      logoUrl: "https://img.example/logo.webp",
      heroUrl: "https://img.example/hero.webp",
      accent: "primary",
      deliveryPolicy: "3 to 5 days",
      returnsPolicy: "7 days",
    });
  });

  it("answers null for a shop that is not there", async () => {
    const { storefrontDAL } = await import("@/data-access-layer/storefront.dal");
    await expect(storefrontDAL.getByHandle("nobody")).resolves.toBeNull();
  });
});

describe("the brand page's DTO", () => {
  it("carries exactly the allowlisted keys", () => {
    const dto = toBrandPageDto(fixture, brands);
    expect(Object.keys(dto).sort()).toEqual(BRAND_PAGE_FIELDS);
  });

  it("has no key from the private face, and no private value anywhere in the payload", () => {
    const dto = toBrandPageDto(fixture, brands);
    const serialised = JSON.stringify(dto);
    for (const field of [...PRIVATE_ORG_FIELDS, ...PRIVATE_BRAND_FIELDS]) {
      expect(field in dto, `${field} is private face`).toBe(false);
      expect(serialised, `${field} appears in the payload`).not.toContain(`"${field}"`);
    }
    expect(serialised).not.toContain("Secret Mills");
    expect(serialised).not.toContain("Packers Inc");
  });

  it("lists brands carried as names only, and only when there are two or more (D8)", () => {
    expect(toBrandPageDto(fixture, brands).brands).toEqual(["Silks & Co", "Zari House"]);
    expect(toBrandPageDto(fixture, brands.slice(0, 1)).brands).toBeNull();
    expect(toBrandPageDto(fixture, []).brands).toBeNull();
    expect(brandNamesCarried([{ name: "Only" }])).toBeNull();
  });

  it("derives since-when from the day the shop joined, and nothing is typed", () => {
    expect(toBrandPageDto(fixture, brands).since).toBe(2021);
    expect(toBrandPageDto(fixture, brands).proof).toBeNull();
  });

  it("treats blank text as absent, so a section fed whitespace has nothing to show", () => {
    const dto = toBrandPageDto(
      { ...fixture, description: "   ", story: "", tagline: " \n ", location: "  ", deliveryPolicy: " " },
      brands,
    );
    expect(dto.about).toBeNull();
    expect(dto.story).toBeNull();
    expect(dto.tagline).toBeNull();
    expect(dto.location).toBeNull();
    expect(dto.deliveryPolicy).toBeNull();
  });

  it("turns stored handles into composed links, and junk into nothing", () => {
    expect(toBrandPageDto(fixture, brands).social).toEqual([
      { network: "instagram", label: "Instagram", handle: "silks", href: "https://www.instagram.com/silks/" },
    ]);
    expect(toBrandPageDto({ ...fixture, social: null }, brands).social).toBeNull();
    expect(toBrandPageDto({ ...fixture, social: { instagram: "https://evil.example/x" } }, brands).social).toBeNull();
  });
});

describe("storefrontService.brandPage", () => {
  const list = vi.fn(async () => brands);

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@server/catalog/org-profile.repository", () => ({
      orgProfileRepository: {
        findPublicByHandle: vi.fn(async (handle: string) => (handle === "silks" ? fixture : null)),
      },
      PUBLIC_PROFILE_SELECT,
      PUBLIC_ORG_IDENTITY_SELECT,
    }));
    vi.doMock("@server/catalog/brand.service", () => ({ brandService: { list } }));
  });

  it("assembles the DTO from the public read and the brand aggregate's names", async () => {
    const { storefrontService } = await import("@server/catalog/storefront.service");
    const dto = await storefrontService.brandPage("silks");
    expect(dto).toMatchObject({ id: "org_1", handle: "silks", brands: ["Silks & Co", "Zari House"] });
    expect(Object.keys(dto!).sort()).toEqual(BRAND_PAGE_FIELDS);
    expect(list).toHaveBeenCalledWith("org_1");
  });

  it("answers null for a shop that is not there, without asking for brands", async () => {
    const { storefrontService } = await import("@server/catalog/storefront.service");
    await expect(storefrontService.brandPage("nobody")).resolves.toBeNull();
    expect(list).not.toHaveBeenCalled();
  });
});

/** The page's composed shape (brand-page D5): the DTO plus the marketplace's own two tile slices. */
describe("storefrontDAL.getBrandPage", () => {
  const dto = toBrandPageDto(fixture, brands);
  const category = { id: "c1", slug: "silks", parentId: null, name: "Silks", description: "", heroImage: "/c.webp", accent: "EMERALD", order: 1 };

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@server/catalog/storefront.service", () => ({
      storefrontService: { brandPage: vi.fn(async (handle: string) => (handle === "silks" ? dto : null)) },
    }));
    vi.doMock("@server/catalog/product.repository", () => ({
      productsRepository: { categoryIdsForOrg: vi.fn(async () => ["c1"]) },
    }));
    vi.doMock("@/data-access-layer/categories.dal", () => ({
      categoriesDAL: { getCategories: vi.fn(async () => [category, { ...category, id: "c2", slug: "other" }]) },
    }));
    vi.doMock("@/data-access-layer/products.dal", () => ({
      productsDAL: { getProducts: vi.fn(async () => [{ id: "p1" }, { id: "p2" }]) },
    }));
  });

  it("adds exactly the categories this shop sells in and its newest goods", async () => {
    const { storefrontDAL, NEWEST_GOODS_ON_BRAND_PAGE } = await import("@/data-access-layer/storefront.dal");
    const { productsDAL } = await import("@/data-access-layer/products.dal");
    const page = await storefrontDAL.getBrandPage("silks");

    expect(Object.keys(page!).sort()).toEqual([...BRAND_PAGE_FIELDS, "categories", "newest"].sort());
    expect(page!.categories.map((c) => c.id)).toEqual(["c1"]);
    expect(page!.newest).toHaveLength(2);
    // Scoped by the id the handle resolved to, never by anything a URL could carry.
    expect(productsDAL.getProducts).toHaveBeenCalledWith({ orgId: "org_1", limit: NEWEST_GOODS_ON_BRAND_PAGE });
  });

  it("answers null for a shop that is not there", async () => {
    const { storefrontDAL } = await import("@/data-access-layer/storefront.dal");
    await expect(storefrontDAL.getBrandPage("nobody")).resolves.toBeNull();
  });
});
