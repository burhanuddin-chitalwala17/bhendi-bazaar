/**
 * A buyer learns an organisation's public face and nothing else (seller-identity R5,
 * seller-profile R2/A3). The storefront reads `OrgProfile` and takes only identity from
 * `Org`; these tests hold the two selects to an allowlist, so adding a column to either
 * table cannot widen a public payload without failing here. Mutation-tested by adding
 * `email: true` to the identity select.
 *
 * The brand page's DTO (brand-page D1, A7) is held the same way, by a literal key list —
 * and its brands slice is checked against the whole serialised payload, so a manufacturer
 * mapped through by accident fails here rather than reaching a page. Since part (c) the
 * same payload carries derived proof and the quoted reviews, so it is also checked for a
 * reviewer's `userId`, which `ReviewDto` never carries and this page must not either.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PUBLIC_ORG_IDENTITY_SELECT,
  PUBLIC_PROFILE_SELECT,
} from "@server/catalog/org-profile.repository";
import {
  aboutOf,
  brandNamesCarried,
  toBrandPageDto,
  type BrandPageDerived,
} from "@server/catalog/storefront.types";
import { PROOF_FLOORS } from "@server/catalog/brand-page-proof";
import {
  HIDEABLE_BRAND_PAGE_SECTIONS,
  brandOwnerFrom,
  hiddenSectionsFrom,
} from "@server/catalog/brand-page-sections";
import type { ShopReviewDto } from "@server/catalog/review.types";

/** Everything a seller would happily print on a shop sign, and nothing they would not. */
const PUBLIC_PROFILE_FIELDS = [
  "tagline",
  "description",
  "logoUrl",
  "heroUrl",
  "accent",
  "story",
  "storyMergedAt",
  "returnsPreset",
  "promiseNote",
  "location",
  "social",
  "ownerName",
  "ownerRole",
  "ownerQuote",
  "ownerPhotoUrl",
  "hiddenSections",
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
  "returns",
  "brands",
  "social",
  "proof",
  "buyersSay",
  "owner",
  "hiddenSections",
].sort();

/** A quoted review's keys: `ReviewDto`'s buyer-facing fields and the product, never `userId`. */
const SHOP_REVIEW_FIELDS = [
  "id",
  "rating",
  "comment",
  "authorName",
  "isVerifiedPurchase",
  "createdAt",
  "product",
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
  story: "A longer story.",
  storyMergedAt: null as Date | null,
  returnsPreset: "EXCHANGE_7_DAY" as const,
  promiseNote: "Exchanges within a week.",
  location: "Bhendi Bazaar, Mumbai",
  social: { instagram: "silks" },
  ownerName: "Anisa Merchant",
  ownerRole: "Second generation",
  ownerQuote: "My father chose every bolt himself.",
  ownerPhotoUrl: "https://img.example/anisa.webp",
  hiddenSections: null,
  org: { id: "org_1", handle: "silks", name: "Silks & Co", joinedAt: new Date("2021-03-04") },
};

/** The portal's own brand DTOs, private fields and all — what a careless mapping would leak. */
const brands = [
  { id: "b1", name: "Silks & Co", manufacturer: "Secret Mills Ltd", packerOrImporter: "Packers Inc", countryOfOrigin: "IN", isDefault: true, retiredAt: null },
  { id: "b2", name: "Zari House", manufacturer: "Other Mills", packerOrImporter: null, countryOfOrigin: "CN", isDefault: false, retiredAt: null },
];

/** A shop under every floor: what part (a) built, and what a new shop still gets. */
const NOTHING_DERIVED: BrandPageDerived = { proof: null, buyersSay: null };

const quoted = (id: string): ShopReviewDto => ({
  id,
  rating: 5,
  comment: "Lovely weave.",
  authorName: "Ayesha K.",
  isVerifiedPurchase: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  product: { name: "Banarasi saree", slug: "banarasi-saree" },
});

