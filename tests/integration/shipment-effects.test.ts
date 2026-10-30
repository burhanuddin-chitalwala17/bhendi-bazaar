/**
 * What a status change actually does to stock and to the ledger
 * ([shipment-lifecycle](../../docs/specs/shipment-lifecycle/trd.md) D6, D7).
 *
 * The effects table is declared and unit-tested, but declaring `restocks: true` does nothing on
 * its own. These assert the two consequences that move real quantities: a returned parcel puts
 * its units back exactly once, and a returned sale stops being claimable for payout.
 *
 * Owns its fixtures rather than reading the seed, so it needs a migrated schema and nothing in
 * it — the pattern `order-transaction.test.ts` uses, and what would let this run in CI.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";


const PREFIX = "ship-effects-";

describe.skipIf(!isDisposableDb)("a status change moves stock and money", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let moveParcel: typeof import("@server/checkout/fulfilment.service").moveParcel;
  let SHIPMENT_STATUS: typeof import("@server/shipping/domain/shipping.types").SHIPMENT_STATUS;
  let PARCEL_ACTOR: typeof import("@server/shipping/domain/shipping.types").PARCEL_ACTOR;
  const madeOrderIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ moveParcel } = await import("@server/checkout/fulfilment.service"));
    ({ SHIPMENT_STATUS, PARCEL_ACTOR } = await import("@server/shipping/domain/shipping.types"));
  });

  afterAll(async () => {
    if (madeOrderIds.length) {
      // Ledger first: a reversal holds its parcel (Restrict, offers-hardening D1).
      await prisma.orgLedgerEntryLine.deleteMany({ where: { entry: { orderId: { in: madeOrderIds } } } });
      await prisma.orgLedgerEntry.deleteMany({ where: { orderId: { in: madeOrderIds } } });
      await prisma.parcelEvent.deleteMany({ where: { shipment: { orderId: { in: madeOrderIds } } } });
      await prisma.shipmentItem.deleteMany({ where: { shipment: { orderId: { in: madeOrderIds } } } });
      await prisma.shipment.deleteMany({ where: { orderId: { in: madeOrderIds } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: madeOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: madeOrderIds } } });
    }
    await prisma.productStock.deleteMany({ where: { product: { name: { startsWith: PREFIX } } } });
    await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  /** One order, one parcel, one line of three units taken out of a stock of ten. */
  async function aDispatchedParcel(startingStock = 10, quantity = 3) {
    const { orgId, orgAddressId, categoryId } = await ensureFixtures();
    const unique = `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const product = await prisma.product.create({
      data: {
        name: unique, slug: unique, description: "fixture", price: 10_000,
        thumbnail: "https://example.invalid/x.webp", weight: 0.5,
        categoryId, orgId,
        // Already reserved: the parcel took `quantity` out of `startingStock`.
        stockLocations: { create: { orgAddressId, quantity: startingStock - quantity } },
      },
      select: { id: true },
    });

    const order = await prisma.order.create({
      data: { code: `BB-${unique.slice(-8).toUpperCase()}`, address: {}, grandTotal: 30_000 },
      select: { id: true },
    });
    madeOrderIds.push(order.id);

    const item = await prisma.orderItem.create({
      data: { orderId: order.id, productId: product.id, quantity, unitPrice: 10_000 },
      select: { id: true },
    });

    const shipment = await prisma.shipment.create({
      data: {
        code: `${unique}-SH1`, orderId: order.id, orgId,
        orgAddressId, fromPincode: "400001", fromCity: "Mumbai",
        fromState: "Maharashtra", shippingCost: 5_000,
        status: SHIPMENT_STATUS.IN_TRANSIT,
        items: { create: { orderItemId: item.id, quantity } },
      },
      select: { id: true },
    });

    return { shipmentId: shipment.id, productId: product.id, locationId: orgAddressId, orderId: order.id, quantity };
  }

  const stockOf = async (productId: string, orgAddressId: string) =>
    (await prisma.productStock.findUniqueOrThrow({
      where: { productId_orgAddressId: { productId, orgAddressId } },
      select: { quantity: true },
    })).quantity;

  it("a parcel returned to the shop puts its units back", async () => {
    const p = await aDispatchedParcel();
    expect(await stockOf(p.productId, p.locationId)).toBe(7);

    await moveParcel(p.shipmentId, SHIPMENT_STATUS.RTO_IN_TRANSIT, { actor: PARCEL_ACTOR.SYSTEM });
    // Still on its way back — nothing is in the shop yet, so nothing is sellable yet.
    expect(await stockOf(p.productId, p.locationId)).toBe(7);

    await moveParcel(p.shipmentId, SHIPMENT_STATUS.RTO_DELIVERED, { actor: PARCEL_ACTOR.SYSTEM });
    expect(await stockOf(p.productId, p.locationId)).toBe(10);
  });

  it("does not put them back twice, even if the transition guard is bypassed", async () => {
    const p = await aDispatchedParcel();
    await moveParcel(p.shipmentId, SHIPMENT_STATUS.RTO_IN_TRANSIT, { actor: PARCEL_ACTOR.SYSTEM });
    await moveParcel(p.shipmentId, SHIPMENT_STATUS.RTO_DELIVERED, { actor: PARCEL_ACTOR.SYSTEM });
    expect(await stockOf(p.productId, p.locationId)).toBe(10);

    // Repeating the call proves little on its own: `from === to` is answered as a no-op before
    // restocking is reached, so the transition table is what refuses it, not `restockedAt`.
    await moveParcel(p.shipmentId, SHIPMENT_STATUS.RTO_DELIVERED, { actor: PARCEL_ACTOR.SYSTEM });
    expect(await stockOf(p.productId, p.locationId)).toBe(10);

    // So reach the restock path a second time for real, by putting the parcel back on its
    // return leg. `restockedAt` is the only thing standing between this and ten more units —
    // and it is the mechanism D7 names, so it is the one worth asserting.
    await prisma.shipment.update({
      where: { id: p.shipmentId },
      data: { status: SHIPMENT_STATUS.RTO_IN_TRANSIT },
    });
    await moveParcel(p.shipmentId, SHIPMENT_STATUS.RTO_DELIVERED, { actor: PARCEL_ACTOR.SYSTEM });
    expect(await stockOf(p.productId, p.locationId)).toBe(10);
  });

  it("a delivered parcel does not put anything back", async () => {
    const p = await aDispatchedParcel();
    await moveParcel(p.shipmentId, SHIPMENT_STATUS.OUT_FOR_DELIVERY, { actor: PARCEL_ACTOR.SYSTEM });
    await moveParcel(p.shipmentId, SHIPMENT_STATUS.DELIVERED, { actor: PARCEL_ACTOR.SYSTEM });
    expect(await stockOf(p.productId, p.locationId)).toBe(7);
  });

  it("a lost parcel does not put anything back — the units are gone", async () => {
    // The owner's decision of 2026-09-24. Crediting these would invent inventory the shop
    // does not have; they are written off against the courier claim instead.
    const p = await aDispatchedParcel();
    await moveParcel(p.shipmentId, SHIPMENT_STATUS.LOST, { actor: PARCEL_ACTOR.SYSTEM });
    expect(await stockOf(p.productId, p.locationId)).toBe(7);
    // But the shipment is still marked handled, so nothing sweeps it up later.
    const row = await prisma.shipment.findUniqueOrThrow({
      where: { id: p.shipmentId },
      select: { status: true, restockedAt: true },
    });
    expect(row.status).toBe(SHIPMENT_STATUS.LOST);
    expect(row.restockedAt).toBeNull();
  });

  it("drops the amount the platform sees as owed to the org", async () => {
    // The figure that matters to the operator: settlement is bookkeeping — the platform logs
    // what it owes, pays outside the system, then marks it settled. A returned item has to
    // reduce that number, or someone pays for goods that came back.
    const p = await aDispatchedParcel();
    const { ledgerService } = await import("@server/payouts/ledger.service");
    const { ledgerRepository } = await import("@server/payouts/ledger.repository");

    const org = await prisma.shipment.findUniqueOrThrow({
      where: { id: p.shipmentId },
      select: { orgId: true },
    });

    const before = await ledgerRepository.balancesFor(org.orgId);
    await ledgerService.recordSale(p.orderId);
    const afterSale = await ledgerRepository.balancesFor(org.orgId);
    const earned = afterSale.owedPaise - before.owedPaise;
    expect(earned, "the sale should have increased what is owed").toBeGreaterThan(0);

    await moveParcel(p.shipmentId, SHIPMENT_STATUS.RTO_IN_TRANSIT, { actor: PARCEL_ACTOR.SYSTEM });
    await moveParcel(p.shipmentId, SHIPMENT_STATUS.RTO_DELIVERED, { actor: PARCEL_ACTOR.SYSTEM });

    const afterReturn = await ledgerRepository.balancesFor(org.orgId);
    // Back to exactly where it started: the reversal nets the sale off, and `balancesFor` sums
    // every live entry without filtering by kind, so the negative one counts.
    expect(afterReturn.owedPaise).toBe(before.owedPaise);
    expect(afterReturn.unclaimedPaise).toBe(before.unclaimedPaise);
  });

  it("reverses what the org was owed, by mirroring the sale rather than editing it", async () => {
    const p = await aDispatchedParcel();
    const { ledgerService } = await import("@server/payouts/ledger.service");
    await ledgerService.recordSale(p.orderId);

    const sale = await prisma.orgLedgerEntry.findFirst({
      where: { orderId: p.orderId, kind: "SALE" },
      select: { payablePaise: true },
    });
    expect(sale, "the fixture should have produced a sale entry").not.toBeNull();

    await moveParcel(p.shipmentId, SHIPMENT_STATUS.RTO_IN_TRANSIT, { actor: PARCEL_ACTOR.SYSTEM });
    await moveParcel(p.shipmentId, SHIPMENT_STATUS.RTO_DELIVERED, { actor: PARCEL_ACTOR.SYSTEM });

    const entries = await prisma.orgLedgerEntry.findMany({
      where: { orderId: p.orderId },
      select: { kind: true, payablePaise: true },
    });
    // The sale survives — ADR-0020: a money-bearing row is cancelled, never edited away.
    expect(entries.map((e) => e.kind).sort()).toEqual(["REVERSAL", "SALE"]);
    expect(entries.reduce((sum, e) => sum + e.payablePaise, 0)).toBe(0);
  });
});
