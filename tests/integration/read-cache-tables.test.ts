/**
 * Every cached read names the tables it reads, because a write clears a cached read only through
 * those names (ADR-0065). A read that touches a table it did not name would be served stale after a
 * write to that table, so this runs each read alone, collects the tables its SQL touched, and fails on
 * any it left out. Reads are serialised so one read's statements are never counted as another's.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { onTableWrites, tablesRead } from "@server/shared/table-writes";
import { installReadCache, resetReadCache, type ReadCache } from "@server/shared/read-cache";

process.env.PRISMA_LOG_QUERIES = "1";

let statements: string[] = [];
let logSpy: MockInstance;
let created: { productId: string; familyId: string } | null = null;
const seen = new Map<string, { declared: Set<string>; read: Set<string> }>();

let queue = Promise.resolve();
const recording: ReadCache = (key, _args, { tables }, read) => {
  const run = queue.then(async () => {
    statements = [];
    const result = await read();
    const entry = seen.get(key) ?? { declared: new Set(tables), read: new Set<string>() };
    for (const sql of statements) for (const table of tablesRead(sql)) entry.read.add(table);
    seen.set(key, entry);
    return result;
  });
  queue = run.then(() => undefined, () => undefined);
  return run;
};

describe.skipIf(!isDisposableDb)("cached reads name every table they read (local db)", () => {
  beforeAll(async () => {
    logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      if (typeof args[0] === "string" && args[0].startsWith("prisma:query ")) statements.push(args[0]);
    });
    installReadCache(recording);
    await ensureFixtures();
  });

  afterAll(async () => {
    resetReadCache();
    if (created) {
      const { prisma } = await import("@server/shared/prisma");
      await prisma.productStock.deleteMany({ where: { productId: created.productId } });
      await prisma.product.delete({ where: { id: created.productId } });
      await prisma.productFamily.delete({ where: { id: created.familyId } });
    }
    logSpy?.mockRestore();
  });

  it("walks every cached read the storefront makes", async () => {
    const { productsDAL } = await import("@/data-access-layer/products.dal");
    const { loadDisplayPriceContext } = await import("@server/promotions/price-context");
    const { loadDisplayBiddingLockContext } = await import("@server/bidding/bidding-lock");
    const { categoryRepository } = await import("@server/catalog/category.read.repository");
    const { prisma } = await import("@server/shared/prisma");

    const fixtures = await ensureFixtures();
    const stamp = Date.now();
    const family = await prisma.productFamily.create({ data: { orgId: fixtures.orgId, name: `RCT family ${stamp}` }, select: { id: true } });
    const product = await prisma.product.create({
      data: {
        name: `RCT ${stamp}`, slug: `rct-${stamp}`, description: "fixture", price: 10_000, weight: 0.5,
        thumbnail: "https://example.invalid/x.webp", categoryId: fixtures.categoryId, orgId: fixtures.orgId, familyId: family.id,
        stockLocations: { create: { orgAddressId: fixtures.orgAddressId, quantity: 5 } },
      },
      select: { id: true, slug: true },
    });
    created = { productId: product.id, familyId: family.id };
    const any = product;

    await loadDisplayPriceContext();
    await loadDisplayBiddingLockContext();
    await categoryRepository.list();
    await productsDAL.getProductBySlug(any.slug);
    await productsDAL.getSimilarProducts(any.slug, 4);
    await productsDAL.getProducts({ limit: 12 });
    const { bannersDAL } = await import("@/data-access-layer/banners.dal");
    await bannersDAL.getActiveBanners();
    const { reviewService } = await import("@server/catalog/review.service");
    await reviewService.getPage(product.id, 1, null, { shared: true });

    expect([...seen.keys()].sort()).toEqual(
      expect.arrayContaining(["active-banners", "all-categories", "display-bidding-locks", "family-siblings", "review-page", "display-price-context", "product-by-slug", "product-rows", "rating-rows", "similar-products"]),
    );
  });

  it("a write through the real client reaches a listener with its table, raw and in a transaction too", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const heard: string[] = [];
    const stop = onTableWrites((tables) => heard.push(...tables));
    try {
      await prisma.product.update({ where: { id: created!.productId }, data: { description: "fixture, edited" } });
      await prisma.$executeRaw`UPDATE "ProductStock" SET "quantity" = "quantity" WHERE "productId" = ${created!.productId}`;
      await prisma.$transaction(async (tx) => {
        await tx.productFamily.update({ where: { id: created!.familyId }, data: { name: `RCT family edited ${Date.now()}` } });
      });
      await prisma.product.findUnique({ where: { id: created!.productId }, select: { id: true } });
    } finally {
      stop();
    }
    expect(new Set(heard)).toEqual(new Set(["Product", "ProductStock", "ProductFamily"]));
  });

  it("no cached read touches a table it did not declare", () => {
    const undeclared = [...seen].flatMap(([key, { declared, read }]) =>
      [...read].filter((table) => !declared.has(table)).map((table) => `${key} reads "${table}"`),
    );
    expect(undeclared).toEqual([]);
  });
});