const DERIVED: BrandPageDerived = {
  proof: { rating: { average: 4.6, count: 23 }, ordersFulfilled: 120 },
  buyersSay: [quoted("r1"), quoted("r2"), quoted("r3")],
};

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
      about: "Who we are.\n\nA longer story.",
      tagline: "Silks since 1985",
      logoUrl: "https://img.example/logo.webp",
      heroUrl: "https://img.example/hero.webp",
      accent: "primary",
    });
  });

  it("answers null for a shop that is not there", async () => {
    const { storefrontDAL } = await import("@/data-access-layer/storefront.dal");
    await expect(storefrontDAL.getByHandle("nobody")).resolves.toBeNull();
  });
});

describe("the brand page's DTO", () => {
  it("carries exactly the allowlisted keys", () => {
    const dto = toBrandPageDto(fixture, brands, NOTHING_DERIVED);
    expect(Object.keys(dto).sort()).toEqual(BRAND_PAGE_FIELDS);
    expect(Object.keys(toBrandPageDto(fixture, brands, DERIVED)).sort()).toEqual(BRAND_PAGE_FIELDS);
  });

  it("has no key from the private face, and no private value anywhere in the payload", () => {
    const dto = toBrandPageDto(fixture, brands, DERIVED);
    const serialised = JSON.stringify(dto);
    for (const field of [...PRIVATE_ORG_FIELDS, ...PRIVATE_BRAND_FIELDS]) {
      expect(field in dto, `${field} is private face`).toBe(false);
      expect(serialised, `${field} appears in the payload`).not.toContain(`"${field}"`);
    }
    expect(serialised).not.toContain("Secret Mills");
    expect(serialised).not.toContain("Packers Inc");
  });

  it("lists brands carried as names only, and only when there are two or more (D8)", () => {
    expect(toBrandPageDto(fixture, brands, NOTHING_DERIVED).brands).toEqual(["Silks & Co", "Zari House"]);
    expect(toBrandPageDto(fixture, brands.slice(0, 1), NOTHING_DERIVED).brands).toBeNull();
    expect(toBrandPageDto(fixture, [], NOTHING_DERIVED).brands).toBeNull();
    expect(brandNamesCarried([{ name: "Only" }])).toBeNull();
  });

  it("derives since-when from the day the shop joined, and nothing is typed", () => {
    expect(toBrandPageDto(fixture, brands, NOTHING_DERIVED).since).toBe(2021);
    expect(toBrandPageDto(fixture, brands, NOTHING_DERIVED).proof).toBeNull();
    expect(toBrandPageDto(fixture, brands, NOTHING_DERIVED).buyersSay).toBeNull();
  });

  it("carries the derived proof and the quoted reviews through as given, and never a userId (R4, A7)", () => {
    const dto = toBrandPageDto(fixture, brands, DERIVED);
    expect(dto.proof).toEqual(DERIVED.proof);
    expect(dto.buyersSay).toHaveLength(3);
    for (const review of dto.buyersSay!) {
      expect(Object.keys(review).sort()).toEqual(SHOP_REVIEW_FIELDS);
    }
    expect(JSON.stringify(dto)).not.toContain('"userId"');
  });

  it("treats blank text as absent, so a section fed whitespace has nothing to show", () => {
    const dto = toBrandPageDto(
      { ...fixture, description: "   ", story: "", tagline: " \n ", location: "  ", promiseNote: " " },
      brands,
      NOTHING_DERIVED,
    );
    expect(dto.about).toBeNull();
    expect(dto.story).toBeNull();
    expect(dto.tagline).toBeNull();
    expect(dto.location).toBeNull();
    expect(dto.returns?.note).toBeNull();
  });

  it("turns stored handles into composed links, and junk into nothing", () => {
    expect(toBrandPageDto(fixture, brands, NOTHING_DERIVED).social).toEqual([
      { network: "instagram", label: "Instagram", handle: "silks", href: "https://www.instagram.com/silks/" },
    ]);
    expect(toBrandPageDto({ ...fixture, social: null }, brands, NOTHING_DERIVED).social).toBeNull();
    expect(
      toBrandPageDto({ ...fixture, social: { instagram: "https://evil.example/x" } }, brands, NOTHING_DERIVED).social,
    ).toBeNull();
  });
});

/**
 * The proof is gathered through public surfaces and floored once (brand-page D2, D3): the
 * reviews service's org aggregate and newest reviews, and checkout's paid-order count, each
 * mocked here so the test is about the assembly and the floors, not the queries.
 */
