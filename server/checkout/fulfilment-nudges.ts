import { prisma } from "@server/shared/prisma";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { indiaMoment } from "@server/shared/india-time";
import { PAYMENT_STATUS } from "@server/checkout/order.types";
import { countParcelsAwaitingPacking, parcelsAwaitingPacking, parcelsReadySince } from "@server/shipping/shipment-status.service";
import { noticeService } from "@server/notifications/notice.service";
import { NOTICE_KIND, type NoticeKind } from "@server/notifications/notice.types";

const HOUR_MS = 60 * 60 * 1000;
/** Q24: shop emails at 12 h and 24 h after payment, the admin's flag at 36 h; R4: admin again at 24 h ready. */
export const NUDGE_AFTER_HOURS = {
  [NOTICE_KIND.NOT_READY_12H]: 12,
  [NOTICE_KIND.NOT_READY_24H]: 24,
  [NOTICE_KIND.READY_24H]: 24,
} as const;
export const NOT_PACKED_FLAG_HOURS = 36;
/** One sweep's cap per kind; a backlog drains over the next hours rather than in one burst. */
const SWEEP_LIMIT = 200;

const hoursAgo = (now: Date, hours: number) => new Date(now.getTime() - hours * HOUR_MS);

/**
 * The hourly fulfilment sweep (order-fulfilment D18; R3a, R4, A11). Each notice is unique per
 * (parcel, kind, audience), so a second run, or a run overlapping a move, writes nothing new.
 * The 12 h nudge skips a parcel already past 24 h: one "a day ago" email beats two at once.
 */
export async function runFulfilmentSweep(now = new Date()): Promise<Record<NoticeKind, number>> {
  const written = { ready: 0, ready_24h: 0, not_ready_12h: 0, not_ready_24h: 0 } as Record<NoticeKind, number>;

  const shopNudges = [
    { kind: NOTICE_KIND.NOT_READY_24H, paidBefore: hoursAgo(now, 24), paidAfter: null },
    { kind: NOTICE_KIND.NOT_READY_12H, paidBefore: hoursAgo(now, 12), paidAfter: hoursAgo(now, 24) },
  ] as const;
  for (const { kind, paidBefore, paidAfter } of shopNudges) {
    const parcels = await parcelsAwaitingPacking({ paidStatus: PAYMENT_STATUS.PAID, paidBefore, paidAfter }, kind, SWEEP_LIMIT);
    for (const p of parcels) {
      const wrote = await prisma.$transaction((tx) =>
        noticeService.write(
          {
            shipmentId: p.id, kind, orderId: p.order.id, orderCode: p.order.code, parcelCode: p.code,
            orgId: p.orgId, city: p.fromCity, since: p.order.paidAt ?? now,
          },
          tx,
        ),
      );
      if (wrote) written[kind] += 1;
    }
  }

  const ready = await parcelsReadySince(hoursAgo(now, NUDGE_AFTER_HOURS.ready_24h), NOTICE_KIND.READY_24H, SWEEP_LIMIT);
  for (const p of ready) {
    const wrote = await prisma.$transaction((tx) =>
      noticeService.write(
        {
          shipmentId: p.id, kind: NOTICE_KIND.READY_24H, orderId: p.order.id, orderCode: p.order.code,
          parcelCode: p.code, orgId: p.orgId, city: p.fromCity, since: p.parcelEvents[0]?.createdAt ?? now,
        },
        tx,
      ),
    );
    if (wrote) written.ready_24h += 1;
  }
  return written;
}

/** A row on the admin's "Not packed" tab (ux.md "admin not-packed flag"). */
export interface NotPackedRow {
  shipmentId: string;
  parcelCode: string;
  orderId: string;
  orderCode: string;
  orgId: string;
  shopName: string;
  /** The shop's own contact — never the buyer's (Q22). */
  shopPhone: string | null;
  shopEmail: string;
  city: string;
  paidAt: string;
  hoursSincePaid: number;
  /** The nudges the shop has had, for "Shop emailed at 12 h and 24 h". */
  nudges: NoticeKind[];
  /** When the admin emailed the shop by hand, for "+ you emailed 1 h ago". */
  adminEmailedAt: string | null;
}

const notPackedWindow = (filter: { orgId?: string; shipmentId?: string }, now: Date) => ({
  paidStatus: PAYMENT_STATUS.PAID,
  paidBefore: hoursAgo(now, NOT_PACKED_FLAG_HOURS),
  paidAfter: null,
  ...filter,
});

/** The "Not packed · N" count: every flagged parcel, not just the page listed. */
export async function countNotPacked(filter: { orgId?: string } = {}, now = new Date()): Promise<number> {
  return await countParcelsAwaitingPacking(notPackedWindow(filter, now));
}

/**
 * Paid parcels not marked ready 36 h on (R3a, A11): a read-time query, never a stored flag, so a
 * parcel leaves the list the moment the shop marks it ready. Oldest first.
 */
export async function listNotPacked(
  filter: { orgId?: string; shipmentId?: string } = {},
  now = new Date(),
  limit = 100,
): Promise<NotPackedRow[]> {
  const parcels = await parcelsAwaitingPacking(notPackedWindow(filter, now), null, limit);
  const notices = await noticeService.historyFor(parcels.map((p) => p.id));
  return parcels.map((p) => {
    const paidAt = p.order.paidAt ?? now;
    const sent = notices.get(p.id) ?? [];
    const manual = sent.find((n) => n.kind === NOTICE_KIND.NOT_PACKED_ADMIN);
    return {
      shipmentId: p.id,
      parcelCode: p.code,
      orderId: p.order.id,
      orderCode: p.order.code,
      orgId: p.orgId,
      shopName: p.org.name,
      shopPhone: p.org.phone,
      shopEmail: p.org.email,
      city: p.fromCity,
      paidAt: paidAt.toISOString(),
      hoursSincePaid: Math.floor((now.getTime() - paidAt.getTime()) / HOUR_MS),
      nudges: sent.map((n) => n.kind).filter((k) => k === NOTICE_KIND.NOT_READY_12H || k === NOTICE_KIND.NOT_READY_24H),
      adminEmailedAt: manual ? manual.createdAt.toISOString() : null,
    };
  });
}

/** ux.md "Success: emailed". */
export const emailedShopMessage = (shop: string) => `Email sent to ${shop}.`;

/**
 * The admin's "Email shop" on a not-packed parcel. Only a paid parcel still `packing` 36 h on
 * qualifies; one that left the list is not-found. Once per parcel: a second press says when.
 */
export async function emailShopAboutParcel(shipmentId: string, now = new Date()): Promise<{ message: string }> {
  const [row] = await listNotPacked({ shipmentId }, now, 1);
  if (!row) throw new NotFoundError("This parcel is no longer waiting to be packed.");
  const wrote = await prisma.$transaction((tx) =>
    noticeService.write(
      {
        shipmentId: row.shipmentId, kind: NOTICE_KIND.NOT_PACKED_ADMIN, orderId: row.orderId, orderCode: row.orderCode,
        parcelCode: row.parcelCode, orgId: row.orgId, city: row.city, since: new Date(row.paidAt),
      },
      tx,
    ),
  );
  if (!wrote) {
    const at = row.adminEmailedAt ? indiaMoment(new Date(row.adminEmailedAt)) : "already";
    throw new ConflictError(`You emailed ${row.shopName} on ${at}. Call them on the number shown.`);
  }
  return { message: emailedShopMessage(row.shopName) };
}
