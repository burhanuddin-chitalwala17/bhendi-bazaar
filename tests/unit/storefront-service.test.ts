/**
 * The rules an org's own editor rests on (storefront-branding, org-handle R4–R4f).
 *
 * Two things are worth pinning here because neither is visible in a type: a handle
 * change refuses the cases that are facts rather than races, and a banner may point
 * only inside the shop that owns it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findStorefrontSettings = vi.fn();
const isHandleHeldByAnother = vi.fn();
const changeHandle = vi.fn();
const getProductBySlug = vi.fn();
const bannerCreate = vi.fn();

vi.mock("@server/catalog/org.repository", () => ({
  orgRepository: {
    findStorefrontSettings: (...a: unknown[]) => findStorefrontSettings(...a),
    isHandleHeldByAnother: (...a: unknown[]) => isHandleHeldByAnother(...a),
    changeHandle: (...a: unknown[]) => changeHandle(...a),
  },
}));
vi.mock("@server/catalog/product.repository", () => ({
  productsRepository: { getProductBySlug: (...a: unknown[]) => getProductBySlug(...a) },
}));
vi.mock("@server/catalog/org-banner.repository", () => ({
  orgBannerRepository: {
    create: (...a: unknown[]) => bannerCreate(...a),
    listForOrg: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
  },
}));

const { storefrontService } = await import("@server/catalog/storefront.service");

const SHOP = { handle: "naaz-collection", name: "Naaz Collection" };

beforeEach(() => {
  vi.clearAllMocks();
  findStorefrontSettings.mockResolvedValue(SHOP);
  isHandleHeldByAnother.mockResolvedValue(false);
  changeHandle.mockResolvedValue({ id: "org-1", handle: "naaz-couture" });
  getProductBySlug.mockResolvedValue(null);
});

describe("changing a handle", () => {
  it("moves the shop to a free address", async () => {
    await storefrontService.changeHandle("org-1", "naaz-couture");
    // The handle being left is passed through, because the repository needs it to
    // write the history row that keeps old links working.
    expect(changeHandle).toHaveBeenCalledWith("org-1", "naaz-collection", "naaz-couture");
  });

  it("lowercases and trims what was typed", async () => {
    await storefrontService.changeHandle("org-1", "  Naaz-Couture  ");
    expect(changeHandle).toHaveBeenCalledWith(
      "org-1",
      "naaz-collection",
      "naaz-couture"
    );
  });

  it.each([["naaz couture"], ["naaz_couture"], ["Naaz/Couture"], ["-naaz"]])(
    "refuses %s, which could not survive a route param",
    async (bad) => {
      await expect(storefrontService.changeHandle("org-1", bad)).rejects.toThrow();
      expect(changeHandle).not.toHaveBeenCalled();
    }
  );

  it("refuses a word the platform serves", async () => {
    await expect(storefrontService.changeHandle("org-1", "checkout")).rejects.toThrow(
      /reserved/i
    );
  });

  it("refuses the handle it already has, rather than writing a pointless history row", async () => {
    await expect(
      storefrontService.changeHandle("org-1", "naaz-collection")
    ).rejects.toThrow(/already/i);
    expect(changeHandle).not.toHaveBeenCalled();
  });

  it("refuses one another shop is still holding", async () => {
    isHandleHeldByAnother.mockResolvedValue(true);
    await expect(storefrontService.changeHandle("org-1", "free-looking")).rejects.toThrow(
      /not available/i
    );
    expect(changeHandle).not.toHaveBeenCalled();
  });

  it("leaves genuine contention to the constraint and reports it plainly", async () => {
    // Two shops claiming the same free handle at the same instant: the pre-check
    // cannot see it, so the unique violation is what decides.
    const violation = Object.assign(new Error("unique"), {
      code: "P2002",
      meta: { target: ["handle"] },
    });
    changeHandle.mockRejectedValue(violation);
    await expect(storefrontService.changeHandle("org-1", "taken-now")).rejects.toThrow(
      /not available/i
    );
  });
});

describe("a banner points inside its own shop", () => {
  const banner = (href: string | null) => ({ title: "Eid drop", href });

  it("accepts the shop's own storefront", async () => {
    await storefrontService.addBanner("org-1", banner("/store/naaz-collection"));
    expect(bannerCreate).toHaveBeenCalled();
  });

  it("accepts a filtered view of it", async () => {
    await storefrontService.addBanner(
      "org-1",
      banner("/store/naaz-collection?category=abayas")
    );
    expect(bannerCreate).toHaveBeenCalled();
  });

  it("accepts its own product", async () => {
    getProductBySlug.mockResolvedValue({ orgId: "org-1" });
    await storefrontService.addBanner("org-1", banner("/product/cream-rida"));
    expect(bannerCreate).toHaveBeenCalled();
  });

  it("refuses another shop's product", async () => {
    getProductBySlug.mockResolvedValue({ orgId: "someone-else" });
    await expect(
      storefrontService.addBanner("org-1", banner("/product/their-rida"))
    ).rejects.toThrow(/your own shop/i);
    expect(bannerCreate).not.toHaveBeenCalled();
  });

  it("refuses another shop's storefront", async () => {
    await expect(
      storefrontService.addBanner("org-1", banner("/store/a-rival"))
    ).rejects.toThrow(/your own shop/i);
  });

  it("refuses a handle that merely starts the same way", async () => {
    // `/store/naaz-collection-two` must not pass a naive prefix test.
    await expect(
      storefrontService.addBanner("org-1", banner("/store/naaz-collection-two"))
    ).rejects.toThrow(/your own shop/i);
  });

  it("allows no link at all", async () => {
    await storefrontService.addBanner("org-1", banner(null));
    expect(bannerCreate).toHaveBeenCalled();
  });
});

describe("the payload the editor actually sends", () => {
  it("parses what the add form posts", async () => {
    const { orgBannerSchema } = await import(
      "@/lib/validation/schemas/org-banner.schema"
    );
    // Exactly the body `StorefrontBannersManager.add` builds — a contract test, so a
    // field renamed on one side fails here rather than silently at runtime.
    const parsed = orgBannerSchema.parse({
      title: "Eid drop",
      href: null,
      imageUrl: null,
      isActive: true,
    });
    expect(parsed.title).toBe("Eid drop");
    expect(parsed.isActive).toBe(true);
  });

  it("parses what the toggle posts, extra server fields and all", async () => {
    const { orgBannerSchema } = await import(
      "@/lib/validation/schemas/org-banner.schema"
    );
    // The toggle spreads the whole row back, including columns the schema does not
    // declare. Those must be stripped rather than rejected, or taking a promotion
    // down would fail validation.
    const parsed = orgBannerSchema.parse({
      id: "b1",
      orgId: "org-1",
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: "Eid drop",
      description: null,
      imageUrl: null,
      imageAlt: null,
      href: null,
      isActive: false,
    });
    expect(parsed.isActive).toBe(false);
    expect(parsed).not.toHaveProperty("orgId");
  });
});