describe("storefrontService.brandPage", () => {
  const list = vi.fn(async () => brands);
  const ratingForOrg = vi.fn();
  const recentForOrg = vi.fn();
  const paidOrderCountForOrg = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("@server/catalog/org-profile.repository", () => ({
      orgProfileRepository: {
        findPublicByHandle: vi.fn(async (handle: string) => (handle === "silks" ? fixture : null)),
      },
      PUBLIC_PROFILE_SELECT,
      PUBLIC_ORG_IDENTITY_SELECT,
    }));
    vi.doMock("@server/catalog/brand.service", () => ({ brandService: { list } }));
    vi.doMock("@server/catalog/review.service", () => ({
      reviewService: { ratingForOrg, recentForOrg },
    }));
    vi.doMock("@server/checkout/order.service", () => ({
      orderService: { paidOrderCountForOrg },
    }));
    ratingForOrg.mockResolvedValue({ average: 4.5555, count: 23 });
    recentForOrg.mockResolvedValue([quoted("r1"), quoted("r2"), quoted("r3")]);
    paidOrderCountForOrg.mockResolvedValue(120);
  });

  it("assembles the DTO from the public read, the brand names, and the proof other surfaces derive", async () => {
    const { storefrontService } = await import("@server/catalog/storefront.service");
    const dto = await storefrontService.brandPage("silks");
    expect(dto).toMatchObject({
      id: "org_1",
      handle: "silks",
      brands: ["Silks & Co", "Zari House"],
      proof: { rating: { average: 4.6, count: 23 }, ordersFulfilled: 120 },
    });
    expect(dto!.buyersSay!.map((review) => review.id)).toEqual(["r1", "r2", "r3"]);
    expect(Object.keys(dto!).sort()).toEqual(BRAND_PAGE_FIELDS);
    // Every derived read is scoped by the id the handle resolved to, never by the handle.
    expect(list).toHaveBeenCalledWith("org_1");
    expect(ratingForOrg).toHaveBeenCalledWith("org_1");
    expect(recentForOrg).toHaveBeenCalledWith("org_1", PROOF_FLOORS.minReviewsForRating);
    expect(paidOrderCountForOrg).toHaveBeenCalledWith("org_1");
  });

  it("leaves a statistic under its floor out, and the quoted reviews with the rating (D3)", async () => {
    ratingForOrg.mockResolvedValue({ average: 5, count: PROOF_FLOORS.minReviewsForRating - 1 });
    recentForOrg.mockResolvedValue([quoted("r1"), quoted("r2")]);
    paidOrderCountForOrg.mockResolvedValue(PROOF_FLOORS.minOrdersForCount);
    const { storefrontService } = await import("@server/catalog/storefront.service");
    const dto = await storefrontService.brandPage("silks");
    expect(dto!.proof).toEqual({ rating: null, ordersFulfilled: PROOF_FLOORS.minOrdersForCount });
    expect(dto!.buyersSay).toBeNull();
  });

  it("carries null proof and no quotes for a shop with nothing over any floor", async () => {
    ratingForOrg.mockResolvedValue({ average: null, count: 0 });
    recentForOrg.mockResolvedValue([]);
    paidOrderCountForOrg.mockResolvedValue(PROOF_FLOORS.minOrdersForCount - 1);
    const { storefrontService } = await import("@server/catalog/storefront.service");
    const dto = await storefrontService.brandPage("silks");
    expect(dto!.proof).toBeNull();
    expect(dto!.buyersSay).toBeNull();
  });

  it("answers null for a shop that is not there, without asking anyone anything", async () => {
    const { storefrontService } = await import("@server/catalog/storefront.service");
    await expect(storefrontService.brandPage("nobody")).resolves.toBeNull();
    expect(list).not.toHaveBeenCalled();
    expect(ratingForOrg).not.toHaveBeenCalled();
    expect(recentForOrg).not.toHaveBeenCalled();
    expect(paidOrderCountForOrg).not.toHaveBeenCalled();
  });
});

/**
 * The mapper is the guard (brand-page R1, A7): the repository row carries what the query
 * selected, and this is where a stranger's shape is decided. A row widened by accident —
 * here, one that arrived with `userId` and both state columns — must lose them on the way out.
 */
