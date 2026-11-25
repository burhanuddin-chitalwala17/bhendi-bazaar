/**
 * Parcel notices moved onto the hub (notification-hub/notifications-core unit 2, D6; spec R8, A5): every
 * kind is written by the move that earned it, sent once by its job, and reaches its reader word for word
 * as before. The snapshot was recorded on the pre-hub pipeline and is the proof the move changed nothing.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const RUN = Date.now();
const NOW = new Date("2026-11-20T06:30:00.000Z");
const BUYER = "snap-buyer@example.invalid";

describe.skipIf(!isDisposableDb)("parcel notices through the hub (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let noticeService: typeof import("@server/notifications/notice.service").noticeService;
  let emailService: typeof import("@server/notifications/email.service").emailService;
  let resolveJob: typeof import("@server/shared/jobs/jobs.registry").resolveJob;
  let JOBS: typeof import("@server/shared/jobs/jobs.config");
  let K: typeof import("@server/notifications/notice.types").NOTICE_KIND;
  let orgId = "";
  let orderId = "";
  let shipmentId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ noticeService } = await import("@server/notifications/notice.service"));
    ({ emailService } = await import("@server/notifications/email.service"));
    ({ resolveJob } = await import("@server/shared/jobs/jobs.registry"));
    await import("@server/notifications/notifications.jobs");
    JOBS = await import("@server/shared/jobs/jobs.config");
    ({ NOTICE_KIND: K } = await import("@server/notifications/notice.types"));
    ({ orgId } = await ensureFixtures());
    orderId = (await prisma.order.create({
      data: {
        code: `BB-SNAP-${RUN}`,
        address: { fullName: "Asha Buyer", mobile: "+919812345678", addressLine1: "12 Secret Lane", city: "Pune", state: "MH", pincode: "411001", country: "India" },
        grandTotal: 0, paymentStatus: "paid", status: "confirmed", paidAt: NOW,
      },
      select: { id: true },
    })).id;
    shipmentId = (await prisma.shipment.create({
      data: { code: `BB-SNAP-${RUN}-SH1`, orderId, orgId, fromPincode: "400001", fromCity: "Mumbai", fromState: "Maharashtra", shippingCost: 0 },
      select: { id: true },
    })).id;
  });

  afterAll(async () => {
    vi.useRealTimers();
    if (!orderId) return;
    const ids = await sendIds();
    await prisma.$executeRawUnsafe(
      `DELETE FROM ${JOBS.JOBS_SCHEMA}.job WHERE name = $1 AND (data->'payload'->>'noticeId' = ANY($2) OR data->'payload'->>'deliveryId' = ANY($2))`,
      JOBS.JOBS_QUEUE,
      ids,
    );
    await prisma.shipment.deleteMany({ where: { orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
  });

  /** The rows a send job names for this parcel. */
  const sendIds = async () =>
    (await prisma.notice.findMany({ where: { shipmentId }, select: { id: true } })).map((n) => n.id);

  /** Run every send job queued for `ids` as the worker would, twice: a redelivered job emails no one twice. */
  async function drain(ids: string[]) {
    const rows = await prisma.$queryRawUnsafe<{ id: string; data: unknown }[]>(
      `SELECT id::text, data FROM ${JOBS.JOBS_SCHEMA}.job WHERE name = $1 AND (data->'payload'->>'noticeId' = ANY($2) OR data->'payload'->>'deliveryId' = ANY($2))`,
      JOBS.JOBS_QUEUE,
      ids,
    );
    for (const row of [...rows, ...rows]) {
      const { definition, payload } = resolveJob(row.data);
      await definition.handler({ jobId: row.id, payload });
    }
    return rows.length;
  }

  it("A5, D6: every parcel notice reaches its reader word for word as before the hub, once", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    const sent = vi.spyOn(emailService, "sendNotice").mockResolvedValue(undefined);
    const since = new Date(NOW.getTime() - 3 * 86_400_000);
    const mails: Record<string, unknown> = {};
    for (const kind of Object.values(K)) {
      const before = await sendIds();
      const input = {
        shipmentId, kind, orderId: "order-snap", orderCode: "BB-SNAP01", parcelCode: "BB-SNAP01-SH1", orgId,
        city: "Mumbai", since, buyerEmail: BUYER, ref: kind.startsWith("pickup_moved") || kind.startsWith("eta") ? "evt-snap" : undefined,
        booking: { courierName: "Delhivery", trackingNumber: "AWB123", trackingUrl: "https://track.example/AWB123", pickupDate: "2026-11-21", estimatedDelivery: "2026-11-25" },
        cancel: kind.startsWith("cancelled") ? { cancelledBy: "shop", refundPaise: 129900, feePaise: 5000 } : undefined,
        refund: kind === K.REFUND_STARTED_BUYER ? { refundPaise: 129900 } : undefined,
      };
      expect(await prisma.$transaction((tx) => noticeService.write(input, tx))).toBe(true);
      expect(await prisma.$transaction((tx) => noticeService.write(input, tx))).toBe(false);
      const fresh = (await sendIds()).filter((id) => !before.includes(id));
      sent.mockClear();
      expect(await drain(fresh)).toBe(1);
      expect(sent).toHaveBeenCalledTimes(1);
      const [mail] = sent.mock.calls[0];
      expect(mail.idempotencyKey).toBe(`notice-${fresh[0]}`);
      mails[kind] = { to: mail.to, subject: mail.subject, html: mail.html };
    }
    sent.mockRestore();
    vi.useRealTimers();
    // The fixture shop's address and our origin vary by machine; everything the reader sees is pinned.
    const { appUrl } = await import("@server/shared/app-url");
    const shop = await prisma.org.findUniqueOrThrow({ where: { id: orgId }, select: { email: true, name: true } });
    const pinned = JSON.stringify(mails, null, 2)
      .replaceAll(appUrl(), "<origin>")
      .replaceAll(orgId, "<org>")
      .replaceAll(shop.email ?? "<none>", "<shop email>")
      .replaceAll(shop.name, "<shop>");
    expect(pinned).toMatchSnapshot();
  });
});
