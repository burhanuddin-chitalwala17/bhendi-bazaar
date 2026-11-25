import { z } from "zod";

/** What a module can tell a shop (notifications-core Q2). A module names the kind; the hub picks the channel (R1). */
export const NOTIFICATION_KIND = {
  CONVERSATION_WAITING: "conversation-waiting",
  POST_FAILED: "post-failed",
  CONNECTION_NEEDS_YOU: "connection-needs-you",
  POST_HELD: "post-held",
  POST_DUE: "post-due",
} as const;
export type NotificationKind = (typeof NOTIFICATION_KIND)[keyof typeof NOTIFICATION_KIND];

export const NOTIFICATION_AUDIENCE = { SHOP_MEMBERS: "SHOP_MEMBERS", BUYER: "BUYER" } as const;
export type NotificationAudience = (typeof NOTIFICATION_AUDIENCE)[keyof typeof NOTIFICATION_AUDIENCE];

export const DELIVERY_CHANNEL = { EMAIL: "email", BADGE: "badge" } as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNEL)[keyof typeof DELIVERY_CHANNEL];

export const DELIVERY_TIMING = { AT_ONCE: "AT_ONCE", DIGEST: "DIGEST", BADGE: "BADGE" } as const;
export type DeliveryTiming = (typeof DELIVERY_TIMING)[keyof typeof DELIVERY_TIMING];

export const DELIVERY_STATE = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
  SUPERSEDED: "SUPERSEDED",
} as const;
export type DeliveryState = (typeof DELIVERY_STATE)[keyof typeof DELIVERY_STATE];

/** Ids and keys only: a value with a space or past 64 characters is a message body, which Q7 never stores. */
const factValue = z.string().regex(/^[A-Za-z0-9_:.-]{1,64}$/);
export const eventFacts = z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,31}$/), factValue);
export type EventFacts = z.infer<typeof eventFacts>;

/** What `notificationsService.emit` accepts (ADR-0069 D1). `recipientRef` is required for a BUYER event. */
export const emitInput = z
  .object({
    kind: z.enum(Object.values(NOTIFICATION_KIND) as [NotificationKind, ...NotificationKind[]]),
    orgId: z.string().min(1),
    audience: z.enum(Object.values(NOTIFICATION_AUDIENCE) as [NotificationAudience, ...NotificationAudience[]]),
    recipientRef: z.string().min(1).optional(),
    facts: eventFacts,
    /** Unique per real-world happening: the same key twice is one event (R2). */
    eventKey: z.string().min(1).max(200),
  })
  .refine((e) => (e.audience === NOTIFICATION_AUDIENCE.BUYER) === Boolean(e.recipientRef), {
    message: "a BUYER event names its recipient; a shop event is for every member and names none",
  });
export type EmitInput = z.input<typeof emitInput>;

/** One open badge item, newest first, for the Needs you sheet. */
export interface BadgeItem {
  deliveryId: string;
  eventKey: string;
  kind: NotificationKind;
  facts: EventFacts;
  at: Date;
}

/** A kind's answer to "does this still need the shop?", one batched call per kind (D3). */
export type StillOpen = (facts: EventFacts[]) => Promise<boolean[]>;
