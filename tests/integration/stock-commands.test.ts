/**
 * The two compare-and-set commands that replaced a blind write on 2026-10-04: the product
 * editor's stock save (`stockRepository.adjust`) and an operator's fulfilment move
 * (`orderRepository.transition`). Each used to overwrite whatever had happened since the screen
 * loaded; each now refuses, and the refusal must leave the row exactly as it found it.
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
  let orderRepository: typeof import("@server/checkout/order.repository").orderRepository;
  let ORDER_STATUS: typeof import("@server/checkout/order.types").ORDER_STATUS;
  let ConflictError: typeof import("@server/shared/domain-error").ConflictError;
  const madeOrderIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ stockRepository } = await import("@server/catalog/stock.repository"));
    ({ orderRepository } = await import("@server/checkout/order.repository"));
    ({ ORDER_STATUS } = await import("@server/checkout/order.types"));
    ({ ConflictError } = await import("@server/shared/domain-error"));
  });

  afterAll(async () => {
    if (madeOrderIds.length) await prisma.order.deleteMany({ where: { id: { in: madeOrderIds } } });
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

  it("transition: a move the table does not allow is refused by name and the order stays put", async () => {
    const order = await prisma.order.create({
      data: { code: `BB-${unique().slice(-8).toUpperCase()}`, address: {}, status: ORDER_STATUS.DELIVERED },
      select: { id: true },
    });
    madeOrderIds.push(order.id);

    await expect(orderRepository.transition(order.id, ORDER_STATUS.PROCESSING)).rejects.toThrow(
      new RegExp(`${ORDER_STATUS.DELIVERED} to ${ORDER_STATUS.PROCESSING}`),
    );
    await expect(orderRepository.transition(order.id, ORDER_STATUS.PROCESSING)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      ORDER_STATUS.DELIVERED,
    );
  });

  it("transition: the move the table allows is applied", async () => {
    const order = await prisma.order.create({
      data: { code: `BB-${unique().slice(-8).toUpperCase()}`, address: {}, status: ORDER_STATUS.CONFIRMED },
      select: { id: true },
    });
    madeOrderIds.push(order.id);

    await orderRepository.transition(order.id, ORDER_STATUS.PROCESSING);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      ORDER_STATUS.PROCESSING,
    );
  });
});
