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
  /** The admin booked the pickup: the buyer hears the dates and the tracking link (R6). */
  BOOKED_BUYER: "booked_buyer",
  /** The admin booked the pickup: the shop hears the date and where the label is (R6, Q26). */
  BOOKED_SHOP: "booked_shop",
  /** The pickup date moved; once per change, keyed by its timeline row (ux.md Emails). */
  PICKUP_MOVED_SHOP: "pickup_moved_shop",
  PICKUP_MOVED_BUYER: "pickup_moved_buyer",
  /** The courier has the parcel (own-store Q9). */
  PICKED_UP: "picked_up",
  /** The courier's estimate replaced ours; once per change, keyed by its timeline row (D10, Q6). */
  ETA_CHANGED_BUYER: "eta_changed_buyer",
  /** The courier delivered it (own-store Q9). */
  DELIVERED: "delivered",
} as const;
export type NoticeKind = (typeof NOTICE_KIND)[keyof typeof NOTICE_KIND];

export const NOTICE_AUDIENCE = {
  SHOP: "shop",
  ADMIN: "admin",
  BUYER: "buyer",
} as const;
export type NoticeAudience = (typeof NOTICE_AUDIENCE)[keyof typeof NOTICE_AUDIENCE];

/** Which audience each kind is for: one answer, so a caller cannot send a shop nudge to the admin. */
export const NOTICE_AUDIENCE_OF: Record<NoticeKind, NoticeAudience> = {
  [NOTICE_KIND.READY]: NOTICE_AUDIENCE.ADMIN,
  [NOTICE_KIND.READY_24H]: NOTICE_AUDIENCE.ADMIN,
  [NOTICE_KIND.NOT_READY_12H]: NOTICE_AUDIENCE.SHOP,
  [NOTICE_KIND.NOT_READY_24H]: NOTICE_AUDIENCE.SHOP,
  [NOTICE_KIND.NOT_PACKED_ADMIN]: NOTICE_AUDIENCE.SHOP,
  [NOTICE_KIND.BOOKED_BUYER]: NOTICE_AUDIENCE.BUYER,
  [NOTICE_KIND.BOOKED_SHOP]: NOTICE_AUDIENCE.SHOP,
  [NOTICE_KIND.PICKUP_MOVED_SHOP]: NOTICE_AUDIENCE.SHOP,
  [NOTICE_KIND.PICKUP_MOVED_BUYER]: NOTICE_AUDIENCE.BUYER,
  [NOTICE_KIND.PICKED_UP]: NOTICE_AUDIENCE.SHOP,
  [NOTICE_KIND.ETA_CHANGED_BUYER]: NOTICE_AUDIENCE.BUYER,
  [NOTICE_KIND.DELIVERED]: NOTICE_AUDIENCE.BUYER,
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
  /** The booking, from unit 3: days as "YYYY-MM-DD". No label link — the shop opens it through us (Q26). */
  courierName: z.string().optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().optional(),
  pickupDate: z.string().optional(),
  estimatedDelivery: z.string().optional(),
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
  /** Required for a buyer notice: checkout resolves it, as it does for the confirmation email. */
  buyerEmail?: string | null;
  /** For a kind that can repeat on one parcel: the timeline row that earned it. */
  ref?: string;
  booking?: {
    courierName: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    pickupDate: string | null;
    estimatedDelivery: string | null;
  };
}