describe("reviewService.recentForOrg", () => {
  const listPublishedForOrg = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // The describe above mocked the service itself; this one wants the real mapper.
    vi.doUnmock("@server/catalog/review.service");
    vi.doMock("@server/catalog/review.repository", () => ({
      reviewRepository: { listPublishedForOrg },
      VISIBLE_REVIEW_WHERE: { withdrawnAt: null, deletedAt: null },
    }));
    listPublishedForOrg.mockResolvedValue([
      {
        id: "r9",
        userId: "user_secret",
        userName: "Bilal R.",
        rating: 4,
        title: "Prompt",
        comment: "Arrived in two days.",
        isVerified: false,
        withdrawnAt: null,
        deletedAt: null,
        createdAt: new Date("2026-09-12T08:30:00.000Z"),
        product: { id: "p2", name: "Zari dupatta", slug: "zari-dupatta", orgId: "org_1" },
      },
    ]);
  });

  it("shapes a row into ReviewDto's public fields plus the product, and nothing the row also had", async () => {
    const { reviewService } = await import("@server/catalog/review.service");
    const [review] = await reviewService.recentForOrg("org_1", 3);
    expect(Object.keys(review).sort()).toEqual(SHOP_REVIEW_FIELDS);
    expect(review).toEqual({
      id: "r9",
      rating: 4,
      comment: "Arrived in two days.",
      authorName: "Bilal R.",
      isVerifiedPurchase: false,
      createdAt: "2026-09-12T08:30:00.000Z",
      product: { name: "Zari dupatta", slug: "zari-dupatta" },
    });
    expect(JSON.stringify(review)).not.toContain("user_secret");
    expect(listPublishedForOrg).toHaveBeenCalledWith("org_1", 3);
  });
});

/** The page's composed shape (brand-page D5): the DTO plus the marketplace's own two tile slices. */
describe("storefrontDAL.getBrandPage", () => {
  const dto = toBrandPageDto(fixture, brands, DERIVED);
  const category = { id: "c1", slug: "silks", parentId: null, name: "Silks", description: "", heroImage: "/c.webp", accent: "EMERALD", order: 1 };

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@server/catalog/storefront.service", () => ({
      storefrontService: { brandPage: vi.fn(async (handle: string) => (handle === "silks" ? dto : null)) },
    }));
    vi.doMock("@server/catalog/product.read.repository", () => ({
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
    // The proof and the quotes arrive on the DTO; the DAL adds tiles and touches neither.
    expect(page!.proof).toEqual(DERIVED.proof);
    expect(page!.buyersSay).toEqual(DERIVED.buyersSay);
    // Scoped by the id the handle resolved to, never by anything a URL could carry.
    expect(productsDAL.getProducts).toHaveBeenCalledWith({ orgId: "org_1", limit: NEWEST_GOODS_ON_BRAND_PAGE });
  });

  it("answers null for a shop that is not there", async () => {
    const { storefrontDAL } = await import("@/data-access-layer/storefront.dal");
    await expect(storefrontDAL.getBrandPage("nobody")).resolves.toBeNull();
  });
});

describe("what a shop chose not to show", () => {
  const dto = (hidden: unknown) =>
    toBrandPageDto({ ...fixture, hiddenSections: hidden }, brands, NOTHING_DERIVED);

  it("leaves the hidden section's content out of the payload, not merely unrendered", () => {
    // Subtraction at the source (R7): a flag the page is trusted to honour is honoured by
    // whichever renderer remembers to check it, and a link preview is a renderer too.
    const page = dto(["story", "policies", "brands", "social"]);
    expect(page.story).toBeNull();
    expect(page.owner).toBeNull();
    expect(page.about).toBeNull();
    expect(page.returns).toBeNull();
    expect(page.brands).toBeNull();
    expect(page.social).toBeNull();
    expect(JSON.stringify(page)).not.toContain("Anisa Merchant");
  });

  it("hides the introduction with the story, because they are one section", () => {
    expect(dto(["story"]).about).toBeNull();
  });

  it("reports the keys so the shop's own panel can say hidden rather than missing", () => {
    expect(dto(["brands"]).hiddenSections).toEqual(["brands"]);
    expect(dto(null).hiddenSections).toEqual([]);
  });

  it("cannot hide what buyers said, the goods, or the proof", () => {
    // Proof is derived and never typed (R4). A page whose reviews vanish when they turn
    // unflattering is not proof, so those keys are not offered to the shop at all.
    const offered: readonly string[] = HIDEABLE_BRAND_PAGE_SECTIONS;
    for (const key of ["hero", "categories", "buyersSay", "newest"]) {
      expect(offered, `${key} must not be hideable`).not.toContain(key);
    }
  });

  it("drops a key no section answers to, rather than carrying it", () => {
    expect(hiddenSectionsFrom(["story", "nonsense", 7, null])).toEqual(["story"]);
    expect(hiddenSectionsFrom("story")).toEqual([]);
    expect(hiddenSectionsFrom(["story", "story"])).toEqual(["story"]);
  });
});

