/**
 * The admin dashboard's figures and both "Needs attention" queues against a real schema
 * (design-system Q30, Q31). Sales run in 2011, where nothing else lives, so their sums are exact;
 * the admin queue is platform-wide, so it is asserted as the change this suite's own rows make.
 * Owns its world: fresh orgs, removed afterwards.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import { REFUND_STATE } from "@server/payments/refund.types";
import { SALES_PERIOD } from "@server/analytics/sales.types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe.skipIf(!isDisposableDb)("admin dashboard metrics (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let sales: typeof import("@server/analytics/sales.service");
  let attention: typeof import("@server/analytics/attention.service");
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let seq = 0;
  const orgIds: string[] = [];
  const orderIds: string[] = [];
  const productIds: string[] = [];
  const awbs: string[] = [];
  let shopId: string;
  let shopAddressId: string;

  const newOrg = async (label: string) => {
    const org = await prisma.org.create({
      data: { code: `AD-${label}-${stamp}`.slice(0, 30), handle: `ad-${label}-${stamp}`.toLowerCase(), name: `Dash ${label}`, email: `ad-${label}-${stamp}@example.invalid` },
      select: { id: true },
    });
    orgIds.push(org.id);
    return org.id;
  };

  const order = async (o: { grandTotal?: number; paymentStatus?: string; status?: string; paidAt?: Date | null; createdAt?: Date }) => {
    const row = await prisma.order.create({
      data: {
        code: `AD-${stamp}-${seq++}`,
        address: {},
        grandTotal: o.grandTotal ?? 1000,
        paymentStatus: o.paymentStatus ?? PAYMENT_STATUS.PAID,
        status: o.status ?? ORDER_STATUS.CONFIRMED,
        paidAt: o.paidAt ?? null,
        ...(o.createdAt ? { createdAt: o.createdAt } : {}),
      },
      select: { id: true },
    });
    orderIds.push(row.id);
    return row.id;
  };

  const parcel = (orderId: string, orgId: string, status: string) =>
    prisma.shipment.create({
      data: { code: `AD-${stamp}-${seq++}`, orderId, orgId, status, fromPincode: "400001", fromCity: "Mumbai", fromState: "Maharashtra", shippingCost: 0 },
      select: { id: true },
    });

  const product = async (o: { threshold: number; stock: number; archived?: boolean }) => {
    const row = await prisma.product.create({
      data: {
        name: `Dash product ${seq}`,
        slug: `dash-product-${stamp}-${seq++}`,
        description: "fixture",
        price: 10_000,
        thumbnail: "https://example.invalid/p.webp",
        categoryId: fixtures.categoryId,
        orgId: shopId,
        lowStockThreshold: o.threshold,
        archivedAt: o.archived ? new Date() : null,
        stockLocations: { create: { orgAddressId: shopAddressId, quantity: o.stock } },
      },
      select: { id: true },
    });
    productIds.push(row.id);
    return row.id;
  };

  const sell = async (productId: string, quantity: number, paidAt: Date, paymentStatus: string = PAYMENT_STATUS.PAID) => {
    const orderId = await order({ paymentStatus, paidAt: paymentStatus === PAYMENT_STATUS.PAID ? paidAt : null, createdAt: paidAt });
    await prisma.orderItem.create({ data: { orderId, productId, quantity, unitPrice: 10_000 } });
  };

  const ledger = (orgId: string, e: { gross?: number; orgFunded?: number; platformFunded?: number; commission?: number; payable: number; createdAt: Date; kind?: "SALE" | "CANCELLATION_FEE"; deleted?: boolean }) =>
    prisma.orgLedgerEntry.create({
      data: {
        orgId,
        kind: e.kind ?? "SALE",
        grossItemsPaise: e.gross ?? 0,
        orgFundedDiscountPaise: e.orgFunded ?? 0,
        platformFundedDiscountPaise: e.platformFunded ?? 0,
        commissionBasePaise: (e.gross ?? 0) - (e.orgFunded ?? 0),
        commissionPaise: e.commission ?? 0,
        payablePaise: e.payable,
        createdAt: e.createdAt,
        deletedAt: e.deleted ? new Date() : null,
      },
    });

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    sales = await import("@server/analytics/sales.service");
    attention = await import("@server/analytics/attention.service");
    fixtures = await ensureFixtures();
    shopId = await newOrg("shop");
    const location = await prisma.orgAddress.create({
      data: {
        org: { connect: { id: shopId } },
        address: { create: { addressLine1: "1 Dash Road", city: "Mumbai", state: "Maharashtra", pincode: "400001" } },
        name: "Dash shop",
        contactName: "Dash",
        contactPhone: "9999999999",
        isActive: true,
      },
      select: { id: true },
    });
    shopAddressId = location.id;
  });

  afterAll(async () => {
    await prisma.refund.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orgLedgerEntry.deleteMany({ where: { orgId: { in: orgIds } } });
    await prisma.shipment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.courierConflict.deleteMany({ where: { awb: { in: awbs } } });
    const links = await prisma.orgAddress.findMany({ where: { orgId: { in: orgIds } }, select: { addressId: true } });
    await prisma.orgAddress.deleteMany({ where: { orgId: { in: orgIds } } });
    await prisma.address.deleteMany({ where: { id: { in: links.map((l) => l.addressId) } } });
    await prisma.org.deleteMany({ where: { id: { in: orgIds } } });
  });

  describe("sales across a month boundary, by India day", () => {
    // 10:00 in India on 2 March 2011: the 7-day period is 24 Feb–2 Mar, the one before 17–23 Feb, cut at 10:00.
    const now = new Date("2011-03-02T04:30:00Z");

    beforeAll(async () => {
      const other = await newOrg("other");
      const first = await order({ grandTotal: 100_001, paidAt: new Date("2011-02-23T18:40:00Z") }); // 24 Feb 00:10 India
      await parcel(first, shopId, SHIPMENT_STATUS.DELIVERED);
      const before = await order({ grandTotal: 50_003, paidAt: new Date("2011-02-23T03:00:00Z") }); // 23 Feb 08:30 India
      await parcel(before, shopId, SHIPMENT_STATUS.DELIVERED);
      await order({ grandTotal: 70_000, paidAt: new Date("2011-02-23T18:20:00Z") }); // 23 Feb 23:50: after the cut, before the period
      const last = await order({ grandTotal: 20_000, paidAt: new Date("2011-03-01T19:00:00Z") }); // 2 Mar 00:30 India
      await parcel(last, other, SHIPMENT_STATUS.PACKING);
      const legacy = await order({ grandTotal: 7, paidAt: null, createdAt: new Date("2011-02-28T06:00:00Z") }); // no paidAt: dated by creation
      await parcel(legacy, other, SHIPMENT_STATUS.CANCELLED);
      const inWindow = new Date("2011-02-27T06:00:00Z");
      await order({ grandTotal: 999_999, paymentStatus: PAYMENT_STATUS.PENDING, status: ORDER_STATUS.PENDING_PAYMENT, createdAt: inWindow });
      await order({ grandTotal: 999_999, paymentStatus: PAYMENT_STATUS.PENDING, status: ORDER_STATUS.EXPIRED, createdAt: inWindow });
      await order({ grandTotal: 999_999, paymentStatus: PAYMENT_STATUS.FAILED, status: ORDER_STATUS.FAILED, createdAt: inWindow });
      await order({ grandTotal: 999_999, status: ORDER_STATUS.CANCELLED, paidAt: inWindow });

      await ledger(shopId, { gross: 100_000, orgFunded: 10_000, platformFunded: 5_000, commission: 13_500, payable: 76_500, createdAt: new Date("2011-02-25T06:00:00Z") });
      await ledger(shopId, { kind: "CANCELLATION_FEE", payable: -5_000, createdAt: new Date("2011-02-26T06:00:00Z") });
      await ledger(shopId, { gross: 900_000, payable: 0, createdAt: new Date("2011-02-26T06:00:00Z"), deleted: true });
      await ledger(shopId, { gross: 10_000, commission: 1_000, payable: 9_000, createdAt: new Date("2011-02-20T06:00:00Z") });
    });

    it("sums paid totals exactly, per India day, and leaves out unpaid, expired, failed and cancelled orders", async () => {
      const o = await sales.salesOverview(SALES_PERIOD.WEEK, now);
      expect(o.series.map((d) => d.day)).toEqual(["2011-02-24", "2011-02-25", "2011-02-26", "2011-02-27", "2011-02-28", "2011-03-01", "2011-03-02"]);
      expect(o.series.map((d) => d.paise)).toEqual([100_001, 0, 0, 0, 7, 0, 20_000]);
      expect(o.total).toEqual({ current: 120_008, previous: 50_003, changeBps: 14_000 });
      expect(o.orders).toEqual({ current: 3, previous: 1, changeBps: 20_000 });
      expect(o.averageOrder.current).toBe(40_003);
    });

    it("compares with the same number of days before, cut at the same hour", async () => {
      const o = await sales.salesOverview(SALES_PERIOD.WEEK, now);
      expect(o.window).toEqual({
        from: "2011-02-23T18:30:00.000Z",
        to: "2011-03-02T04:30:00.000Z",
        previousFrom: "2011-02-16T18:30:00.000Z",
        previousTo: "2011-02-23T04:30:00.000Z",
      });
      expect(o.previousSeries.map((d) => d.day)[6]).toBe("2011-02-23");
      expect(o.previousSeries[6].paise).toBe(50_003);
    });

    it("takes what the platform kept from the ledger, and counts shops with a live parcel", async () => {
      const o = await sales.salesOverview(SALES_PERIOD.WEEK, now);
      // 100,000 − 10,000 − 5,000 − 76,500 on the sale, plus the 5,000 fee; the removed entry counts for nothing.
      expect(o.platformKept).toMatchObject({ current: 13_500, previous: 1_000 });
      // The legacy order's only parcel was cancelled, so its shop sold nothing in the window.
      expect(o.shopsSelling).toMatchObject({ current: 2, previous: 1 });
    });

    it("buckets today alone against yesterday up to the same hour", async () => {
      const o = await sales.salesOverview(SALES_PERIOD.TODAY, now);
      expect(o.series).toEqual([{ day: "2011-03-02", paise: 20_000, orders: 1 }]);
      expect(o.previousSeries).toEqual([{ day: "2011-03-01", paise: 0, orders: 0 }]);
    });
  });

  describe("the seller's lines", () => {
    it("counts low stock only on products that sold in the last 30 days, with days left at that rate", async () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 10 * DAY);
      expect(await attention.sellingLowStock(shopId, now)).toEqual({ count: 0, soldOut: 0, soonestDays: null });

      await sell(await product({ threshold: 5, stock: 2 }), 6, recent); // 2 left at 6 a month: 10 days
      await sell(await product({ threshold: 5, stock: 0 }), 1, recent); // sold out
      await sell(await product({ threshold: 5, stock: 1 }), 3, new Date(now.getTime() - 40 * DAY)); // no sale in 30 days
      await sell(await product({ threshold: 5, stock: 1 }), 3, recent, PAYMENT_STATUS.PENDING); // never paid
      await sell(await product({ threshold: 5, stock: 50 }), 3, recent); // not low
      await sell(await product({ threshold: 5, stock: 0, archived: true }), 3, recent); // off sale

      expect(await attention.sellingLowStock(shopId, now)).toEqual({ count: 2, soldOut: 1, soonestDays: 10 });
    });

    it("counts only paid parcels the shop still has to pack, and the oldest payment", async () => {
      const packer = await newOrg("packer");
      const now = Date.now();
      expect(await attention.toPack(packer)).toEqual({ count: 0, oldestPaidAt: null });
      const oldest = new Date(now - 3 * HOUR);
      await parcel(await order({ paidAt: oldest }), packer, SHIPMENT_STATUS.PACKING);
      await parcel(await order({ paidAt: new Date(now - HOUR) }), packer, SHIPMENT_STATUS.PACKING);
      await parcel(await order({ paymentStatus: PAYMENT_STATUS.PENDING, status: ORDER_STATUS.PENDING_PAYMENT }), packer, SHIPMENT_STATUS.PACKING);
      await parcel(await order({ paidAt: new Date(now - 5 * HOUR) }), packer, SHIPMENT_STATUS.READY_FOR_PICKUP);
      expect(await attention.toPack(packer)).toEqual({ count: 2, oldestPaidAt: oldest.toISOString() });
    });
  });

  describe("the admin's queue (as the change our rows make)", () => {
    it("counts each item only past its threshold", async () => {
      const now = new Date();
      const before = await attention.adminAttentionCounts(now);

      // Refunds: owed counts; started does not; a request still in flight does not.
      const refundOrder = await order({ paidAt: now });
      const owed = await parcel(refundOrder, shopId, SHIPMENT_STATUS.CANCELLED);
      await prisma.refund.create({ data: { orderId: refundOrder, shipmentId: owed.id, amountPaise: 12_345, cause: SHIPMENT_STATUS.CANCELLED } });
      const started = await parcel(refundOrder, shopId, SHIPMENT_STATUS.CANCELLED);
      await prisma.refund.create({ data: { orderId: refundOrder, shipmentId: started.id, amountPaise: 1, cause: SHIPMENT_STATUS.CANCELLED, state: REFUND_STATE.STARTED } });
      const inFlight = await parcel(refundOrder, shopId, SHIPMENT_STATUS.CANCELLED);
      await prisma.refund.create({ data: { orderId: refundOrder, shipmentId: inFlight.id, amountPaise: 1, cause: SHIPMENT_STATUS.CANCELLED, state: REFUND_STATE.REQUESTED, requestedAt: now } });

      // Parcels to book: ready for 25 h counts, ready for 1 h does not.
      for (const hours of [25, 1]) {
        const ready = await parcel(await order({ paidAt: now }), shopId, SHIPMENT_STATUS.READY_FOR_PICKUP);
        await prisma.parcelEvent.create({
          data: { shipmentId: ready.id, toStatus: SHIPMENT_STATUS.READY_FOR_PICKUP, actor: "shop", createdAt: new Date(now.getTime() - hours * HOUR) },
        });
      }

      // Payouts: a week-old positive balance counts; a day-old one, or one fees have taken below zero, does not.
      await ledger(await newOrg("owed"), { payable: 10_000, createdAt: new Date(now.getTime() - 8 * DAY) });
      await ledger(await newOrg("fresh"), { payable: 10_000, createdAt: new Date(now.getTime() - DAY) });
      await ledger(await newOrg("indebt"), { kind: "CANCELLATION_FEE", payable: -5_000, createdAt: new Date(now.getTime() - 8 * DAY) });

      // Courier conflicts: one AWB's retries are one; a dismissed one is none.
      const open = `AD${stamp}A`;
      const dismissed = `AD${stamp}B`;
      awbs.push(open, dismissed);
      const conflict = (awb: string, dismissedAt: Date | null) =>
        prisma.courierConflict.create({ data: { kind: "unknown_awb", provider: "test", awb, courierWording: "x", payload: {}, dismissedAt } });
      await conflict(open, null);
      await conflict(open, null);
      await conflict(dismissed, now);

      const after = await attention.adminAttentionCounts(now);
      expect(after.refunds.count - before.refunds.count).toBe(1);
      expect(after.refunds.buyers - before.refunds.buyers).toBe(1);
      expect(after.refunds.amountPaise - before.refunds.amountPaise).toBe(12_345);
      expect(after.parcelsToBook.count - before.parcelsToBook.count).toBe(1);
      expect(after.payouts.shops - before.payouts.shops).toBe(1);
      expect(after.payouts.amountPaise - before.payouts.amountPaise).toBe(10_000);
      expect(after.courierConflicts.count - before.courierConflicts.count).toBe(1);
    });
  });
});
