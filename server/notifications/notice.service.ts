import type { Prisma } from "@prisma/client";
import { adminOrgService } from "@server/catalog/org.service";
import { notificationsService } from "@server/notifications/notifications.service";
import { notificationRepository } from "@server/notifications/notification.repository";
import { NOTIFICATION_AUDIENCE, type NotificationAudience } from "@server/notifications/notification.types";
import {
  NOTICE_AUDIENCE,
  NOTICE_AUDIENCE_OF,
  type NoticeAudience,
  type NoticeKind,
  type ParcelNoticeData,
  type ParcelNoticeInput,
} from "@server/notifications/notice.types";
import { SUPPORT_INBOX } from "@server/notifications/templates/layout";

/** Where the admin's fulfilment emails go: the staff inbox, as Contact us messages do. */
export const ADMIN_NOTICE_INBOX = SUPPORT_INBOX;

const HUB_AUDIENCE: Record<NoticeAudience, NotificationAudience> = {
  [NOTICE_AUDIENCE.SHOP]: NOTIFICATION_AUDIENCE.SHOP_INBOX,
  [NOTICE_AUDIENCE.ADMIN]: NOTIFICATION_AUDIENCE.STAFF_INBOX,
  [NOTICE_AUDIENCE.BUYER]: NOTIFICATION_AUDIENCE.BUYER,
};

/** One notice per (parcel, kind, audience, ref), as `Notice`'s unique key was; the migration backfilled the same keys. */
export const parcelNoticeKey = (shipmentId: string, kind: NoticeKind, audience: NoticeAudience, ref: string) =>
  `notice:${shipmentId}:${kind}:${audience}:${ref}`;

/**
 * Parcel emails (order-fulfilment D8), now events on the notifications hub (notifications-core D6): written in
 * the transaction that earned them, sent by the worker. A send failure never fails the move; a repeated move
 * or sweep writes no second event.
 */
class NoticeService {
  /** Emit the notice on `tx`; only a new one is sent. Answers whether it was new. */
  async write(input: ParcelNoticeInput, tx: Prisma.TransactionClient): Promise<boolean> {
    const audience = NOTICE_AUDIENCE_OF[input.kind];
    const org = await adminOrgService.findEmailContact(input.orgId);
    const recipient =
      audience === NOTICE_AUDIENCE.ADMIN ? ADMIN_NOTICE_INBOX : audience === NOTICE_AUDIENCE.BUYER ? input.buyerEmail : org?.email;
    if (!recipient) {
      console.error(`[notice] no address for ${input.kind} on parcel ${input.parcelCode}; not written`);
      return false;
    }
    const data: ParcelNoticeData = {
      orderId: input.orderId,
      orderCode: input.orderCode,
      parcelCode: input.parcelCode,
      orgId: input.orgId,
      shopName: org?.name ?? "",
      city: input.city,
      since: input.since.toISOString(),
      at: new Date().toISOString(),
      ...Object.fromEntries(Object.entries(input.booking ?? {}).filter(([, v]) => v)),
      ...(input.cancel ?? {}),
      ...(input.refund ?? {}),
    };
    const written = await notificationsService.emit(tx, {
      kind: input.kind,
      orgId: input.orgId,
      audience: HUB_AUDIENCE[audience],
      recipientRef: recipient,
      facts: data,
      eventKey: parcelNoticeKey(input.shipmentId, input.kind, audience, input.ref ?? ""),
      shipmentId: input.shipmentId,
    });
    return written > 0;
  }

  /** Which notices each parcel has had, and when — the admin's "Shop emailed at 12 h and 24 h". */
  async historyFor(shipmentIds: string[]): Promise<Map<string, { kind: NoticeKind; createdAt: Date }[]>> {
    const out = new Map<string, { kind: NoticeKind; createdAt: Date }[]>();
    for (const row of await notificationRepository.listParcelKinds(shipmentIds)) {
      if (!row.shipmentId) continue;
      out.set(row.shipmentId, [...(out.get(row.shipmentId) ?? []), { kind: row.kind as NoticeKind, createdAt: row.createdAt }]);
    }
    return out;
  }
}

export const noticeService = new NoticeService();
