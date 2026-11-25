/**
 * The admin books a ready parcel by hand, re-dates it, and marks it picked up; the shop reaches
 * its label only through us (order-fulfilment (`431ed6e7:docs/specs/own-store/order-fulfilment/trd.md`)
 * U3: D11, D5, D7; spec R5–R7, A3). Owns its fixtures: a migrated schema and nothing in it.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parcelNotices } from "../helpers/parcel-notices";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { JOBS_QUEUE, JOBS_SCHEMA } from "@server/shared/jobs/jobs.config";

vi.mock("next-auth", () => ({ getServerSession: async () => null }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));
vi.mock("@/lib/admin-auth", () => ({
  requirePlatformAdmin: async () => ({ user: { id: "admin-test", name: "Zainab" } }),
  requirePlatformAdminId: async () => "admin-test",
}));

const PREFIX = "parcel-booking-";
const LABEL = "https://kr-shipmultichannel-mum.s3.ap-south-1.amazonaws.com/label.pdf";

/** "YYYY-MM-DD", `days` from today in India. */
const indiaDayFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

describe.skipIf(!isDisposableDb)("the admin books, re-dates and collects a parcel", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let F: typeof import("@server/checkout/fulfilment.service");
  let B: typeof import("@server/checkout/fulfilment-booking");
  let parcelTimelines: typeof import("@server/checkout/parcel-timeline").parcelTimelines;
  let listPickupQueue: typeof import("@server/checkout/pickup-queue").listPickupQueue;
  let pickupQueueCount: typeof import("@server/checkout/pickup-queue").pickupQueueCount;
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
    F = await import("@server/checkout/fulfilment.service");
    B = await import("@server/checkout/fulfilment-booking");
    ({ parcelTimelines } = await import("@server/checkout/parcel-timeline"));
    ({ listPickupQueue, pickupQueueCount } = await import("@server/checkout/pickup-queue"));
    ({ SHIPMENT_STATUS: S, PARCEL_ACTOR: A } = await import("@server/shipping/domain/shipping.types"));
    ({ NOTICE_KIND: K } = await import("@server/notifications/notice.types"));
    ({ ORDER_STATUS, PAYMENT_STATUS } = await import("@server/checkout/order.types"));
    ({ orgId, otherOrgId } = await ensureFixtures());
  });

  afterAll(async () => {
    if (!madeOrderIds.length) return;
    const ids = await prisma.delivery.findMany({ where: { event: { shipment: { orderId: { in: madeOrderIds } } } }, select: { id: true } });
    if (ids.length) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'deliveryId' = ANY($2)`,
        JOBS_QUEUE,
        ids.map((n) => n.id),
      );
    }
    const inOrders = { orderId: { in: madeOrderIds } };
    await prisma.notificationEvent.deleteMany({ where: { shipment: inOrders } });
    await prisma.parcelEvent.deleteMany({ where: { shipment: inOrders } });
    await prisma.shipment.deleteMany({ where: inOrders });
    await prisma.order.deleteMany({ where: { id: { in: madeOrderIds } } });
  });

  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  /** A paid order with one parcel of `org`, marked ready by its shop. */
  async function aReadyParcel(org = orgId) {
    const code = unique();
    const order = await prisma.order.create({
      data: {
        code: `BB-${code.slice(-8).toUpperCase()}`,
        address: { fullName: "Asha Buyer", email: "asha@example.test", mobile: "+919812345678", city: "Pune", pincode: "411001" },
        grandTotal: 0,
        paymentStatus: PAYMENT_STATUS.PAID,
        status: ORDER_STATUS.CONFIRMED,
        paidAt: new Date(),
      },
      select: { id: true },
    });
    madeOrderIds.push(order.id);
    const s = await prisma.shipment.create({
      data: { code: `${code}-SH1`, orderId: order.id, orgId: org, fromPincode: "400001", fromCity: "Mumbai", fromState: "Maharashtra", shippingCost: 0 },
      select: { id: true },
    });
    await F.markParcelReady(s.id, org);
    return { orderId: order.id, id: s.id, code: `${code}-SH1` };
  }

  const booking = (awb = `AWB${unique()}`) => ({
    pickupDate: indiaDayFromNow(1),
    estimatedDelivery: indiaDayFromNow(5),
    courierName: "Delhivery",
    trackingNumber: awb,
    trackingUrl: "https://www.delhivery.com/track/package/" + awb,
    labelUrl: LABEL,
  });
  const admin = { name: "Zainab" };
  const noticesOf = (id: string, kind?: string) => parcelNotices(id, kind);
  const statusOf = async (id: string) => (await prisma.shipment.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;

  it("A3, R6: booking puts the dates on the parcel and its timeline, and emails buyer and shop once", async () => {
    const p = await aReadyParcel();
    const input = booking();
    await B.bookPickup(p.id, input, admin);

    const row = await prisma.shipment.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.status).toBe(S.PICKUP_BOOKED);
    expect(row.pickupDate?.toISOString().slice(0, 10)).toBe(input.pickupDate);
    expect(row.estimatedDelivery?.toISOString().slice(0, 10)).toBe(input.estimatedDelivery);
    expect(row.labelUrl).toBe(LABEL);

    const timeline = (await parcelTimelines([{ id: p.id, courierName: row.courierName, trackingNumber: row.trackingNumber }]))[p.id];
    const bookedRow = timeline.entries.find((e) => e.status === S.PICKUP_BOOKED);
    expect(bookedRow?.pickupDate).toMatch(/^\w{3} \d{1,2} \w{3}$/);
    expect(bookedRow?.estimatedDelivery).toMatch(/^\w{3} \d{1,2} \w{3}$/);

    const buyer = await noticesOf(p.id, K.BOOKED_BUYER);
    const shop = await noticesOf(p.id, K.BOOKED_SHOP);
    expect(buyer).toHaveLength(1);
    expect(buyer[0].recipient).toBe("asha@example.test");
    expect(buyer[0].data).toMatchObject({ pickupDate: input.pickupDate, estimatedDelivery: input.estimatedDelivery, trackingUrl: input.trackingUrl });
    expect(shop).toHaveLength(1);
    // The shop's email links to the parcel page; the raw label link is never in it (Q26).
    expect(JSON.stringify(shop[0].data)).not.toContain(LABEL);
  });

  it("D11: a parcel the shop has not marked ready is refused, and so is a second booking, by name", async () => {
    const p = await aReadyParcel();
    await B.bookPickup(p.id, booking(), admin);
    await expect(B.bookPickup(p.id, booking(), { name: "Imran" })).rejects.toThrow(/^Already booked by Zainab at \d{1,2}:\d{2} [ap]m\.$/);

    const order = await prisma.order.create({
      data: { code: `BB-${unique().slice(-8).toUpperCase()}`, address: {}, paymentStatus: PAYMENT_STATUS.PAID, status: ORDER_STATUS.CONFIRMED },
      select: { id: true },
    });
    madeOrderIds.push(order.id);
    const packing = await prisma.shipment.create({
      data: { code: `${unique()}-SH1`, orderId: order.id, orgId, fromPincode: "400001", fromCity: "Mumbai", fromState: "MH", shippingCost: 0 },
      select: { id: true },
    });
    await expect(B.bookPickup(packing.id, booking(), admin)).rejects.toThrow("The shop hasn't marked this parcel ready yet.");
    expect(await statusOf(packing.id)).toBe(S.PACKING);
  });

  it("D11: an AWB already on another parcel is refused with that parcel's code; the index holds the line too", async () => {
    const first = await aReadyParcel();
    const second = await aReadyParcel();
    const awb = `AWB${unique()}`;
    await B.bookPickup(first.id, booking(awb), admin);

    await expect(B.bookPickup(second.id, booking(awb), admin)).rejects.toMatchObject({
      status: 409,
      field: "trackingNumber",
      message: `This AWB is already on ${first.code}.`,
    });
    expect(await statusOf(second.id)).toBe(S.READY_FOR_PICKUP);
    await expect(prisma.shipment.update({ where: { id: second.id }, data: { trackingNumber: awb } })).rejects.toMatchObject({ code: "P2002" });
  });

  it("D11: two admins booking one AWB onto two parcels at once — one wins, the other is told which parcel has it", async () => {
    const [a, b] = [await aReadyParcel(), await aReadyParcel()];
    const awb = `AWB${unique()}`;
    const results = await Promise.allSettled([B.bookPickup(a.id, booking(awb), admin), B.bookPickup(b.id, booking(awb), admin)]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    const winner = results[0].status === "fulfilled" ? a : b;
    expect(lost?.reason).toMatchObject({ status: 409, field: "trackingNumber", message: `This AWB is already on ${winner.code}.` });
  });

  it("ux Refused: a parcel the buyer cancelled meanwhile says so, and to cancel it on Shiprocket", async () => {
    const order = await prisma.order.create({
      data: { code: `BB-${unique().slice(-8).toUpperCase()}`, address: {}, paymentStatus: PAYMENT_STATUS.PAID, status: ORDER_STATUS.CONFIRMED },
      select: { id: true },
    });
    madeOrderIds.push(order.id);
    const p = await prisma.shipment.create({
      data: { code: `${unique()}-SH1`, orderId: order.id, orgId, fromPincode: "400001", fromCity: "Mumbai", fromState: "MH", shippingCost: 0 },
      select: { id: true },
    });
    await F.moveParcel(p.id, S.CANCELLED, { actor: A.BUYER, refuse: true });
    await expect(B.bookPickup(p.id, booking(), admin)).rejects.toThrow("The buyer cancelled this parcel. Cancel it on Shiprocket too.");
  });

  it("D11: a date change is compare-and-set on the date seen; each change emails shop and buyer once", async () => {
    const p = await aReadyParcel();
    const input = booking();
    await B.bookPickup(p.id, input, admin);

    const next = { pickupDate: indiaDayFromNow(2), estimatedDelivery: indiaDayFromNow(6), seenPickupDate: input.pickupDate };
    await B.changePickupDates(p.id, next, { name: "Imran" });
    // The first panel, still showing the first date, is refused rather than overwriting Imran's change.
    await expect(
      B.changePickupDates(p.id, { ...next, pickupDate: indiaDayFromNow(3), seenPickupDate: input.pickupDate }, admin),
    ).rejects.toThrow(/^Changed to \w{3} \d{1,2} \w{3} by Imran at \d{1,2}:\d{2} [ap]m\.$/);
    expect((await prisma.shipment.findUniqueOrThrow({ where: { id: p.id } })).pickupDate?.toISOString().slice(0, 10)).toBe(next.pickupDate);

    await B.changePickupDates(p.id, { pickupDate: indiaDayFromNow(4), estimatedDelivery: indiaDayFromNow(7), seenPickupDate: next.pickupDate }, admin);
    expect(await noticesOf(p.id, K.PICKUP_MOVED_SHOP)).toHaveLength(2);
    expect(await noticesOf(p.id, K.PICKUP_MOVED_BUYER)).toHaveLength(2);
    expect(await prisma.parcelEvent.count({ where: { shipmentId: p.id, kind: "pickup_moved" } })).toBe(2);
  });

  it("D11: saving the dates as booked writes and emails nothing; a pickup-only move emails the shop, not the buyer", async () => {
    const p = await aReadyParcel();
    const input = booking();
    await B.bookPickup(p.id, input, admin);

    await B.changePickupDates(p.id, { pickupDate: input.pickupDate, estimatedDelivery: input.estimatedDelivery, seenPickupDate: input.pickupDate }, admin);
    expect(await prisma.parcelEvent.count({ where: { shipmentId: p.id, kind: "pickup_moved" } })).toBe(0);
    expect(await noticesOf(p.id, K.PICKUP_MOVED_SHOP)).toHaveLength(0);

    await B.changePickupDates(p.id, { pickupDate: indiaDayFromNow(2), estimatedDelivery: input.estimatedDelivery, seenPickupDate: input.pickupDate }, admin);
    expect(await noticesOf(p.id, K.PICKUP_MOVED_SHOP)).toHaveLength(1);
    expect(await noticesOf(p.id, K.PICKUP_MOVED_BUYER)).toHaveLength(0);
  });

  it("Q4: Mark picked up moves the parcel and emails the shop; the date can no longer change", async () => {
    const p = await aReadyParcel();
    const input = booking();
    await B.bookPickup(p.id, input, admin);
    await B.markPickedUp(p.id, admin);

    expect(await statusOf(p.id)).toBe(S.PICKED_UP);
    expect(await noticesOf(p.id, K.PICKED_UP)).toHaveLength(1);
    await expect(B.markPickedUp(p.id, admin)).rejects.toThrow("The courier already picked this up.");
    await expect(
      B.changePickupDates(p.id, { pickupDate: indiaDayFromNow(2), estimatedDelivery: indiaDayFromNow(6), seenPickupDate: input.pickupDate }, admin),
    ).rejects.toThrow("The courier already picked this up.");
  });

  it("D7, Q26: the label is the parcel's own shop's, only while the pickup is booked", async () => {
    const p = await aReadyParcel();
    await expect(B.labelLinkFor(p.id, orgId)).rejects.toMatchObject({ status: 404 });
    await B.bookPickup(p.id, booking(), admin);

    await expect(B.labelLinkFor(p.id, otherOrgId)).rejects.toMatchObject({ status: 404 });
    expect((await B.labelLinkFor(p.id, orgId)).link).toBe(LABEL);
    await B.markPickedUp(p.id, admin);
    await expect(B.labelLinkFor(p.id, orgId)).rejects.toMatchObject({ status: 404 });
  });

  it("R5: the queue lists ready parcels oldest first, then booked ones with their day", async () => {
    const p = await aReadyParcel();
    expect((await listPickupQueue("ready")).map((r) => r.shipmentId)).toContain(p.id);
    await B.bookPickup(p.id, booking(), admin);
    const row = (await listPickupQueue("booked")).find((r) => r.shipmentId === p.id);
    expect(row?.pickupDay).toMatch(/^\w{3} \d{1,2} \w{3}$/);
    expect(row?.daysOverdue).toBe(0);
  });

  it("ux Many items: the queue pages by 50 and narrows to one shop or city, and its count agrees", async () => {
    const p = await aReadyParcel(otherOrgId);
    const mine = await listPickupQueue("ready", { orgId: otherOrgId });
    expect(mine.map((r) => r.shipmentId)).toContain(p.id);
    expect(mine.every((r) => r.orgId === otherOrgId)).toBe(true);
    expect(await pickupQueueCount("ready", { orgId: otherOrgId })).toBe(mine.length);
    expect(await listPickupQueue("ready", { orgId: otherOrgId, city: "Nowhere" })).toEqual([]);
    expect(await listPickupQueue("ready", { orgId: otherOrgId, page: 2 })).toEqual(mine.slice(50));
  });

  it("the booking route parses its body: a delivery day before pickup is a field error, and nothing moves", async () => {
    const { POST } = await import("@/app/api/admin/shipments/[id]/booking/route");
    const p = await aReadyParcel();
    const bad = { ...booking(), estimatedDelivery: indiaDayFromNow(0), pickupDate: indiaDayFromNow(1) };
    const response = await POST(
      new NextRequest(`http://localhost/api/admin/shipments/${p.id}/booking`, { method: "POST", body: JSON.stringify(bad) }),
      { params: Promise.resolve({ id: p.id }) },
    );
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain("Delivery date must be after the pickup date.");
    expect(await statusOf(p.id)).toBe(S.READY_FOR_PICKUP);

    const ok = await POST(
      new NextRequest(`http://localhost/api/admin/shipments/${p.id}/booking`, { method: "POST", body: JSON.stringify(booking()) }),
      { params: Promise.resolve({ id: p.id }) },
    );
    expect(ok.status).toBe(200);
    const row = await prisma.parcelEvent.findFirstOrThrow({ where: { shipmentId: p.id, toStatus: S.PICKUP_BOOKED } });
    expect(row.actorName).toBe("Zainab");
  });
});
