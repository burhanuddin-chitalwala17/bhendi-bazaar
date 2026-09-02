import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { crawlersBlocked } from "@/lib/crawl-block";

// The sitemap's DALs reach Prisma; the blocked path must return before either runs.
vi.mock("@/data-access-layer/categories.dal", () => ({
  categoriesDAL: { getCategories: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/data-access-layer/products.dal", () => ({
  productsDAL: { listSlugs: vi.fn().mockResolvedValue([]) },
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("pre-launch crawl block", () => {
  it("is off unless BLOCK_CRAWLERS is exactly '1'", () => {
    vi.stubEnv("BLOCK_CRAWLERS", "");
    expect(crawlersBlocked()).toBe(false);
    vi.stubEnv("BLOCK_CRAWLERS", "true");
    expect(crawlersBlocked()).toBe(false);
    vi.stubEnv("BLOCK_CRAWLERS", "1");
    expect(crawlersBlocked()).toBe(true);
  });

  it("robots.txt disallows everything and advertises no sitemap when blocked", () => {
    vi.stubEnv("BLOCK_CRAWLERS", "1");
    const result = robots();
    expect(result.rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(result.sitemap).toBeUndefined();
  });

  it("robots.txt keeps the live rules and sitemap when not blocked", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test");
    const result = robots();
    expect(result.rules).toMatchObject({ userAgent: "*", allow: "/" });
    expect(result.sitemap).toBe("https://example.test/sitemap.xml");
  });

  it("sitemap is empty when blocked, without touching the catalogue", async () => {
    vi.stubEnv("BLOCK_CRAWLERS", "1");
    const { categoriesDAL } = await import("@/data-access-layer/categories.dal");
    await expect(sitemap()).resolves.toEqual([]);
    expect(categoriesDAL.getCategories).not.toHaveBeenCalled();
  });

  it("sitemap lists the catalogue when not blocked", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test");
    const result = await sitemap();
    expect(result.map((entry) => entry.url)).toContain("https://example.test");
  });
});
