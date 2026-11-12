/**
 * The landing/shop split and its redirects (storefront-themes D6; Q3, Q19, Q35; R13). A themed
 * shop's `/about` moves permanently to its landing page so printed links still arrive; `/shop`
 * of an unthemed shop goes back, temporarily, to today's page; a link into today's filtered grid
 * follows the goods to `/shop`; and the sitemap offers a themed shop's `/shop`, not its `/about`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const dal = vi.hoisted(() => ({
  getByHandle: vi.fn(),
  currentHandleFor: vi.fn(),
  getStorefrontPage: vi.fn(),
  getBrandPage: vi.fn(),
  categoriesFor: vi.fn(),
  productCountFor: vi.fn(),
  promotionsFor: vi.fn(),
  listShops: vi.fn(),
}));
const products = vi.hoisted(() => ({ getPage: vi.fn(), getProducts: vi.fn(), listSlugs: vi.fn() }));

vi.mock("@/data-access-layer/storefront.dal", () => ({ storefrontDAL: dal }));
// An open storefront: the lock itself is held by feature-public-reads and storefront-closed-pages (feature-access D11).
vi.mock("@/data-access-layer/storefront-access.dal", () => ({ storefrontClosedTo: async () => false, lockedStorefrontMetadata: async () => null, storefrontAccessDAL: { isOpen: async () => true, forViewer: async () => "open" } }));
vi.mock("@/data-access-layer/products.dal", () => ({ productsDAL: products }));
vi.mock("@/data-access-layer/categories.dal", () => ({ categoriesDAL: { getCategories: async () => [] } }));
vi.mock("@server/content/renditions.service", () => ({ renditionUrlForRef: async () => null }));
vi.mock("@server/shared/app-url", () => ({ appUrl: () => "https://shop.test" }));

import AboutPage from "@/app/(store)/store/[handle]/about/page";
import ShopPage from "@/app/(store)/store/[handle]/shop/page";
import LandingPage from "@/app/(store)/store/[handle]/page";
import sitemap from "@/app/sitemap";

const shop = (themed: boolean, handle = "zaveri") => ({
  id: `org-${handle}`,
  handle,
  name: "Zaveri & Sons",
  about: null,
  tagline: null,
  logoUrl: null,
  heroUrl: null,
  accent: null,
  themeKey: themed ? "darbar" : null,
  paletteKey: themed ? "emerald" : null,
});

/** Where a page left for, and with which status, or null if it rendered. */
async function leaves(render: Promise<unknown>): Promise<{ to: string; status: number } | null> {
  try {
    await render;
    return null;
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    if (!digest.startsWith("NEXT_REDIRECT")) throw error;
    const parts = digest.split(";");
    return { to: parts.slice(2, -2).join(";"), status: Number(parts.at(-2)) };
  }
}

const params = (handle = "zaveri") => Promise.resolve({ handle });

beforeEach(() => {
  vi.clearAllMocks();
  dal.currentHandleFor.mockResolvedValue(null);
  dal.categoriesFor.mockResolvedValue([]);
  dal.productCountFor.mockResolvedValue(3);
  dal.promotionsFor.mockResolvedValue([]);
  products.getPage.mockResolvedValue({ products: [], done: true });
  products.getProducts.mockResolvedValue([]);
});

describe("/store/{handle}/about (Q3)", () => {
  it("moves permanently to the landing page once the shop is themed", async () => {
    dal.getByHandle.mockResolvedValue(shop(true));
    await expect(leaves(AboutPage({ params: params() }))).resolves.toEqual({ to: "/store/zaveri", status: 308 });
  });

  it("stays today's brand page for an unthemed shop (Q19)", async () => {
    dal.getByHandle.mockResolvedValue(shop(false));
    dal.getBrandPage.mockResolvedValue(null);
    // No brand page and no retired handle: the page's own not-found, not a redirect to the landing page.
    await expect(leaves(AboutPage({ params: params() }))).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
  });
});

describe("/store/{handle}/shop (Q35)", () => {
  it("goes back, temporarily, to today's page for an unthemed shop", async () => {
    dal.getByHandle.mockResolvedValue(shop(false));
    await expect(
      leaves(ShopPage({ params: params(), searchParams: Promise.resolve({}) })),
    ).resolves.toEqual({ to: "/store/zaveri", status: 307 });
  });

  it("lists a themed shop's goods, the Deals filter being `offerOnly`, scoped by the resolved id", async () => {
    dal.getByHandle.mockResolvedValue(shop(true));
    // The goods render under a Suspense boundary (the theme's card skeleton): render that child too.
    const page = (await ShopPage({ params: params(), searchParams: Promise.resolve({ deals: "1", q: " zari " }) })) as {
      props: { children: { type: (props: unknown) => Promise<unknown>; props: unknown } };
    };
    const goods = page.props.children;
    await expect(leaves(goods.type(goods.props))).resolves.toBeNull();
    expect(products.getPage).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-zaveri", offerOnly: true, search: "zari" }),
      expect.anything(),
    );
  });

  it("follows a retired handle to the moved shop page", async () => {
    dal.getByHandle.mockResolvedValue(null);
    dal.currentHandleFor.mockResolvedValue("zaveri-sons");
    const left = await leaves(ShopPage({ params: params(), searchParams: Promise.resolve({}) }));
    expect(left?.to).toBe("/store/zaveri-sons/shop");
  });
});

describe("/store/{handle} (Q3, R13)", () => {
  it("sends a link into today's filtered grid to the themed shop page", async () => {
    dal.getByHandle.mockResolvedValue(shop(true));
    const left = await leaves(
      LandingPage({ params: params(), searchParams: Promise.resolve({ category: "sarees", offers: "1" }) }),
    );
    expect(left).toEqual({ to: "/store/zaveri/shop?category=sarees&deals=1", status: 307 });
  });
});

describe("sitemap (D6)", () => {
  it("offers a themed shop's /shop and an unthemed shop's /about", async () => {
    products.listSlugs.mockResolvedValue([]);
    dal.listShops.mockResolvedValue([
      { handle: "zaveri", name: "Zaveri", tagline: null, logoUrl: null, themed: true },
      { handle: "noor", name: "Noor", tagline: null, logoUrl: null, themed: false },
    ]);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain("https://shop.test/store/zaveri/shop");
    expect(urls).not.toContain("https://shop.test/store/zaveri/about");
    expect(urls).toContain("https://shop.test/store/noor/about");
    expect(urls).not.toContain("https://shop.test/store/noor/shop");
  });
});
