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
vi.mock("@server/shared/app-url", () => ({ appUrl: () => "https://shop.test" }));
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

  it("takes the full link an org pastes out of its address bar", async () => {
    await storefrontService.addBanner(
      "org-1",
      banner("https://shop.test/store/naaz-collection")
    );
    // Stored as a path: an absolute one carries the origin it was copied from, and
    // would point at the wrong machine everywhere else.
    expect(bannerCreate).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ href: "/store/naaz-collection" })
    );
  });

  it("keeps the query when reducing a full link", async () => {
    await storefrontService.addBanner(
      "org-1",
      banner("https://shop.test/store/naaz-collection?category=abayas")
    );
    expect(bannerCreate).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ href: "/store/naaz-collection?category=abayas" })
    );
  });

  it("takes a full link to its own product", async () => {
    getProductBySlug.mockResolvedValue({ orgId: "org-1" });
    await storefrontService.addBanner(
      "org-1",
      banner("https://shop.test/product/cream-rida")
    );
    expect(bannerCreate).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ href: "/product/cream-rida" })
    );
  });

  it("refuses a link to somebody else's site rather than keeping its path", async () => {
    // Reducing it silently would turn a mistake into a different destination that
    // happens to be valid here.
    await expect(
      storefrontService.addBanner(
        "org-1",
        banner("https://evil.test/store/naaz-collection")
      )
    ).rejects.toMatchObject({ field: "href" });
    expect(bannerCreate).not.toHaveBeenCalled();
  });

  it("refuses a full link to another shop on this site", async () => {
    await expect(
      storefrontService.addBanner("org-1", banner("https://shop.test/store/a-rival"))
    ).rejects.toMatchObject({ field: "href" });
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

describe("a rejected value says which box is wrong", () => {
  it("refuses a bare / before it reaches the server", async () => {
    const { orgBannerSchema } = await import(
      "@/lib/validation/schemas/org-banner.schema"
    );
    // The case that exposed this: `/` is a valid-looking path and points at the
    // marketplace, not the shop. The client form runs this same schema, so it is
    // caught on the field before a request is made at all. The message asks for a
    // link rather than naming ownership — whose shop it is, only the server knows.
    const result = orgBannerSchema.safeParse({ title: "Best", href: "/" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].path).toEqual(["href"]);
    expect(result.error.issues[0].message).toMatch(/paste the link/i);
  });

  it("puts the ownership refusal on the destination box too", async () => {
    // Shape and ownership are different checks and only the first is a regex, so the
    // second has to carry the field itself or the message lands nowhere.
    getProductBySlug.mockResolvedValue({ orgId: "someone-else" });
    await expect(
      storefrontService.addBanner("org-1", {
        title: "Eid",
        href: "/product/their-rida",
      })
    ).rejects.toMatchObject({ field: "href" });
  });

  it.each([
    ["checkout", /reserved/i],
    ["naaz-collection", /already/i],
  ])("puts a refused handle %s on the handle box", async (handle, message) => {
    await expect(
      storefrontService.changeHandle("org-1", handle)
    ).rejects.toMatchObject({ field: "handle", message: expect.stringMatching(message) });
  });

  it("puts an unavailable handle on the handle box", async () => {
    isHandleHeldByAnother.mockResolvedValue(true);
    await expect(
      storefrontService.changeHandle("org-1", "taken")
    ).rejects.toMatchObject({ field: "handle" });
  });
});
