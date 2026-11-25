import { z } from "zod";
import { NOTICE_KIND, parcelNoticeData, type NoticeKind } from "./notice.types";

/** What a module can tell a shop (notifications-core Q2). A module names the kind; the hub picks the channel (R1). */
export const NOTIFICATION_KIND = {
  CONVERSATION_WAITING: "conversation-waiting",
  POST_FAILED: "post-failed",
  CONNECTION_NEEDS_YOU: "connection-needs-you",
  POST_HELD: "post-held",
  POST_DUE: "post-due",
} as const;
export type NotificationKind = (typeof NOTIFICATION_KIND)[keyof typeof NOTIFICATION_KIND];

/**
 * Who hears an event. Every member of the shop is resolved by the hub; any other audience names its one
 * recipient, as a parcel notice does: the shop's own inbox, the staff inbox, or the buyer's address (Q15).
 */
export const NOTIFICATION_AUDIENCE = {
  SHOP_MEMBERS: "SHOP_MEMBERS",
  BUYER: "BUYER",
  SHOP_INBOX: "SHOP_INBOX",
  STAFF_INBOX: "STAFF_INBOX",
} as const;
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

/** Every kind the hub carries: the shop's alerts, and the parcel notices moved onto it (D6). */
export type HubKind = NotificationKind | NoticeKind;
const HUB_KINDS = [...Object.values(NOTIFICATION_KIND), ...Object.values(NOTICE_KIND)] as [HubKind, ...HubKind[]];

export const isParcelKind = (kind: string): kind is NoticeKind => (Object.values(NOTICE_KIND) as string[]).includes(kind);

/** What an event carries, by kind: ids for the hub's own kinds; a parcel notice's snapshot as `Notice` held it (Q15). */
export const factsOf = (kind: string) => (isParcelKind(kind) ? parcelNoticeData : eventFacts);

const ALERT_AUDIENCES: readonly NotificationAudience[] = [NOTIFICATION_AUDIENCE.SHOP_MEMBERS, NOTIFICATION_AUDIENCE.BUYER];

/** What `notificationsService.emit` accepts (ADR-0069 D1). Only a SHOP_MEMBERS event leaves its recipient to the hub. */
export const emitInput = z
  .object({
    kind: z.enum(HUB_KINDS),
    orgId: z.string().min(1),
    audience: z.enum(Object.values(NOTIFICATION_AUDIENCE) as [NotificationAudience, ...NotificationAudience[]]),
    recipientRef: z.string().min(1).optional(),
    facts: z.record(z.string(), z.unknown()),
    /** Unique per real-world happening: the same key twice is one event (R2). */
    eventKey: z.string().min(1).max(200),
    /** The parcel a parcel notice is about (D6). */
    shipmentId: z.string().min(1).optional(),
  })
  .refine((e) => (e.audience !== NOTIFICATION_AUDIENCE.SHOP_MEMBERS) === Boolean(e.recipientRef), {
    message: "an event for one recipient names it; a shop event is for every member and names none",
  })
  // A parcel notice's recipient is an address, a shop alert's a user: each kind keeps to the audiences that fit (Q15).
  .refine((e) => (isParcelKind(e.kind) ? e.audience !== NOTIFICATION_AUDIENCE.SHOP_MEMBERS : ALERT_AUDIENCES.includes(e.audience)), {
    message: "this audience does not fit this kind",
  })
  .transform((e, ctx) => {
    const facts = factsOf(e.kind).safeParse(e.facts);
    if (facts.success) return { ...e, facts: facts.data };
    ctx.addIssue({ code: "custom", path: ["facts"], message: `facts do not fit ${e.kind}` });
    return z.NEVER;
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

/** One row of the Needs you sheet (ux.md): a single item, or a kind grouped with its count once it piles up. */
export interface NeedsYouRow {
  key: string;
  kind: NotificationKind;
  title: string;
  /** Our own screen that fixes it; never a dead link (ux: Stale). */
  href: string;
  /** ISO time of the newest item in the row. */
  at: string;
  count: number;
}

/** The bell's answer: the rows, and the count the badge now shows. */
export interface NeedsYouDTO {
  rows: NeedsYouRow[];
  count: number;
}

/** A member's switches for one shop (D4). */
export interface NotificationPrefsDTO {
  morningEmail: boolean;
}
