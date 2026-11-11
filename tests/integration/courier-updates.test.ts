/**
 * Signed courier updates move parcels once, email once, and land what cannot apply on the admin's
 * conflict list (order-fulfilment (`431ed6e7:docs/specs/own-store/order-fulfilment/trd.md`) U4: D9, D10;
 * spec R8, R9, A4, A5, A13). Drives the real route. Owns its fixtures: a migrated schema and nothing in it.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { JOBS_QUEUE, JOBS_SCHEMA } from "@server/shared/jobs/jobs.config";

vi.mock("next-auth", () => ({ getServerSession: async () => null }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));
vi.mock("@/lib/admin-auth", () => ({
  requirePlatformAdmin: async () => ({ user: { id: "admin-test", name: "Zainab" } }),
  requirePlatformAdminId: async () => "admin-test",
}));

const PREFIX = "courier-updates-";
const TOKEN = "test-courier-token-a4";
const LABEL = "https://kr-shipmultichannel-mum.s3.ap-south-1.amazonaws.com/label.pdf";

const indiaDayFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

describe.skipIf(!isDisposableDb)("courier updates: signed, once, and conflicts kept", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let F: typeof import("@server/checkout/fulfilment.service");
  let B: typeof import("@server/checkout/fulfilment-booking");
  let POST: typeof import("@/app/api/webhooks/shipping/courier/route").POST;
  let DISMISS: typeof import("@/app/api/admin/courier-conflicts/[id]/dismiss/route").POST;
  let listCourierConflicts: typeof import("@server/shipping/courier-conflict.service").listCourierConflicts;
  let countOpenCourierConflicts: typeof import("@server/shipping/courier-conflict.service").countOpenCourierConflicts;
  let S: typeof import("@server/shipping/domain/shipping.types").SHIPMENT_STATUS;
  let A: typeof import("@server/shipping/domain/shipping.types").PARCEL_ACTOR;
  let EK: typeof import("@server/shipping/domain/shipping.types").PARCEL_EVENT_KIND;
  let CK: typeof import("@server/shipping/domain/shipping.types").COURIER_CONFLICT_KIND;
  let K: typeof import("@server/notifications/notice.types").NOTICE_KIND;
  let ORDER_STATUS: typeof import("@server/checkout/order.types").ORDER_STATUS;
  let PAYMENT_STATUS: typeof import("@server/checkout/order.types").PAYMENT_STATUS;
  let orgId: string;
  const madeOrderIds: string[] = [];
  const awbs: string[] = [];

  beforeAll(async () => {
    vi.stubEnv("SHIPROCKET_WEBHOOK_TOKEN", TOKEN);
    ({ prisma } = await import("@server/shared/prisma"));
    F = await import("@server/checkout/fulfilment.service");
    B = await import("@server/checkout/fulfilment-booking");
    ({ POST } = await import("@/app/api/webhooks/shipping/courier/route"));
    ({ POST: DISMISS } = await import("@/app/api/admin/courier-conflicts/[id]/dismiss/route"));
    ({ listCourierConflicts, countOpenCourierConflicts } = await import("@server/shipping/courier-conflict.service"));
    ({ SHIPMENT_STATUS: S, PARCEL_ACTOR: A, PARCEL_EVENT_KIND: EK, COURIER_CONFLICT_KIND: CK } = await import(
      "@server/shipping/domain/shipping.types"
    ));
    ({ NOTICE_KIND: K } = await import("@server/notifications/notice.types"));
    ({ ORDER_STATUS, PAYMENT_STATUS } = await import("@server/checkout/order.types"));
    ({ orgId } = await ensureFixtures());
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    if (awbs.length) await prisma.courierConflict.deleteMany({ where: { awb: { in: awbs } } });
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
    await prisma.shippingEvent.deleteMany({ where: inOrders });
    await prisma.shipment.deleteMany({ where: inOrders });
    await prisma.order.deleteMany({ where: { id: { in: madeOrderIds } } });
  });

  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newAwb = () => {
    const awb = `AWB${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    awbs.push(awb);
    return awb;
  };

  /** A paid parcel, marked ready by its shop and booked by the admin with `awb`. */
  async function aBookedParcel(awb: string) {
    const code = unique();
    const order = await prisma.order.create({
      data: {
        code: `BB-${code.slice(-8).toUpperCase()}`,
        address: { fullName: "Asha Buyer", email: "asha@example.test", city: "Pune", pincode: "411001" },
        grandTotal: 0,
        paymentStatus: PAYMENT_STATUS.PAID,
        status: ORDER_STATUS.CONFIRMED,
        paidAt: new Date(),
      },
      select: { id: true },
    });
    madeOrderIds.push(order.id);
    const s = await prisma.shipment.create({
      data: { code: `${code}-SH1`, orderId: order.id, orgId, fromPincode: "400001", fromCity: "Mumbai", fromState: "Maharashtra", shippingCost: 0 },
      select: { id: true },
    });
    await F.markParcelReady(s.id, orgId);
    await B.bookPickup(
      s.id,
      {
        pickupDate: indiaDayFromNow(1),
        estimatedDelivery: indiaDayFromNow(5),
        courierName: "Delhivery",
        trackingNumber: awb,
        trackingUrl: `https://www.delhivery.com/track/package/${awb}`,
        labelUrl: LABEL,
      },
      { name: "Zainab" },
    );
    return { id: s.id, code: `${code}-SH1` };
  }

  const send = (body: unknown, token: string | null = TOKEN) =>
    POST(
      new NextRequest("http://localhost/api/webhooks/shipping/courier", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token === null ? {} : { "x-api-key": token }) },
        body: JSON.stringify(body),
      }),
    );
  const statusOf = async (id: string) => (await prisma.shipment.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;
  const noticesOf = (id: string, kind: string) => prisma.notice.findMany({ where: { shipmentId: id, kind } });

  it("A4: an update without the token, or with a wrong one, is refused and moves nothing; with it, the parcel moves", async () => {
    const awb = newAwb();
    const p = await aBookedParcel(awb);

    expect((await send({ awb, shipment_status: "PICKED UP" }, null)).status).toBe(401);
    expect((await send({ awb, shipment_status: "PICKED UP" }, "guess")).status).toBe(401);
    expect(await statusOf(p.id)).toBe(S.PICKUP_BOOKED);

    const ok = await send({ awb, shipment_status: "PICKED UP" });
    expect(ok.status).toBe(200);
    expect(await statusOf(p.id)).toBe(S.PICKED_UP);
    // R9: the courier's move is on the timeline, by the courier, and the shop is emailed.
    const row = await prisma.parcelEvent.findFirst({ where: { shipmentId: p.id, toStatus: S.PICKED_UP } });
    expect(row?.actor).toBe(A.COURIER);
    expect(await noticesOf(p.id, K.PICKED_UP)).toHaveLength(1);
  });

  it("A5, R9: \"Delivered\" arriving twice moves the parcel once and emails the buyer once", async () => {
    const awb = newAwb();
    const p = await aBookedParcel(awb);
    for (const status of ["PICKED UP", "IN TRANSIT", "OUT FOR DELIVERY"]) {
      expect((await send({ awb, shipment_status: status })).status).toBe(200);
    }
    const [first, second] = await Promise.all([
      send({ awb, shipment_status: "DELIVERED" }),
      send({ awb, shipment_status: "DELIVERED" }),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);

    expect(await statusOf(p.id)).toBe(S.DELIVERED);
    expect(await prisma.parcelEvent.count({ where: { shipmentId: p.id, toStatus: S.DELIVERED } })).toBe(1);
    const delivered = await noticesOf(p.id, K.DELIVERED);
    expect(delivered).toHaveLength(1);
    expect(delivered[0].recipient).toBe("asha@example.test");
  });

  it("A13: an update for an AWB no parcel carries is answered 200 and lands on the conflict list", async () => {
    const awb = newAwb();
    const res = await send({ awb, shipment_status: "IN TRANSIT", current_timestamp: "01 11 2026 10:00:00" });
    expect(res.status).toBe(200);
    const rows = await prisma.courierConflict.findMany({ where: { awb } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: CK.UNKNOWN_AWB, provider: "shiprocket", courierWording: "IN TRANSIT", shipmentId: null });
    expect(rows[0].payload).toMatchObject({ awb, current_timestamp: "01 11 2026 10:00:00" });
  });

  it("A13: a numeric AWB past 2^53 is refused, not rounded into a false conflict", async () => {
    const res = await send({ awb: 12345678901234567, shipment_status: "IN TRANSIT" });
    expect(res.status).toBe(400);
  });

  it("A13: a courier move on a cancelled parcel is a conflict and the parcel stays cancelled; the courier echoing the cancel is not", async () => {
    const awb = newAwb();
    const p = await aBookedParcel(awb);
    await F.moveParcel(p.id, S.CANCELLED, { actor: A.ADMIN, reason: "No courier serves this pincode", refuse: true });

    expect((await send({ awb, shipment_status: "CANCELED" })).status).toBe(200);
    expect(await prisma.courierConflict.count({ where: { awb } })).toBe(0);

    expect((await send({ awb, shipment_status: "PICKED UP" })).status).toBe(200);
    expect(await statusOf(p.id)).toBe(S.CANCELLED);
    const rows = await prisma.courierConflict.findMany({ where: { awb } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: CK.CANCELLED_PARCEL, shipmentId: p.id, parcelCode: p.code, courierWording: "PICKED UP" });
  });

  it("A13: one AWB's updates show as one row with a count, and Dismiss clears them all once", async () => {
    const awb = newAwb();
    await send({ awb, shipment_status: "IN TRANSIT" });
    await send({ awb, shipment_status: "OUT FOR DELIVERY" });
    await send({ awb, shipment_status: "DELIVERED" });

    const open = (await listCourierConflicts(500)).rows.filter((r) => r.awb === awb);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ updates: 3, dismissed: false, courierWording: "DELIVERED" });
    // The tab counts what the list shows: one per AWB, not one per retry.
    const before = await countOpenCourierConflicts();
    await send({ awb, shipment_status: "DELIVERED" });
    expect(await countOpenCourierConflicts()).toBe(before);
    await send({ awb: newAwb(), shipment_status: "IN TRANSIT" });
    expect(await countOpenCourierConflicts()).toBe(before + 1);

    const press = () => DISMISS(new NextRequest("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: open[0].id }) });
    expect((await press()).status).toBe(200);
    const after = (await listCourierConflicts(500)).rows.filter((r) => r.awb === awb);
    expect(after).toEqual([expect.objectContaining({ dismissed: true, dismissedByName: "Zainab", updates: 4 })]);
    const firstDismissal = await prisma.courierConflict.findFirstOrThrow({ where: { awb }, select: { dismissedAt: true } });
    expect((await press()).status).toBe(200);
    // A second press changes nothing: the rows keep who dismissed them and when.
    expect(await prisma.courierConflict.findFirstOrThrow({ where: { awb }, select: { dismissedAt: true } })).toEqual(firstDismissal);
  });

  it("D10, Q6: a differing courier ETD replaces the ETA, notes it on the timeline and emails the buyer once", async () => {
    const awb = newAwb();
    const p = await aBookedParcel(awb);
    const etd = indiaDayFromNow(7);

    await send({ awb, shipment_status: "PICKED UP", etd: `${etd} 15:40:19` });
    await send({ awb, shipment_status: "PICKED UP", etd: `${etd} 18:00:00` });

    const row = await prisma.shipment.findUniqueOrThrow({ where: { id: p.id }, select: { estimatedDelivery: true } });
    expect(row.estimatedDelivery?.toISOString().slice(0, 10)).toBe(etd);
    const events = await prisma.parcelEvent.findMany({ where: { shipmentId: p.id, kind: EK.ETA_CHANGED } });
    expect(events).toHaveLength(1);
    expect(events[0].actor).toBe(A.COURIER);
    const mails = await noticesOf(p.id, K.ETA_CHANGED_BUYER);
    expect(mails).toHaveLength(1);
    expect(mails[0].data).toMatchObject({ estimatedDelivery: etd });

    // ux.md "ETA changed": the buyer's new date, the admin's old → new, and nothing for the shop.
    const { parcelTimelines } = await import("@server/checkout/parcel-timeline");
    const { TIMELINE_READER, timelineLine } = await import("@/components/order/timeline/timeline-copy");
    const booked = await prisma.shipment.findUniqueOrThrow({ where: { id: p.id }, select: { courierName: true, trackingNumber: true } });
    const timeline = (await parcelTimelines([{ id: p.id, ...booked }]))[p.id];
    const eta = timeline.entries.find((e) => e.kind === EK.ETA_CHANGED)!;
    const bookedEta = timeline.entries.find((e) => e.status === S.PICKUP_BOOKED)!.estimatedDelivery;
    expect(timelineLine(TIMELINE_READER.BUYER, eta, timeline)).toBe(`New delivery date: ${eta.estimatedDelivery}`);
    expect(timelineLine(TIMELINE_READER.ADMIN, eta, timeline)).toBe(`ETA ${bookedEta} → ${eta.estimatedDelivery}`);
    expect(timelineLine(TIMELINE_READER.SHOP, eta, timeline)).toBeNull();

    // The same day again, or an unreadable one, changes nothing and emails no one.
    await send({ awb, shipment_status: "IN TRANSIT", etd: "not a date" });
    expect(await noticesOf(p.id, K.ETA_CHANGED_BUYER)).toHaveLength(1);
    expect(await statusOf(p.id)).toBe(S.IN_TRANSIT);
  });
});
