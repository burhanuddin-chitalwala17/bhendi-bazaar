/**
 * The shop marks its own parcel ready, the admin is told once, and the sweep nudges a shop that
 * has not packed ([order-fulfilment](../../docs/specs/own-store/order-fulfilment/trd.md) U2: D6,
 * D7, D8, D18; spec A1, A2, A10, A11). Owns its fixtures: a migrated schema and nothing in it.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { JOBS_QUEUE, JOBS_SCHEMA } from "@server/shared/jobs/jobs.config";

vi.mock("next-auth", () => ({ getServerSession: async () => null }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));
vi.mock("@/lib/admin-auth", () => ({
  requirePlatformAdmin: async () => ({ user: { id: "admin-test" } }),
  requirePlatformAdminId: async () => "admin-test",
}));

const PREFIX = "parcel-ready-";
const HOUR = 3_600_000;

describe.skipIf(!isDisposableDb)("the shop marks a parcel ready, and nudges follow the clock", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let markParcelReady: typeof import("@server/checkout/fulfilment.service").markParcelReady;
  let moveParcel: typeof import("@server/checkout/fulfilment.service").moveParcel;
  let runFulfilmentSweep: typeof import("@server/checkout/fulfilment-nudges").runFulfilmentSweep;
  let listNotPacked: typeof import("@server/checkout/fulfilment-nudges").listNotPacked;
  let emailShopAboutParcel: typeof import("@server/checkout/fulfilment-nudges").emailShopAboutParcel;
  let countNotPacked: typeof import("@server/checkout/fulfilment-nudges").countNotPacked;
  let adminOrderRepository: typeof import("@server/checkout/admin.order.repository").adminOrderRepository;
  let S: typeof import("@server/shipping/domain/shipping.types").SHIPMENT_STATUS;
  let A: typeof import("@server/shipping/domain/shipping.types").PARCEL_ACTOR;
  let K: typeof import("@server/notifications/notice.types").NOTICE_KIND;
  let ORDER_STATUS: typeof import("@server/checkout/order.types").ORDER_STATUS;
  let PAYMENT_STATUS: typeof import("@server/checkout/order.types").PAYMENT_STATUS;
  let orgId: string;
  let otherOrgId: string;
  const madeOrderIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ markParcelReady, moveParcel } = await import("@server/checkout/fulfilment.service"));
    ({ runFulfilmentSweep, listNotPacked, emailShopAboutParcel, countNotPacked } = await import("@server/checkout/fulfilment-nudges"));
    ({ adminOrderRepository } = await import("@server/checkout/admin.order.repository"));
    ({ SHIPMENT_STATUS: S, PARCEL_ACTOR: A } = await import("@server/shipping/domain/shipping.types"));
    ({ NOTICE_KIND: K } = await import("@server/notifications/notice.types"));
    ({ ORDER_STATUS, PAYMENT_STATUS } = await import("@server/checkout/order.types"));
    ({ orgId, otherOrgId } = await ensureFixtures());
  });

  afterAll(async () => {
    if (!madeOrderIds.length) return;
    const ids = await prisma.notice.findMany({ where: { shipment: { orderId: { in: madeOrderIds } } }, select: { id: true } });
    if (ids.length) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'noticeId' = ANY($2)`,
        JOBS_QUEUE,
        ids.map((n) => n.id),
      );
    }
    const inOrders = { orderId: { in: madeOrderIds } };
    await prisma.notice.deleteMany({ where: { shipment: inOrders } });
    await prisma.parcelEvent.deleteMany({ where: { shipment: inOrders } });
    await prisma.shipment.deleteMany({ where: inOrders });
    await prisma.order.deleteMany({ where: { id: { in: madeOrderIds } } });
  });

  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  /** An order with one parcel per given org, paid `paidHoursAgo` ago (or unpaid). */
  async function anOrder(orgs: string[], opts: { paidHoursAgo?: number | null } = {}) {
    const code = unique();
    const paid = opts.paidHoursAgo !== null;
    const order = await prisma.order.create({
      data: {
        code: `BB-${code.slice(-8).toUpperCase()}`,
        address: {
          fullName: "Asha Buyer", mobile: "+919812345678", addressLine1: "12 Secret Lane",
          city: "Pune", state: "MH", pincode: "411001", country: "India",
        },
        grandTotal: 0,
        paymentStatus: paid ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING,
        status: paid ? ORDER_STATUS.CONFIRMED : ORDER_STATUS.PENDING_PAYMENT,
        paidAt: paid ? new Date(Date.now() - (opts.paidHoursAgo ?? 0) * HOUR) : null,
      },
      select: { id: true },
    });
    madeOrderIds.push(order.id);
    const parcels: string[] = [];
    for (const [i, org] of orgs.entries()) {
      const s = await prisma.shipment.create({
        data: {
          code: `${code}-SH${i + 1}`, orderId: order.id, orgId: org,
          fromPincode: "400001", fromCity: "Mumbai", fromState: "Maharashtra", shippingCost: 0,
        },
        select: { id: true },
      });
      parcels.push(s.id);
    }
    return { orderId: order.id, parcels };
  }

  const statusOf = async (id: string) =>
    (await prisma.shipment.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;
  const noticesOf = (id: string, kind?: string) =>
    prisma.notice.findMany({ where: { shipmentId: id, ...(kind ? { kind } : {}) } });
  const jobsFor = async (noticeId: string) => {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->>'type' = 'notify.send' AND data->'payload'->>'noticeId' = $2`,
      JOBS_QUEUE,
      noticeId,
    );
    return Number(rows[0].n);
  };

  it("A1: shop A marks its parcel ready; shop B's parcel is still to pack, and B cannot move A's", async () => {
    const { parcels: [a, b] } = await anOrder([orgId, otherOrgId], { paidHoursAgo: 1 });

    await expect(markParcelReady(a, otherOrgId)).rejects.toMatchObject({ status: 404 });
    await markParcelReady(a, orgId);

    expect(await statusOf(a)).toBe(S.READY_FOR_PICKUP);
    expect(await statusOf(b)).toBe(S.PACKING);
  });

  it("D6: a parcel of an unpaid order is not-found to the shop", async () => {
    const { parcels: [p] } = await anOrder([orgId], { paidHoursAgo: null });
    await expect(markParcelReady(p, orgId)).rejects.toMatchObject({ status: 404 });
    expect(await statusOf(p)).toBe(S.PACKING);
  });

  it("ux Stale and Refused: ready twice says already ready; ready on a cancelled parcel names who and when", async () => {
    const { parcels: [p, q] } = await anOrder([orgId, orgId], { paidHoursAgo: 1 });
    await markParcelReady(p, orgId);
    await expect(markParcelReady(p, orgId)).rejects.toThrow("This parcel is already ready for pickup.");

    await moveParcel(q, S.CANCELLED, { actor: A.BUYER, refuse: true });
    await expect(markParcelReady(q, orgId)).rejects.toThrow(/^This parcel was cancelled by the buyer on \d{1,2} \w{3}\. Don't send it\.$/);
  });

  it("A2, D8: marking ready writes one admin notice and enqueues one send; a repeat writes none", async () => {
    const { parcels: [p] } = await anOrder([orgId], { paidHoursAgo: 1 });
    await markParcelReady(p, orgId);
    await expect(markParcelReady(p, orgId)).rejects.toThrow("This parcel is already ready for pickup.");

    const ready = await noticesOf(p, K.READY);
    expect(ready).toHaveLength(1);
    expect(ready[0].audience).toBe("admin");
    expect(await jobsFor(ready[0].id)).toBe(1);
  });

  it("A2: an admin walking a parcel to ready is not the shop's cue, so no notice", async () => {
    const { parcels: [p] } = await anOrder([orgId], { paidHoursAgo: 1 });
    await moveParcel(p, S.READY_FOR_PICKUP, { actor: A.ADMIN, refuse: true });
    expect(await noticesOf(p, K.READY)).toHaveLength(0);
  });

  it("A11: the sweep nudges the shop at 12 h and 24 h, once each, and never for an unpaid or ready parcel", async () => {
    const at13 = await anOrder([orgId], { paidHoursAgo: 13 });
    const at25 = await anOrder([orgId], { paidHoursAgo: 25 });
    const at2 = await anOrder([orgId], { paidHoursAgo: 2 });
    const ready = await anOrder([orgId], { paidHoursAgo: 30 });
    await markParcelReady(ready.parcels[0], orgId);
    const unpaid = await anOrder([orgId], { paidHoursAgo: null });

    await runFulfilmentSweep();
    await runFulfilmentSweep();

    expect((await noticesOf(at13.parcels[0])).map((n) => n.kind)).toEqual([K.NOT_READY_12H]);
    // Past a day, one "a day ago" email rather than two at once.
    expect((await noticesOf(at25.parcels[0])).map((n) => n.kind)).toEqual([K.NOT_READY_24H]);
    expect(await noticesOf(at2.parcels[0])).toHaveLength(0);
    expect((await noticesOf(ready.parcels[0])).map((n) => n.kind)).toEqual([K.READY]);
    expect(await noticesOf(unpaid.parcels[0])).toHaveLength(0);
  });

  it("A2: a parcel ready 24 h and still unbooked emails the admin again, once", async () => {
    const { parcels: [p] } = await anOrder([orgId], { paidHoursAgo: 30 });
    await markParcelReady(p, orgId);
    await prisma.parcelEvent.updateMany({ where: { shipmentId: p, toStatus: S.READY_FOR_PICKUP }, data: { createdAt: new Date(Date.now() - 25 * HOUR) } });

    await runFulfilmentSweep();
    await runFulfilmentSweep();
    expect(await noticesOf(p, K.READY_24H)).toHaveLength(1);
  });

  it("A11: the admin's not-packed list holds parcels paid 36 h ago and not ready; Email shop sends once", async () => {
    const old = await anOrder([orgId], { paidHoursAgo: 40 });
    const young = await anOrder([orgId], { paidHoursAgo: 30 });

    const ids = (await listNotPacked({ orgId })).map((r) => r.shipmentId);
    expect(ids).toContain(old.parcels[0]);
    expect(ids).not.toContain(young.parcels[0]);
    expect(await countNotPacked({ orgId })).toBe((await listNotPacked({ orgId }, new Date(), 10_000)).length);
    await expect(emailShopAboutParcel(young.parcels[0])).rejects.toMatchObject({ status: 404 });

    const { message } = await emailShopAboutParcel(old.parcels[0]);
    expect(message).toMatch(/^Email sent to .+\.$/);
    await expect(emailShopAboutParcel(old.parcels[0])).rejects.toMatchObject({ status: 409 });
    expect((await listNotPacked({ orgId })).find((r) => r.shipmentId === old.parcels[0])?.adminEmailedAt).not.toBeNull();

    await markParcelReady(old.parcels[0], orgId);
    expect((await listNotPacked({ orgId })).map((r) => r.shipmentId)).not.toContain(old.parcels[0]);
  });

  it("D6: the tracking form refuses a parcel the shop has not marked ready, and books a ready one", async () => {
    const { PATCH } = await import("@/app/api/admin/shipments/[id]/tracking/route");
    const patch = (id: string, awb: string) =>
      PATCH(
        new NextRequest(`http://localhost/api/admin/shipments/${id}/tracking`, {
          method: "PATCH",
          body: JSON.stringify({ trackingNumber: awb, courierName: "Delhivery" }),
        }),
        { params: Promise.resolve({ id }) },
      );
    const { orderId, parcels: [p] } = await anOrder([orgId], { paidHoursAgo: 1 });
    // The order saying `packed` no longer lets a packing parcel through (pre-unit-2 path).
    await prisma.order.update({ where: { id: orderId }, data: { status: ORDER_STATUS.PACKED } });

    const refused = await patch(p, `AWB${Date.now()}`);
    expect(refused.status).toBe(409);
    expect(JSON.stringify(await refused.json())).toContain("The shop hasn't marked this parcel ready yet.");
    expect(await statusOf(p)).toBe(S.PACKING);

    await markParcelReady(p, orgId);
    const booked = await patch(p, `AWB${Date.now()}`);
    expect(booked.status).toBe(200);
    expect(await statusOf(p)).toBe(S.PICKUP_BOOKED);
  });

  it("A10: the shop's order read carries the buyer's name, city and pincode — never phone or street", async () => {
    const { orderId } = await anOrder([orgId, otherOrgId], { paidHoursAgo: 1 });
    const view = await adminOrderRepository.getShopOrder(orderId, orgId);

    expect(view?.buyer).toEqual({ name: "Asha Buyer", city: "Pune", pincode: "411001" });
    expect(view?.parcels).toHaveLength(1);
    const wire = JSON.stringify(view);
    expect(wire).not.toContain("9812345678");
    expect(wire).not.toContain("Secret Lane");
  });

  it("D18: confirmPaid stamps paidAt, the clock the nudges run on", async () => {
    const { orderId } = await anOrder([orgId], { paidHoursAgo: null });
    const { orderRepository } = await import("@server/checkout/order.repository");
    expect(await orderRepository.confirmPaid(orderId, `pay_${unique()}`)).toBe(true);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { paidAt: true } });
    expect(row.paidAt).toBeInstanceOf(Date);
  });
});
