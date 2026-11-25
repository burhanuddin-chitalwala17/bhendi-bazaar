/**
 * Cancelling a paid parcel gives everything back exactly once (order-fulfilment (`431ed6e7:docs/specs/own-store/order-fulfilment/trd.md`)
 * U5: D12–D16; spec A6, A7, A8, A12; the cancel/pickup race, double cancel, the coupon after both
 * parcels, the settlement floor). Owns its fixtures: a migrated schema and nothing in it.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { JOBS_QUEUE, JOBS_SCHEMA } from "@server/shared/jobs/jobs.config";

vi.mock("next-auth", () => ({ getServerSession: async () => null }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));

const PREFIX = "parcel-cancel-";

describe.skipIf(!isDisposableDb)("cancelling a paid parcel gives everything back once", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let cancelParcel: typeof import("@server/checkout/fulfilment-cancel").cancelParcel;
  let moveParcel: typeof import("@server/checkout/fulfilment.service").moveParcel;
  let UNPAID: string;
  let ledgerService: typeof import("@server/payouts/ledger.service").ledgerService;
  let settlementService: typeof import("@server/payouts/settlement.service").settlementService;
  let SETTLEMENT_REFUSALS: typeof import("@server/payouts/settlement.service").SETTLEMENT_REFUSALS;
  let fulfilmentSettingsService: typeof import("@server/payouts/fulfilment-settings.service").fulfilmentSettingsService;
  let REFUSAL: typeof import("@server/checkout/parcel-cancel.types").CANCEL_REFUSAL;
  let S: typeof import("@server/shipping/domain/shipping.types").SHIPMENT_STATUS;
  let A: typeof import("@server/shipping/domain/shipping.types").PARCEL_ACTOR;
  let K: typeof import("@server/notifications/notice.types").NOTICE_KIND;
  let ORDER_STATUS: typeof import("@server/checkout/order.types").ORDER_STATUS;
  let PAYMENT_STATUS: typeof import("@server/checkout/order.types").PAYMENT_STATUS;
  let fx: Awaited<ReturnType<typeof ensureFixtures>>;
  let feeBefore = 5_000;
  const orderIds: string[] = [];
  const orgIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ cancelParcel } = await import("@server/checkout/fulfilment-cancel"));
    ({ moveParcel, UNPAID_CANCEL_MESSAGE: UNPAID } = await import("@server/checkout/fulfilment.service"));
    ({ ledgerService } = await import("@server/payouts/ledger.service"));
    ({ settlementService, SETTLEMENT_REFUSALS } = await import("@server/payouts/settlement.service"));
    ({ fulfilmentSettingsService } = await import("@server/payouts/fulfilment-settings.service"));
    ({ CANCEL_REFUSAL: REFUSAL } = await import("@server/checkout/parcel-cancel.types"));
    ({ SHIPMENT_STATUS: S, PARCEL_ACTOR: A } = await import("@server/shipping/domain/shipping.types"));
    ({ NOTICE_KIND: K } = await import("@server/notifications/notice.types"));
    ({ ORDER_STATUS, PAYMENT_STATUS } = await import("@server/checkout/order.types"));
    fx = await ensureFixtures();
    feeBefore = (await prisma.fulfilmentSettings.findUniqueOrThrow({ where: { id: "default" } })).cancellationFeePaise;
  });

  afterAll(async () => {
    await prisma.fulfilmentSettings.update({ where: { id: "default" }, data: { cancellationFeePaise: feeBefore } });
    if (orderIds.length) {
      const inOrders = { orderId: { in: orderIds } };
      const notices = await prisma.delivery.findMany({ where: { event: { shipment: inOrders } }, select: { id: true } });
      if (notices.length) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'deliveryId' = ANY($2)`,
          JOBS_QUEUE,
          notices.map((n) => n.id),
        );
      }
      await prisma.refund.deleteMany({ where: inOrders });
      await prisma.promotionBudgetRelease.deleteMany({ where: inOrders });
      await prisma.notificationEvent.deleteMany({ where: { shipment: inOrders } });
      await prisma.orgLedgerEntryLine.deleteMany({ where: { entry: inOrders } });
      await prisma.orgLedgerEntry.deleteMany({ where: inOrders });
      await prisma.parcelEvent.deleteMany({ where: { shipment: inOrders } });
      await prisma.shipmentItem.deleteMany({ where: { shipment: inOrders } });
      await prisma.shipment.deleteMany({ where: inOrders });
      await prisma.orderDiscount.deleteMany({ where: inOrders });
      await prisma.orderItem.deleteMany({ where: inOrders });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (orgIds.length) {
      await prisma.orgLedgerEntry.updateMany({ where: { orgId: { in: orgIds } }, data: { settlementId: null } });
      await prisma.settlement.deleteMany({ where: { orgId: { in: orgIds } } });
      await prisma.orgLedgerEntry.deleteMany({ where: { orgId: { in: orgIds } } });
      await prisma.org.deleteMany({ where: { id: { in: orgIds } } });
    }
    await prisma.adminLog.deleteMany({ where: { resource: "FulfilmentSettings", adminId: fx.userId } });
    await prisma.promotion.deleteMany({ where: { label: { startsWith: PREFIX } } });
    await prisma.productStock.deleteMany({ where: { product: { name: { startsWith: PREFIX } } } });
    await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  async function aProduct(orgId: string, price: number) {
    const name = unique();
    return prisma.product.create({
      data: {
        name, slug: name, description: "fixture", price, thumbnail: "https://example.invalid/x.webp", weight: 0.5,
        categoryId: fx.categoryId, orgId,
        ...(orgId === fx.orgId ? { stockLocations: { create: { orgAddressId: fx.orgAddressId, quantity: 0 } } } : {}),
      },
      select: { id: true },
    });
  }

  async function aCoupon(spentPaise: number) {
    const label = unique();
    return prisma.promotion.create({
      data: {
        label, scope: "PLATFORM", trigger: "CODE", code: label.toUpperCase(), valueType: "AMOUNT_OFF", amountOffPaise: 10_000,
        startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000),
        platformBudgetPaise: 1_000_000, platformSpentPaise: spentPaise, usageCount: 1,
      },
      select: { id: true, code: true },
    });
  }

  /**
   * A paid order, one parcel per shop given, each a ₹1,290 item with ₹50 shipping and ₹100 off a
   * platform coupon: ₹1,240 a parcel (spec A6). The coupon's budget charge is recorded per shop.
   */
  async function aPaidOrder(shops: string[], opts: { paid?: boolean; userId?: string | null } = {}) {
    const paid = opts.paid ?? true;
    const coupon = await aCoupon(10_000 * shops.length);
    const code = unique();
    const order = await prisma.order.create({
      data: {
        code: `BB-${code.slice(-8).toUpperCase()}`,
        userId: opts.userId === undefined ? fx.userId : opts.userId,
        address: { fullName: "Asha Buyer", email: "asha@example.invalid", city: "Pune", pincode: "411001" },
        itemsTotal: 129_000 * shops.length, shippingTotal: 5_000 * shops.length, discount: 10_000 * shops.length,
        grandTotal: 124_000 * shops.length,
        paymentStatus: paid ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING,
        status: paid ? ORDER_STATUS.CONFIRMED : ORDER_STATUS.PENDING_PAYMENT,
        paidAt: paid ? new Date() : null,
      },
      select: { id: true },
    });
    orderIds.push(order.id);
    const parcels: string[] = [];
    const products: string[] = [];
    for (const [i, orgId] of shops.entries()) {
      const product = await aProduct(orgId, 129_000);
      products.push(product.id);
      const item = await prisma.orderItem.create({
        data: { orderId: order.id, productId: product.id, quantity: 1, unitPrice: 129_000, discountPaise: 10_000, orgFundedPaise: 0 },
        select: { id: true },
      });
      await prisma.orderDiscount.create({
        data: {
          orderId: order.id, promotionId: coupon.id, orgId, labelSnapshot: "Coupon", codeSnapshot: coupon.code,
          buyerDiscountPaise: 10_000, orgFundedPaise: 0, platformFundedPaise: 10_000, budgetChargedPaise: 10_000,
        },
      });
      const parcel = await prisma.shipment.create({
        data: {
          code: `${code}-SH${i + 1}`, orderId: order.id, orgId,
          orgAddressId: orgId === fx.orgId ? fx.orgAddressId : null,
          fromPincode: "400001", fromCity: "Mumbai", fromState: "Maharashtra", shippingCost: 5_000,
          items: { create: [{ orderItemId: item.id, quantity: 1 }] },
        },
        select: { id: true },
      });
      parcels.push(parcel.id);
    }
    if (paid) await ledgerService.recordSale(order.id);
    return { orderId: order.id, parcels, products, couponId: coupon.id };
  }

  const shop = (orgId: string) => ({ actor: A.SHOP, orgId }) as const;
  const buyer = (orderId: string, userId = fx.userId) => ({ actor: A.BUYER, userId, orderId }) as const;
  const admin = { actor: "admin" as const, name: "Staff" };
  const statusOf = async (id: string) => (await prisma.shipment.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;
  const coupon = (id: string) => prisma.promotion.findUniqueOrThrow({ where: { id }, select: { usageCount: true, platformSpentPaise: true } });
  const stockOf = async (productId: string) =>
    (await prisma.productStock.findFirstOrThrow({ where: { productId, orgAddressId: fx.orgAddressId }, select: { quantity: true } })).quantity;
  const ledgerOf = (orderId: string, kind: "REVERSAL" | "CANCELLATION_FEE") => prisma.orgLedgerEntry.findMany({ where: { orderId, kind } });

  it("A6: a shop cancels a ₹1,240 parcel — stock, budget and coupon back, one reversal, ₹1,240 owed, one ₹50 fee; twice changes nothing", async () => {
    const { orderId, parcels: [p], products: [product], couponId } = await aPaidOrder([fx.orgId]);

    const result = await cancelParcel(p, shop(fx.orgId), "Out of stock");
    expect(result).toEqual({ feePaise: 5_000, refundPaise: 124_000, awb: null });

    expect(await statusOf(p)).toBe(S.CANCELLED);
    expect(await stockOf(product)).toBe(1);
    expect(await coupon(couponId)).toEqual({ usageCount: 0, platformSpentPaise: 0 });
    expect(await ledgerOf(orderId, "REVERSAL")).toHaveLength(1);
    const fees = await ledgerOf(orderId, "CANCELLATION_FEE");
    expect(fees.map((f) => [f.orgId, f.payablePaise])).toEqual([[fx.orgId, -5_000]]);
    expect(await prisma.refund.findMany({ where: { orderId }, select: { amountPaise: true, state: true, cause: true } })).toEqual([
      { amountPaise: 124_000, state: "OWED", cause: S.CANCELLED },
    ]);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(ORDER_STATUS.CANCELLED);
    const kinds = (await prisma.notificationEvent.findMany({ where: { shipmentId: p } })).map((n) => n.kind).sort();
    expect(kinds).toEqual([K.CANCELLED_BUYER, K.CANCELLED_SHOP].sort());

    await expect(cancelParcel(p, shop(fx.orgId), "Out of stock")).rejects.toThrow("This parcel is already cancelled.");
    expect(await stockOf(product)).toBe(1);
    expect(await coupon(couponId)).toEqual({ usageCount: 0, platformSpentPaise: 0 });
    expect(await ledgerOf(orderId, "CANCELLATION_FEE")).toHaveLength(1);
    expect(await prisma.refund.count({ where: { orderId } })).toBe(1);
  });

  it("A6: a buyer's cancel charges the shop nothing; the shop then hears the buyer was first", async () => {
    const { orderId, parcels: [p] } = await aPaidOrder([fx.orgId]);
    const result = await cancelParcel(p, buyer(orderId), "Found it cheaper");
    expect(result.feePaise).toBe(0);
    expect(await ledgerOf(orderId, "CANCELLATION_FEE")).toEqual([]);
    await expect(cancelParcel(p, shop(fx.orgId), "Out of stock")).rejects.toThrow(REFUSAL.shopBuyerFirst);
    await expect(cancelParcel(p, buyer(orderId), undefined)).rejects.toThrow(REFUSAL.buyerAlready);
  });

  it("A6: in a two-parcel coupon order the coupon returns only after both; each parcel's budget share once", async () => {
    const { orderId, parcels: [a, b], couponId } = await aPaidOrder([fx.orgId, fx.otherOrgId]);

    await cancelParcel(a, buyer(orderId), undefined);
    expect(await coupon(couponId)).toEqual({ usageCount: 1, platformSpentPaise: 10_000 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(ORDER_STATUS.CONFIRMED);

    await cancelParcel(b, admin, "Out of stock");
    expect(await coupon(couponId)).toEqual({ usageCount: 0, platformSpentPaise: 0 });
    expect(await prisma.promotionBudgetRelease.count({ where: { orderId } })).toBe(2);
    // Q11: two parcels' refunds, shipping each, sum to what was captured and no more.
    const refunds = await prisma.refund.findMany({ where: { orderId } });
    expect(refunds.reduce((s, r) => s + r.amountPaise, 0)).toBe(248_000);
  });

  it("A6: two cancels pressed at once move the parcel once and charge one fee", async () => {
    const { orderId, parcels: [p], products: [product] } = await aPaidOrder([fx.orgId]);
    const both = await Promise.allSettled([cancelParcel(p, shop(fx.orgId), "Out of stock"), cancelParcel(p, shop(fx.orgId), "Out of stock")]);
    expect(both.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await ledgerOf(orderId, "CANCELLATION_FEE")).toHaveLength(1);
    expect(await stockOf(product)).toBe(1);
    expect(await prisma.parcelEvent.count({ where: { shipmentId: p, toStatus: S.CANCELLED } })).toBe(1);
  });

  it("Q28: an admin's cancel racing the courier's pickup — one wins, and only a cancel owes a refund", async () => {
    const { orderId, parcels: [p] } = await aPaidOrder([fx.orgId]);
    await moveParcel(p, S.READY_FOR_PICKUP, { actor: A.SHOP });
    await moveParcel(p, S.PICKUP_BOOKED, { actor: A.ADMIN });
    const [cancelled, pickedUp] = await Promise.allSettled([
      cancelParcel(p, admin, "Out of stock"),
      moveParcel(p, S.PICKED_UP, { actor: A.COURIER }),
    ]);
    const final = await statusOf(p);
    expect([S.CANCELLED, S.PICKED_UP]).toContain(final);
    if (final === S.CANCELLED) {
      expect(cancelled.status).toBe("fulfilled");
      expect(pickedUp.status === "fulfilled" && pickedUp.value.kind).toBe("ignored");
      expect(await prisma.refund.count({ where: { orderId } })).toBe(1);
    } else {
      expect(cancelled.status).toBe("rejected");
      expect(await prisma.refund.count({ where: { orderId } })).toBe(0);
    }
  });

  it("R10, A7: buyer and shop cannot cancel once ready; the admin can until pickup, then is told why not", async () => {
    const { orderId, parcels: [p] } = await aPaidOrder([fx.orgId]);
    await moveParcel(p, S.READY_FOR_PICKUP, { actor: A.SHOP });
    await expect(cancelParcel(p, shop(fx.orgId), "Out of stock")).rejects.toThrow(REFUSAL.shopMarkedReady);
    await expect(cancelParcel(p, buyer(orderId), undefined)).rejects.toThrow(REFUSAL.buyerShopPacked);
    expect(await statusOf(p)).toBe(S.READY_FOR_PICKUP);

    const { parcels: [q] } = await aPaidOrder([fx.orgId]);
    await moveParcel(q, S.READY_FOR_PICKUP, { actor: A.SHOP });
    await moveParcel(q, S.PICKUP_BOOKED, { actor: A.ADMIN, booking: {
      pickupDate: new Date(), estimatedDelivery: new Date(), courierName: "Delhivery",
      trackingNumber: `AWB${Date.now()}${Math.floor(Math.random() * 1e6)}`, trackingUrl: "https://t.example", labelUrl: "https://l.example",
    } });
    const booked = await cancelParcel(q, admin, "Can't make it in time");
    expect(booked.awb).toMatch(/^AWB/);
    expect(booked.feePaise).toBe(0);

    const { parcels: [r] } = await aPaidOrder([fx.orgId]);
    await moveParcel(r, S.READY_FOR_PICKUP, { actor: A.SHOP });
    await moveParcel(r, S.PICKUP_BOOKED, { actor: A.ADMIN });
    await moveParcel(r, S.PICKED_UP, { actor: A.COURIER });
    await expect(cancelParcel(r, admin, "Out of stock")).rejects.toThrow(/^The courier picked this up at .+, so it can't be cancelled\./);
  });

  it("A8: an unpaid order's parcel cannot be cancelled by anyone", async () => {
    const { orderId, parcels: [p] } = await aPaidOrder([fx.orgId], { paid: false });
    await expect(cancelParcel(p, admin, "Out of stock")).rejects.toThrow(UNPAID);
    await expect(cancelParcel(p, buyer(orderId), undefined)).rejects.toThrow(UNPAID);
    expect(await statusOf(p)).toBe(S.PACKING);
  });

  it("scope: another shop, another buyer, a guest order and a wrong order id are all not-found", async () => {
    const { orderId, parcels: [p] } = await aPaidOrder([fx.orgId]);
    await expect(cancelParcel(p, shop(fx.otherOrgId), "Out of stock")).rejects.toMatchObject({ status: 404 });
    await expect(cancelParcel(p, buyer(orderId, "someone-else"), undefined)).rejects.toMatchObject({ status: 404 });
    await expect(cancelParcel(p, buyer("another-order"), undefined)).rejects.toMatchObject({ status: 404 });
    const guest = await aPaidOrder([fx.orgId], { userId: null });
    await expect(cancelParcel(guest.parcels[0], buyer(guest.orderId), undefined)).rejects.toMatchObject({ status: 404 });
    expect(await statusOf(p)).toBe(S.PACKING);
  });

  it("A12: the admin sets the fee to ₹75 and the next shop cancel charges ₹75; a stale save is refused", async () => {
    const seen = await fulfilmentSettingsService.view();
    await fulfilmentSettingsService.saveFee({ feeRupees: 75, seenVersion: seen.version }, { id: fx.userId, name: "Staff" });
    await expect(
      fulfilmentSettingsService.saveFee({ feeRupees: 60, seenVersion: seen.version }, { id: fx.userId, name: "Other" }),
    ).rejects.toThrow(/^Changed to ₹75 by Staff at .+\. Check before saving\.$/);

    const { orderId, parcels: [p] } = await aPaidOrder([fx.orgId]);
    expect((await cancelParcel(p, shop(fx.orgId), "Out of stock")).feePaise).toBe(7_500);
    expect((await ledgerOf(orderId, "CANCELLATION_FEE"))[0].payablePaise).toBe(-7_500);

    const now = await fulfilmentSettingsService.view();
    await fulfilmentSettingsService.saveFee({ feeRupees: feeBefore / 100, seenVersion: now.version }, { id: fx.userId, name: "Staff" });
    const counts = await fulfilmentSettingsService.cancelCounts(1);
    expect(counts.rows.find((r) => r.orgId === fx.orgId)?.count).toBeGreaterThan(0);
  });

  it("D15: a settlement may not leave a shop's fees behind, and never pays out at or below zero", async () => {
    const code = unique().toUpperCase();
    const org = await prisma.org.create({ data: { code, handle: code.toLowerCase(), name: "Settle", email: `${code.toLowerCase()}@example.invalid` }, select: { id: true } });
    orgIds.push(org.id);
    const entry = (kind: "ADJUSTMENT" | "CANCELLATION_FEE", payablePaise: number) =>
      prisma.orgLedgerEntry.create({
        data: {
          orgId: org.id, kind, payablePaise, grossItemsPaise: 0, orgFundedDiscountPaise: 0,
          platformFundedDiscountPaise: 0, commissionBasePaise: 0, commissionPaise: 0,
        },
        select: { id: true },
      });
    const earned = await entry("ADJUSTMENT", 3_000);
    const fee = await entry("CANCELLATION_FEE", -5_000);

    await expect(settlementService.createSettlement({ orgId: org.id, entryIds: [earned.id] }, fx.userId)).rejects.toThrow(SETTLEMENT_REFUSALS.leavesDebt);
    await expect(settlementService.createSettlement({ orgId: org.id, entryIds: [earned.id, fee.id] }, fx.userId)).rejects.toThrow(SETTLEMENT_REFUSALS.notAboveZero);

    const more = await entry("ADJUSTMENT", 4_000);
    const settled = await settlementService.createSettlement({ orgId: org.id, entryIds: [earned.id, fee.id, more.id] }, fx.userId);
    expect(settled.amountPaise).toBe(2_000);
  });
});
