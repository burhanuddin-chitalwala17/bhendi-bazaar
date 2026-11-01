/**
 * The compare-and-set that replaced a blind write on 2026-10-04: the product editor's stock save
 * (`stockRepository.adjust`). It used to overwrite whatever had happened since the screen loaded;
 * it now refuses, and the refusal must leave the row exactly as it found it. (The operator's order
 * move it once sat beside was deleted by order-fulfilment unit 3, Q36.)
 *
 * Owns its fixtures, like `order-transaction.test.ts`, so it needs a migrated schema and nothing in it.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const PREFIX = "stock-cmd-";

describe.skipIf(!isDisposableDb)("a stale editor is refused, not applied", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let stockRepository: typeof import("@server/catalog/stock.repository").stockRepository;
  let ConflictError: typeof import("@server/shared/domain-error").ConflictError;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ stockRepository } = await import("@server/catalog/stock.repository"));
    ({ ConflictError } = await import("@server/shared/domain-error"));
  });

  afterAll(async () => {
    // Stock rows cascade with their product.
    await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  it("adjust: a seenQuantity the row no longer holds throws ConflictError and changes nothing", async () => {
    const { orgId, orgAddressId, categoryId } = await ensureFixtures();
    const name = unique();
    const product = await prisma.product.create({
      data: {
        name, slug: name, description: "fixture", price: 10_000,
        thumbnail: "https://example.invalid/x.webp", weight: 0.5, categoryId, orgId,
        stockLocations: { create: { orgAddressId, quantity: 10 } },
      },
      select: { id: true },
    });
    const where = { productId_orgAddressId: { productId: product.id, orgAddressId } };

    // The editor loaded 10; three units sell while the form is open.
    await prisma.productStock.update({ where, data: { quantity: 7 } });

    await expect(
      stockRepository.adjust(product.id, [{ orgAddressId, quantity: 12, seenQuantity: 10 }]),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await prisma.productStock.findUniqueOrThrow({ where })).quantity).toBe(7);

    // Reloaded, the same edit goes through.
    await stockRepository.adjust(product.id, [{ orgAddressId, quantity: 12, seenQuantity: 7 }]);
    expect((await prisma.productStock.findUniqueOrThrow({ where })).quantity).toBe(12);
  });
});
