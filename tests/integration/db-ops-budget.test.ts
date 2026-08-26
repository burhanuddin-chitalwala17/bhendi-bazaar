/**
 * Billed-operations budgets: every SQL statement is one billed operation on
 * Prisma Postgres, so each repository call carries a query budget that a
 * regression (a new include, a lost select, a filter that re-queries) will bust.
 *
 * Counting works through the PRISMA_LOG_QUERIES instrument in
 * server/shared/prisma.ts — set before the client module loads, spied via
 * console.log. Request-level deduplication (React cache) is invisible here
 * because vitest has no request scope: these are per-call budgets, and a
 * rendered page pays less than their sum.
 *
 * Budgets are exact today. The PRODUCT_INCLUDE reads run relationLoadStrategy
 * "join" (one LATERAL JOIN), so a budget of 1 is the contract: a bust means the
 * join strategy silently stopped applying — a regeneration without the
 * relationJoins preview flag does exactly that. Only ever raise a budget with a
 * reason written next to it.
 *
 * Needs the seeded local database (see docs/OPERATIONS.md); skips anywhere else
 * so CI and metered environments never pay for or depend on it.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi, type MockInstance } from "vitest";

process.env.PRISMA_LOG_QUERIES = "1";

const dbUrl = process.env.DATABASE_URL ?? "";
const isLocalDb = (() => {
  try {
    const url = new URL(dbUrl);
    return (
      ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) &&
      url.pathname === "/bhendi_bazaar_dev"
    );
  } catch {
    return false;
  }
})();

// Statements counted since the last reset — one prisma:query line each.
let queryCount = 0;
let spy: MockInstance;

async function countQueries(run: () => Promise<unknown>): Promise<number> {
  queryCount = 0;
  await run();
  return queryCount;
}

describe.skipIf(!isLocalDb)("db ops budgets (local seeded db)", () => {
  let productsRepository: typeof import("@server/catalog/product.repository").productsRepository;
  let categoryRepository: typeof import("@server/catalog/category.repository").categoryRepository;
  let promotionRepository: typeof import("@server/promotions/promotion.repository").promotionRepository;
  let productSlug: string;

  beforeAll(async () => {
    spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      if (typeof args[0] === "string" && args[0].startsWith("prisma:query")) queryCount++;
    });
    ({ productsRepository } = await import("@server/catalog/product.repository"));
    ({ categoryRepository } = await import("@server/catalog/category.repository"));
    ({ promotionRepository } = await import("@server/promotions/promotion.repository"));
    // Any seeded product works; budgets don't depend on which.
    const heroes = await productsRepository.getHeroProducts(1);
    productSlug = heroes[0]?.slug ?? "rose-musk-blend";
  });

  afterAll(() => {
    spy?.mockRestore();
  });

  it("getProductBySlug stays within budget", async () => {
    const n = await countQueries(() => productsRepository.getProductBySlug(productSlug));
    expect(n).toBeLessThanOrEqual(1); // one LATERAL JOIN
  });

  it("getHeroProducts stays within budget", async () => {
    const n = await countQueries(() => productsRepository.getHeroProducts(6));
    expect(n).toBeLessThanOrEqual(1); // one LATERAL JOIN
  });

  it("getSimilarProducts stays within budget", async () => {
    const n = await countQueries(() => productsRepository.getSimilarProducts(productSlug, 4));
    expect(n).toBeLessThanOrEqual(1); // one LATERAL JOIN
  });

  it("searchProducts is one lean query — a suggestion row is not a product page", async () => {
    const n = await countQueries(() => productsRepository.searchProducts("a", 5));
    expect(n).toBeLessThanOrEqual(1);
  });

  it("every category read shape costs at most one query", async () => {
    expect(await countQueries(() => categoryRepository.list())).toBeLessThanOrEqual(1);
    expect(await countQueries(() => categoryRepository.listTree())).toBeLessThanOrEqual(1);
    expect(await countQueries(() => categoryRepository.findBySlug("abayas"))).toBeLessThanOrEqual(1);
    expect(await countQueries(() => categoryRepository.listForPicker())).toBeLessThanOrEqual(1);
  });

  it("the price context pair stays two queries", async () => {
    const now = new Date();
    const n = await countQueries(async () => {
      await promotionRepository.listLive(now);
      await promotionRepository.categoryParents();
    });
    expect(n).toBeLessThanOrEqual(2); // listLive joins its targets (1) + parents (1)
  });

  it("dashboard stats aggregate in the database, not JS", async () => {
    const { adminDashboardRepository } = await import("@server/analytics/dashboard.repository");
    // 4 revenue windows + 1 status groupBy + 1 product row-set + 3 user counts.
    const n = await countQueries(() => adminDashboardRepository.getDashboardStats());
    expect(n).toBeLessThanOrEqual(9);
  });

  it("getOfferProducts stays within budget", async () => {
    // 2 for the price context (no request dedupe in vitest) + 1 joined product
    // read. On a rendered page the context is request-shared, so the real
    // marginal cost is the product read alone.
    const n = await countQueries(() => productsRepository.getOfferProducts(4));
    expect(n).toBeLessThanOrEqual(3);
  });
});
