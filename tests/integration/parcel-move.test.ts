/**
 * The one guarded way a parcel moves, under its order's lock, with the order's status derived
 * from its parcels in the same transaction
 * (order-fulfilment (`431ed6e7:docs/specs/own-store/order-fulfilment/trd.md`) D2, D4).
 *
 * Owns its fixtures, like `shipment-effects.test.ts`: a migrated schema and nothing in it.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const PREFIX = "parcel-move-";
/** A value the pre-vocabulary code wrote; deliberately outside SHIPMENT_STATUS. */
const OFF_LIST_STATUS = "pending";

describe.skipIf(!isDisposableDb)("a parcel moves once, and the order follows", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let moveParcel: typeof import("@server/checkout/fulfilment.service").moveParcel;
  let S: typeof import("@server/shipping/domain/shipping.types").SHIPMENT_STATUS;
  let ORDER_STATUS: typeof import("@server/checkout/order.types").ORDER_STATUS;
  let PAYMENT_STATUS: typeof import("@server/checkout/order.types").PAYMENT_STATUS;
  let A: typeof import("@server/shipping/domain/shipping.types").PARCEL_ACTOR;
  let ConflictError: typeof import("@server/shared/domain-error").ConflictError;
  const madeOrderIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ moveParcel } = await import("@server/checkout/fulfilment.service"));
    ({ SHIPMENT_STATUS: S } = await import("@server/shipping/domain/shipping.types"));
    ({ ORDER_STATUS, PAYMENT_STATUS } = await import("@server/checkout/order.types"));
    ({ PARCEL_ACTOR: A } = await import("@server/shipping/domain/shipping.types"));
    ({ ConflictError } = await import("@server/shared/domain-error"));
  });

  afterAll(async () => {
    if (!madeOrderIds.length) return;
    const inOrders = { orderId: { in: madeOrderIds } };
    await prisma.parcelEvent.deleteMany({ where: { shipment: inOrders } });
    await prisma.orgLedgerEntryLine.deleteMany({ where: { entry: inOrders } });
    await prisma.orgLedgerEntry.deleteMany({ where: inOrders });
    await prisma.shipment.deleteMany({ where: inOrders });
    await prisma.order.deleteMany({ where: { id: { in: madeOrderIds } } });
  });

  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  /** A paid order with one parcel per given status. No lines: these moves touch no stock. */
  async function aPaidOrder(...statuses: string[]) {
    const { orgId } = await ensureFixtures();
    const code = unique();
    const order = await prisma.order.create({
      data: {
        code: `BB-${code.slice(-8).toUpperCase()}`, address: {}, grandTotal: 0,
        paymentStatus: PAYMENT_STATUS.PAID, status: ORDER_STATUS.CONFIRMED,
      },
      select: { id: true },
    });
    madeOrderIds.push(order.id);
    const parcels: string[] = [];
    for (const [i, status] of statuses.entries()) {
      const s = await prisma.shipment.create({
        data: {
          code: `${code}-SH${i + 1}`, orderId: order.id, orgId,
          fromPincode: "400001", fromCity: "Mumbai", fromState: "Maharashtra",
          shippingCost: 0, status,
        },
        select: { id: true },
      });
      parcels.push(s.id);
    }
    return { orderId: order.id, parcels };
  }

  const statusOf = async (id: string) =>
    (await prisma.shipment.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;
  const orderStatusOf = async (id: string) =>
    (await prisma.order.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;

  it("'delivered' arriving twice moves the parcel once (spec A5)", async () => {
    const { orderId, parcels: [p] } = await aPaidOrder(S.OUT_FOR_DELIVERY);

    const [first, second] = await Promise.all([
      moveParcel(p, S.DELIVERED, { actor: A.COURIER }),
      moveParcel(p, S.DELIVERED, { actor: A.COURIER }),
    ]);

    const kinds = [first.kind, second.kind].sort();
    expect(kinds).toEqual(["ignored", "moved"]);
    expect(await statusOf(p)).toBe(S.DELIVERED);
    const events = await prisma.parcelEvent.findMany({ where: { shipmentId: p } });
    expect(events, "one timeline row per move").toHaveLength(1);
    expect(events[0]).toMatchObject({ fromStatus: S.OUT_FOR_DELIVERY, toStatus: S.DELIVERED, actor: A.COURIER });
    expect(await orderStatusOf(orderId)).toBe(ORDER_STATUS.DELIVERED);
  });

  it("delivery passes the transition check like any other move (spec R1)", async () => {
    const { orderId, parcels: [p] } = await aPaidOrder(S.PACKING);
    const outcome = await moveParcel(p, S.DELIVERED, { actor: A.COURIER });
    expect(outcome).toMatchObject({ kind: "ignored", reason: "not-allowed" });
    expect(await statusOf(p)).toBe(S.PACKING);
    expect(await orderStatusOf(orderId)).toBe(ORDER_STATUS.CONFIRMED);
  });

  it("a person's move that lost the race is refused with the current state (D2)", async () => {
    const { parcels: [p] } = await aPaidOrder(S.PACKING);
    const results = await Promise.allSettled([
      moveParcel(p, S.READY_FOR_PICKUP, { actor: A.SHOP, refuse: true }),
      moveParcel(p, S.READY_FOR_PICKUP, { actor: A.SHOP, refuse: true }),
    ]);
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0].reason).toBeInstanceOf(ConflictError);
    // ux.md, shop parcel "Stale" row.
    expect((lost[0].reason as Error).message).toBe("This parcel is already ready for pickup.");
    expect(await prisma.parcelEvent.count({ where: { shipmentId: p } })).toBe(1);
  });

  it("the order's status is read off its parcels on every move (D4)", async () => {
    const { orderId, parcels: [a, b] } = await aPaidOrder(S.PICKUP_BOOKED, S.PACKING);

    await moveParcel(a, S.PICKED_UP, { actor: A.ADMIN });
    expect(await orderStatusOf(orderId)).toBe(ORDER_STATUS.SHIPPED);

    await moveParcel(b, S.CANCELLED, { actor: A.ADMIN });
    expect(await orderStatusOf(orderId)).toBe(ORDER_STATUS.SHIPPED);
  });

  it("an order whose every parcel is cancelled reads cancelled (D4)", async () => {
    const { orderId, parcels: [a, b] } = await aPaidOrder(S.PACKING, S.READY_FOR_PICKUP);
    await moveParcel(a, S.CANCELLED, { actor: A.ADMIN });
    expect(await orderStatusOf(orderId)).toBe(ORDER_STATUS.CONFIRMED);
    await moveParcel(b, S.CANCELLED, { actor: A.ADMIN });
    expect(await orderStatusOf(orderId)).toBe(ORDER_STATUS.CANCELLED);
  });

  it("a wholly cancelled order leaves the paid counts, and a ready parcel is still to send (D4)", async () => {
    const { widgetsRepository } = await import("@server/analytics/widgets.repository");
    const { orgId } = await ensureFixtures();
    const { parcels: [p] } = await aPaidOrder(S.PACKING);
    const paidBefore = await widgetsRepository.paidOrderCount(orgId);
    const toSendBefore = await widgetsRepository.pendingParcelCount(orgId);

    await moveParcel(p, S.READY_FOR_PICKUP, { actor: A.SHOP });
    expect(await widgetsRepository.pendingParcelCount(orgId)).toBe(toSendBefore);

    await moveParcel(p, S.CANCELLED, { actor: A.ADMIN });
    expect(await widgetsRepository.paidOrderCount(orgId)).toBe(paidBefore - 1);
    expect(await widgetsRepository.pendingParcelCount(orgId)).toBe(toSendBefore - 1);
  });

  it("a late courier event never un-delivers a hand-delivered order (D4)", async () => {
    const { orderId, parcels: [p] } = await aPaidOrder(S.PICKED_UP);
    await prisma.order.update({ where: { id: orderId }, data: { status: ORDER_STATUS.DELIVERED } });
    expect((await moveParcel(p, S.IN_TRANSIT, { actor: A.COURIER })).kind).toBe("moved");
    expect(await orderStatusOf(orderId)).toBe(ORDER_STATUS.DELIVERED);
  });

  it("a parcel of an unpaid order cannot be cancelled, so expiry cannot restock twice (Q9)", async () => {
    const { UNPAID_CANCEL_MESSAGE } = await import("@server/checkout/fulfilment.service");
    const { orderId, parcels: [p] } = await aPaidOrder(S.PACKING);
    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: PAYMENT_STATUS.PENDING, status: ORDER_STATUS.PENDING_PAYMENT } });
    await expect(moveParcel(p, S.CANCELLED, { actor: A.ADMIN })).rejects.toThrow(UNPAID_CANCEL_MESSAGE);
    expect(await statusOf(p)).toBe(S.PACKING);
    expect(await prisma.parcelEvent.count({ where: { shipmentId: p } })).toBe(0);
  });

  it("a parcel holding an off-list status is refused with a clear message, not a crash (D3)", async () => {
    const { ConflictError } = await import("@server/shared/domain-error");
    const { parcels: [p] } = await aPaidOrder(OFF_LIST_STATUS);
    const refused = moveParcel(p, S.DELIVERED, { actor: A.COURIER });
    await expect(refused).rejects.toBeInstanceOf(ConflictError);
    await expect(moveParcel(p, S.DELIVERED, { actor: A.COURIER })).rejects.toThrow(/don't recognise \("pending"\)/);
    expect(await statusOf(p)).toBe(OFF_LIST_STATUS);
  });

  it("an unpaid order's status is never touched by a parcel move (D4)", async () => {
    const { orderId, parcels: [p] } = await aPaidOrder(S.PICKUP_BOOKED);
    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: PAYMENT_STATUS.PENDING, status: ORDER_STATUS.PENDING_PAYMENT } });
    expect((await moveParcel(p, S.PICKED_UP, { actor: A.ADMIN })).kind).toBe("moved");
    expect(await orderStatusOf(orderId)).toBe(ORDER_STATUS.PENDING_PAYMENT);
  });

  it("the parcel write is conditional on the status it read, even without the order lock (D2)", async () => {
    const { applyStatus } = await import("@server/shipping/shipment-status.service");
    const { parcels: [p] } = await aPaidOrder(S.OUT_FOR_DELIVERY);
    // Two transactions that both read out_for_delivery before either writes.
    let release!: () => void;
    const bothRead = new Promise<void>((r) => (release = r));
    let reads = 0;
    const racer = () =>
      prisma.$transaction(async (tx) => {
        await tx.shipment.findUnique({ where: { id: p }, select: { status: true } });
        if (++reads === 2) release();
        await bothRead;
        return applyStatus(p, S.DELIVERED, { actor: A.COURIER }, tx);
      });
    const results = await Promise.allSettled([racer(), racer()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.parcelEvent.count({ where: { shipmentId: p } })).toBe(1);
  });
});
