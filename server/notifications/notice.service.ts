import type { Prisma } from "@prisma/client";
import { enqueue } from "@server/shared/jobs/jobs.enqueue";
import { adminOrgService } from "@server/catalog/org.service";
import { noticeRepository } from "@server/notifications/notice.repository";
import { noticeSendSpec } from "@server/notifications/notice.job";
import {
  NOTICE_AUDIENCE,
  NOTICE_AUDIENCE_OF,
  parcelNoticeData,
  type NoticeKind,
  type ParcelNoticeData,
  type ParcelNoticeInput,
} from "@server/notifications/notice.types";
import { renderParcelNotice } from "@server/notifications/templates/parcelNoticeEmail";
import { SUPPORT_INBOX } from "@server/notifications/templates/layout";

/** Where the admin's fulfilment emails go: the staff inbox, as Contact us messages do. */
export const ADMIN_NOTICE_INBOX = SUPPORT_INBOX;

/**
 * Parcel emails as rows (order-fulfilment D8): written in the transaction that earned them, sent
 * by the worker. A send failure never fails the move; a repeated move or sweep writes no second row.
 */
class NoticeService {
  /** Write the notice on `tx`; only a newly written one enqueues a send. Answers whether it was new. */
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
    const row = await noticeRepository.insertOnce(
      { shipmentId: input.shipmentId, kind: input.kind, audience, recipient, data, ref: input.ref ?? "" },
      tx,
    );
    if (!row) return false;
    await enqueue(tx, noticeSendSpec, { noticeId: row.id });
    return true;
  }

  /**
   * Send one notice. A notice already sent is skipped; the notice id is Resend's idempotency key,
   * so a crash between sending and recording cannot email twice within Resend's window.
   */
  async send(noticeId: string): Promise<void> {
    const notice = await noticeRepository.findById(noticeId);
    if (!notice || notice.sentAt) return;
    const data = parcelNoticeData.parse(notice.data);
    const { subject, html } = renderParcelNotice(notice.kind as NoticeKind, data);
    const { emailService } = await import("@server/notifications/email.service");
    await emailService.sendNotice({ to: notice.recipient, subject, html, idempotencyKey: `notice-${notice.id}` });
    await noticeRepository.markSent(notice.id);
  }

  /** Which notices each parcel has had, and when — the admin's "Shop emailed at 12 h and 24 h". */
  async historyFor(shipmentIds: string[]): Promise<Map<string, { kind: NoticeKind; createdAt: Date }[]>> {
    const out = new Map<string, { kind: NoticeKind; createdAt: Date }[]>();
    for (const row of await noticeRepository.listKindsFor(shipmentIds)) {
      out.set(row.shipmentId, [...(out.get(row.shipmentId) ?? []), { kind: row.kind as NoticeKind, createdAt: row.createdAt }]);
    }
    return out;
  }
}

export const noticeService = new NoticeService();
