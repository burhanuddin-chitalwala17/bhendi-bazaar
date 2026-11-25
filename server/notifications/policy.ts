import {
  DELIVERY_CHANNEL,
  DELIVERY_TIMING,
  NOTIFICATION_KIND,
  type DeliveryChannel,
  type DeliveryTiming,
  type HubKind,
  type NotificationKind,
  isParcelKind,
} from "./notification.types";

export interface DeliveryStep {
  channel: DeliveryChannel;
  timing: DeliveryTiming;
}

const badge: DeliveryStep = { channel: DELIVERY_CHANNEL.BADGE, timing: DELIVERY_TIMING.BADGE };
const atOnce: DeliveryStep = { channel: DELIVERY_CHANNEL.EMAIL, timing: DELIVERY_TIMING.AT_ONCE };
const digest: DeliveryStep = { channel: DELIVERY_CHANNEL.EMAIL, timing: DELIVERY_TIMING.DIGEST };

/** How each kind reaches a member (notifications-core D2, Q2): only a Status due cannot wait for the morning (R5). */
export const DELIVERY_POLICY: Record<NotificationKind, readonly DeliveryStep[]> = {
  [NOTIFICATION_KIND.POST_DUE]: [badge, atOnce],
  [NOTIFICATION_KIND.CONVERSATION_WAITING]: [badge, digest],
  [NOTIFICATION_KIND.POST_FAILED]: [badge, digest],
  [NOTIFICATION_KIND.CONNECTION_NEEDS_YOU]: [badge, digest],
  [NOTIFICATION_KIND.POST_HELD]: [badge, digest],
};

/** A parcel notice is one email at once to the one address it names, as before the hub (D6). */
const PARCEL_NOTICE: readonly DeliveryStep[] = [atOnce];

export const policyFor = (kind: HubKind): readonly DeliveryStep[] => (isParcelKind(kind) ? PARCEL_NOTICE : DELIVERY_POLICY[kind]);
