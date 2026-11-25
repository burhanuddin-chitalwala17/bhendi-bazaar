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
} from "./notification.types";
import { renderStatusDueEmail } from "./templates/statusDueEmail";

export interface DeliveryToSend {
  id: string;
  recipientId: string;
  event: { kind: NotificationKind; orgId: string; facts: EventFacts };
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
const AT_ONCE_EMAILS: Partial<Record<NotificationKind, (e: DeliveryToSend["event"]) => Rendered | null>> = {
  [NOTIFICATION_KIND.POST_DUE]: (e) =>
    e.facts.postId ? renderStatusDueEmail({ count: 1, url: `${appUrl()}${ROUTES.org.postStatus(e.orgId, e.facts.postId)}` }) : null,
};

const emailPlug: ChannelPlug = {
  key: DELIVERY_CHANNEL.EMAIL,
  async deliver(delivery) {
    const rendered = AT_ONCE_EMAILS[delivery.event.kind]?.(delivery.event);
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
