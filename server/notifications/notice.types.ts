import { z } from "zod";

/**
 * Every email a parcel can earn, declared once (order-fulfilment D8). A notice is unique per
 * (parcel, kind, audience), so a repeated move or a second sweep writes nothing and emails no one.
 */
export const NOTICE_KIND = {
  /** The shop marked the parcel ready: tell the admin to book it (R4). */
  READY: "ready",
  /** Ready for 24 h and still unbooked (R4, A2). */
  READY_24H: "ready_24h",
  /** Paid 12 h ago and not marked ready (R3a, Q24). */
  NOT_READY_12H: "not_ready_12h",
  /** Paid a day ago and not marked ready (R3a, Q24). */
  NOT_READY_24H: "not_ready_24h",
  /** The admin's "Email shop" on a parcel flagged not packed (ux.md admin not-packed flag); once per parcel. */
  NOT_PACKED_ADMIN: "not_packed_admin",
} as const;
export type NoticeKind = (typeof NOTICE_KIND)[keyof typeof NOTICE_KIND];

export const NOTICE_AUDIENCE = {
  SHOP: "shop",
  ADMIN: "admin",
} as const;
export type NoticeAudience = (typeof NOTICE_AUDIENCE)[keyof typeof NOTICE_AUDIENCE];

/** Which audience each kind is for: one answer, so a caller cannot send a shop nudge to the admin. */
export const NOTICE_AUDIENCE_OF: Record<NoticeKind, NoticeAudience> = {
  [NOTICE_KIND.READY]: NOTICE_AUDIENCE.ADMIN,
  [NOTICE_KIND.READY_24H]: NOTICE_AUDIENCE.ADMIN,
  [NOTICE_KIND.NOT_READY_12H]: NOTICE_AUDIENCE.SHOP,
  [NOTICE_KIND.NOT_READY_24H]: NOTICE_AUDIENCE.SHOP,
  [NOTICE_KIND.NOT_PACKED_ADMIN]: NOTICE_AUDIENCE.SHOP,
};

/**
 * What a parcel notice says, captured when it is written so the email reports the moment it was
 * earned. Parsed, never cast, before it is rendered: a JSON column is `unknown` (Invariant 4).
 * No buyer phone or address is ever part of it (spec A10).
 */
export const parcelNoticeData = z.object({
  orderId: z.string(),
  orderCode: z.string(),
  parcelCode: z.string(),
  orgId: z.string(),
  shopName: z.string(),
  city: z.string(),
  /** ISO time the clock started: paid (nudges) or marked ready (admin). */
  since: z.string(),
  /** ISO time the notice was written; "paid 3 days ago" is counted to it, not to when it is sent. */
  at: z.string().optional(),
});
export type ParcelNoticeData = z.infer<typeof parcelNoticeData>;

/** What a caller hands over; the shop's name and the recipient are resolved by notifications. */
export interface ParcelNoticeInput {
  shipmentId: string;
  kind: NoticeKind;
  orderId: string;
  orderCode: string;
  parcelCode: string;
  orgId: string;
  city: string;
  since: Date;
}
