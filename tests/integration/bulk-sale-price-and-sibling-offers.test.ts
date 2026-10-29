/**
 * A sale price typed on a bulk sheet is saved as the product form saves it (own-store Q24), and a
 * variant tile shows the shop's own offer that checkout will apply (own-store Q25, ADR-0018).
 * Owns its fixtures.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import type { BulkProductCreateRow } from "@server/catalog/bulk/bulk.types";

const PREFIX = "q24q25-";
const BLOB = "https://test.public.blob.vercel-storage.com/products/x/y/z.jpg";

describe.skipIf(!isDisposableDb)("offers reach the bulk sheet and the variant tiles", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let bulk: typeof import("@server/catalog/bulk/bulk-product.service");
  let priceContext: typeof import("@server/promotions/price-context");
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    bulk = await import("@server/catalog/bulk/bulk-product.service");
    priceContext = await import("@server/promotions/price-context");
    fixtures = await ensureFixtures();
    await prisma.org.update({ where: { id: fixtures.orgId }, data: { maxDiscountBps: 5000 } });
  });

  afterAll(async () => {
    const ours = { product: { name: { startsWith: PREFIX } } };
    await prisma.promotionTarget.deleteMany({ where: { OR: [ours, { promotionId: { startsWith: PREFIX } }] } });
    await prisma.promotion.deleteMany({
      where: { OR: [{ id: { startsWith: PREFIX } }, { label: { startsWith: `Markdown — ${PREFIX}` } }] },
    });
    await prisma.productStock.deleteMany({ where: ours });
    await prisma.productMedia.deleteMany({ where: ours });
    await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.productFamily.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const row = (name: string, extra: Partial<BulkProductCreateRow>): BulkProductCreateRow => ({
    name, description: "d", price: 1_000, categorySlug: fixtures.categorySlug, weight: 1,
    factLabels: {}, measurements: {}, tags: [], images: ["a.jpg"], imageUrls: { "a.jpg": BLOB }, stock: {},
    ...extra,
  });
  const shownPrice = async (name: string) => {
    const product = await prisma.product.findFirstOrThrow({
      where: { name }, select: { id: true, price: true, orgId: true, categoryId: true },
    });
    return priceContext.resolveProductPrice(product, await priceContext.loadPriceContext()).offerPricePaise;
  };

  it("a sheet row's sale price is the price the product shows", async () => {
    const name = unique();
    await bulk.createProducts(fixtures.orgId, [{ rowNumber: 2, row: row(name, { salePrice: 800 }) }]);
    expect(await shownPrice(name)).toBe(80_000);
  });

  it("an over-cap sale price is refused and writes nothing", async () => {
    const name = unique();
    await expect(
      bulk.createProducts(fixtures.orgId, [{ rowNumber: 2, row: row(name, { salePrice: 1 }) }]),
    ).rejects.toMatchObject({ field: "salePrice" });
    expect(await prisma.product.count({ where: { name } })).toBe(0);
  });

  it("an updating row with a blank sale price keeps the product's sale", async () => {
    const name = unique();
    const sku = name.toUpperCase();
    await bulk.createProducts(fixtures.orgId, [{ rowNumber: 2, row: row(name, { sku, salePrice: 700 }) }]);
    const result = await bulk.createProducts(fixtures.orgId, [{ rowNumber: 2, row: row(name, { sku }) }]);
    expect(result.updated).toBe(1);
    expect(await shownPrice(name)).toBe(70_000);
  });

  it("an updating row with a 0 sale price ends the product's sale", async () => {
    const name = unique();
    const sku = name.toUpperCase();
    await bulk.createProducts(fixtures.orgId, [{ rowNumber: 2, row: row(name, { sku, salePrice: 700 }) }]);
    await bulk.createProducts(fixtures.orgId, [{ rowNumber: 2, row: row(name, { sku, salePrice: 0 }) }]);
    expect(await shownPrice(name)).toBe(100_000);
    const product = await prisma.product.findFirstOrThrow({ where: { name }, select: { id: true } });
    const markdown = await prisma.promotion.findUniqueOrThrow({
      where: { id: `mkdn_${product.id}` }, select: { isActive: true, fixedPricePaise: true },
    });
    // Deactivated, never rewritten to 0 — the table's CHECK forbids a 0 fixed price.
    expect(markdown).toEqual({ isActive: false, fixedPricePaise: 70_000 });
  });

  it("a sale price that fails to save after the products did says so, and that re-uploading fixes it", async () => {
    const { promotionService } = await import("@server/promotions/promotion.service");
    const spy = vi.spyOn(promotionService, "setProductMarkdown").mockRejectedValueOnce(new Error("db down"));
    const name = unique();
    try {
      await expect(
        bulk.createProducts(fixtures.orgId, [{ rowNumber: 2, row: row(name, { salePrice: 800 }) }]),
      ).rejects.toMatchObject({
        message: "Your products were saved, but their sale prices were not. Upload the sheet again to set them — rows with a SKU update their product; rows without one would be created a second time, so add their sale prices on the product page instead.",
      });
    } finally {
      spy.mockRestore();
    }
    expect(await prisma.product.count({ where: { name } })).toBe(1);
  });

  it("re-uploading an existing over-cap sale price unchanged is not refused, as on the form", async () => {
    const { promotionService } = await import("@server/promotions/promotion.service");
    const name = unique();
    const sku = name.toUpperCase();
    await bulk.createProducts(fixtures.orgId, [{ rowNumber: 2, row: row(name, { sku }) }]);
    const product = await prisma.product.findFirstOrThrow({ where: { name }, select: { id: true } });
    // Saved before the ceiling held: ₹100 on ₹1,000 is 90% off a 50%-capped shop.
    await promotionService.setProductMarkdown({ productId: product.id, productName: name, orgId: fixtures.orgId, fixedPricePaise: 10_000 });

    const again = [{ rowNumber: 2, row: row(name, { sku, salePrice: 100 }) }];
    expect(await bulk.validateProductRows(fixtures.orgId, again, ["a.jpg"])).toEqual([]);
    await expect(bulk.createProducts(fixtures.orgId, again)).resolves.toMatchObject({ updated: 1 });
    // A changed one is still judged.
    const deeper = [{ rowNumber: 2, row: row(name, { sku, salePrice: 50 }) }];
    expect(await bulk.validateProductRows(fixtures.orgId, deeper, ["a.jpg"])).toContainEqual(
      expect.objectContaining({ field: "salePrice" }),
    );
  });

  it("a shop's 20% offer on a variant shows on that variant's tile", async () => {
    const { productsDAL } = await import("@/data-access-layer/products.dal");
    const family = await prisma.productFamily.create({ data: { orgId: fixtures.orgId, name: unique() } });
    const make = async () => {
      const name = unique();
      return await prisma.product.create({
        data: {
          name, slug: name, description: "d", price: 100_000, thumbnail: BLOB, weight: 1,
          categoryId: fixtures.categoryId, orgId: fixtures.orgId, familyId: family.id,
          stockLocations: { create: { orgAddressId: fixtures.orgAddressId, quantity: 5 } },
        },
        select: { id: true, slug: true },
      });
    };
    const [current, sibling] = [await make(), await make()];
    await prisma.promotion.create({
      data: {
        id: unique(), label: `${PREFIX}20%`, scope: "ORG", orgId: fixtures.orgId, trigger: "AUTOMATIC",
        valueType: "PERCENT", percentBps: 2000,
        startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000),
        targets: { create: [{ productId: sibling.id }] },
      },
    });

    const page = await productsDAL.getProductBySlug(current.slug);
    const tile = page.siblings?.find((s) => s.slug === sibling.slug);
    expect(tile?.salePrice).toBe(80_000);
  });
});
