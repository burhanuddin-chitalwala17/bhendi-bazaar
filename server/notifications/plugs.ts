import { appUrl } from "@server/shared/app-url";
import { ROUTES } from "@server/shared/routes";
import { profileService } from "@server/identity/profile.service";
import {
  DELIVERY_CHANNEL,
  DELIVERY_STATE,
  NOTIFICATION_KIND,
  type DeliveryChannel,
  type EventFacts,
  type NotificationKind,
  isParcelKind,
} from "./notification.types";
import type { NoticeKind, ParcelNoticeData } from "./notice.types";
import { renderStatusDueEmail } from "./templates/statusDueEmail";
import { renderParcelNotice } from "./templates/parcelNoticeEmail";

/** A shop alert carries ids; a parcel notice carries its snapshot, as `Notice` did (Q15). */
export type DeliveryEvent =
  | { kind: NotificationKind; orgId: string; facts: EventFacts }
  | { kind: NoticeKind; orgId: string; facts: ParcelNoticeData };
type ParcelEvent = Extract<DeliveryEvent, { kind: NoticeKind }>;
type AlertEvent = Exclude<DeliveryEvent, ParcelEvent>;
const isParcelEvent = (e: DeliveryEvent): e is ParcelEvent => isParcelKind(e.kind);

export interface DeliveryToSend {
  id: string;
  /** A member's user id; for a parcel notice, the address it was written to (Q15). */
  recipientId: string;
  event: DeliveryEvent;
}

/** What a plug made of a delivery; null leaves the row as it is. A transient failure is thrown, so the job retries. */
export type PlugOutcome =
  | { state: typeof DELIVERY_STATE.SENT; providerId: string | null }
  | { state: typeof DELIVERY_STATE.SKIPPED; reason: string }
  | null;

/** One channel behind one port (ADR-0069 D2, notifications-core D5): a module never names one. */
export interface ChannelPlug {
  key: DeliveryChannel;
  deliver(delivery: DeliveryToSend): Promise<PlugOutcome>;
}

type Rendered = { subject: string; html: string };
const AT_ONCE_EMAILS: Partial<Record<NotificationKind, (e: AlertEvent) => Rendered | null>> = {
  [NOTIFICATION_KIND.POST_DUE]: (e) =>
    e.facts.postId ? renderStatusDueEmail({ count: 1, url: `${appUrl()}${ROUTES.org.postStatus(e.orgId, e.facts.postId)}` }) : null,
};

const emailPlug: ChannelPlug = {
  key: DELIVERY_CHANNEL.EMAIL,
  async deliver(delivery) {
    const { event } = delivery;
    if (isParcelEvent(event)) return sendParcelNotice(delivery.id, delivery.recipientId, event);
    const rendered = AT_ONCE_EMAILS[event.kind]?.(event);
    if (!rendered) return { state: DELIVERY_STATE.SKIPPED, reason: "no at-once email for this kind and facts" };
    // Read when sending, never stored: the delivery row holds no address (Q7).
    const to = await profileService.findLoginEmail(delivery.recipientId);
    if (!to) return { state: DELIVERY_STATE.SKIPPED, reason: "recipient has no email" };
    // Loaded on send, as notice.service does: email.service builds the Resend client and reaches identity at import.
    const { emailService } = await import("./email.service");
    const providerId = await emailService.sendDelivery({ to, ...rendered, idempotencyKey: `delivery-${delivery.id}` });
    return { state: DELIVERY_STATE.SENT, providerId };
  },
};

/** A parcel notice, worded and addressed as before the hub (D6); keyed `notice-` so a row moved from `Notice` keeps its key. */
async function sendParcelNotice(id: string, to: string, event: ParcelEvent): Promise<PlugOutcome> {
  const { subject, html } = renderParcelNotice(event.kind, event.facts);
  const { emailService } = await import("./email.service");
  await emailService.sendNotice({ to, subject, html, idempotencyKey: `notice-${id}` });
  return { state: DELIVERY_STATE.SENT, providerId: null };
}

/** The row is the badge: nothing is sent, and the sheet reads what is still PENDING (D3). */
const badgePlug: ChannelPlug = {
  key: DELIVERY_CHANNEL.BADGE,
  async deliver() {
    return null;
  },
};

export const CHANNEL_PLUGS: Record<DeliveryChannel, ChannelPlug> = {
  [DELIVERY_CHANNEL.EMAIL]: emailPlug,
  [DELIVERY_CHANNEL.BADGE]: badgePlug,
};