describe("the shapes the platform defined, read back from JSON", () => {
  it("hangs the person on a name, and keeps the rest optional", () => {
    const row = { ownerName: "A", ownerRole: null, ownerQuote: null, ownerPhotoUrl: null };
    expect(brandOwnerFrom(row)).toEqual({ name: "A", role: null, quote: null, photoUrl: null });
    expect(brandOwnerFrom({ ...row, ownerName: "   " })).toBeNull();
    // A quoted line with nobody behind it is copy, not a person.
    expect(brandOwnerFrom({ ...row, ownerName: null, ownerQuote: "Trust us." })).toBeNull();
  });
});

describe("About your shop, without loss (org-profile D4, Q18)", () => {
  const row = (description: string | null, story: string | null, storyMergedAt: Date | null = null) => ({
    description,
    story,
    storyMergedAt,
  });

  it("joins an introduction and a longer story, introduction first, a blank line between (spec A5)", () => {
    expect(aboutOf(row("Who we are.", "How it began."))).toBe("Who we are.\n\nHow it began.");
  });

  it("returns either half alone when the other is blank (spec A5)", () => {
    expect(aboutOf(row("Who we are.", null))).toBe("Who we are.");
    expect(aboutOf(row("Who we are.", "   "))).toBe("Who we are.");
    expect(aboutOf(row(null, "How it began."))).toBe("How it began.");
    expect(aboutOf(row(" ", "How it began."))).toBe("How it began.");
  });

  it("is null when both are blank (spec A5)", () => {
    expect(aboutOf(row(null, null))).toBeNull();
    expect(aboutOf(row(" ", ""))).toBeNull();
  });

  it("is the saved text alone once the shop has saved the box; the old story never comes back (spec A5)", () => {
    const saved = new Date("2026-10-31T10:00:00Z");
    expect(aboutOf(row("Who we are, rewritten.", "How it began.", saved))).toBe("Who we are, rewritten.");
    expect(aboutOf(row(null, "How it began.", saved))).toBeNull();
  });

  it("is what the buyer page carries, and the old story never travels on its own (spec A5)", () => {
    const dto = toBrandPageDto(fixture, brands, NOTHING_DERIVED);
    expect(dto.about).toBe("Who we are.\n\nA longer story.");
    expect(dto.story).toBeNull();
  });
});

describe("delivery and returns on the buyer page (org-profile D6, Q19)", () => {
  it("carries the preset and the note, never the old free text (spec R7)", () => {
    const dto = toBrandPageDto(
      { ...fixture, deliveryPolicy: "Old delivery words", returnsPolicy: "Old returns words" } as typeof fixture,
      brands,
      NOTHING_DERIVED,
    );
    expect(dto.returns).toEqual({ preset: "EXCHANGE_7_DAY", note: "Exchanges within a week." });
    expect(JSON.stringify(dto)).not.toContain("Old delivery words");
    expect(JSON.stringify(dto)).not.toContain("Old returns words");
  });

  it("the public select no longer reads the old free text at all", () => {
    expect("deliveryPolicy" in PUBLIC_PROFILE_SELECT).toBe(false);
    expect("returnsPolicy" in PUBLIC_PROFILE_SELECT).toBe(false);
  });
});
