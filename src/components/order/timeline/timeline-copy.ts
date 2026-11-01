import {
  PARCEL_ACTOR,
  PARCEL_EVENT_KIND,
  SHIPMENT_STATUS,
  SHIPMENT_STATUS_LABELS,
  type ParcelActor,
  type ShipmentStatus,
} from "@server/shipping/domain/shipping.types";
import type { ParcelTimelineDto, ParcelTimelineEntry } from "@server/checkout/parcel-timeline";

/** Who reads the timeline: one component, three wordings (order-fulfilment ux.md "Timeline wording"). */
export const TIMELINE_READER = {
  SHOP: "shop",
  BUYER: "buyer",
  ADMIN: "admin",
} as const;
export type TimelineReader = (typeof TIMELINE_READER)[keyof typeof TIMELINE_READER];

type Ctx = { entry: ParcelTimelineEntry; courier: string; awb: string; ageHours: number };
type Line = (ctx: Ctx) => string;

const label = (s: ShipmentStatus) => SHIPMENT_STATUS_LABELS[s] ?? s;
const wording = (e: ParcelTimelineEntry) => e.courierWording ?? label(e.status);
const withReason = (head: string, reason: string | null) => (reason ? `${head} · ${reason}` : head);

const SHOP_CANCELLED_BY: Partial<Record<ParcelActor, string>> = {
  [PARCEL_ACTOR.SHOP]: "you",
  [PARCEL_ACTOR.BUYER]: "the buyer",
  [PARCEL_ACTOR.ADMIN]: "us",
};
const ADMIN_CANCELLED_BY: Partial<Record<ParcelActor, string>> = {
  [PARCEL_ACTOR.SHOP]: "the shop",
  [PARCEL_ACTOR.BUYER]: "the buyer",
  [PARCEL_ACTOR.ADMIN]: "us",
  [PARCEL_ACTOR.COURIER]: "the courier",
};

const PROBLEM_SHOP = "Problem in transit — we'll contact you";
const PROBLEM_BUYER = "There's a problem with this parcel. We'll contact you.";

/** Keyed by every state, so a new state cannot be left unworded for any reader. */
const MOVE_LINES: Record<TimelineReader, Record<ShipmentStatus, Line>> = {
  [TIMELINE_READER.SHOP]: {
    [SHIPMENT_STATUS.PACKING]: () => "To pack — mark ready when it's packed",
    [SHIPMENT_STATUS.READY_FOR_PICKUP]: () => "Ready — we're booking your pickup",
    [SHIPMENT_STATUS.PICKUP_BOOKED]: ({ entry }) => `Pickup booked for ${entry.pickupDate ?? ""}`.trim(),
    [SHIPMENT_STATUS.PICKED_UP]: ({ courier }) => `Picked up by ${courier}`,
    [SHIPMENT_STATUS.IN_TRANSIT]: () => "On the way",
    [SHIPMENT_STATUS.OUT_FOR_DELIVERY]: () => "Out for delivery",
    [SHIPMENT_STATUS.DELIVERY_FAILED]: () => "Courier couldn't deliver — trying again",
    [SHIPMENT_STATUS.DELIVERED]: ({ entry }) => `Delivered ${entry.day}`,
    [SHIPMENT_STATUS.CANCELLED]: ({ entry }) =>
      withReason(`Cancelled by ${SHOP_CANCELLED_BY[entry.actor] ?? "us"}`, entry.reason),
    [SHIPMENT_STATUS.RTO_IN_TRANSIT]: () => "Coming back to you",
    [SHIPMENT_STATUS.RTO_DELIVERED]: () => "Coming back to you",
    [SHIPMENT_STATUS.LOST]: () => PROBLEM_SHOP,
    [SHIPMENT_STATUS.DAMAGED]: () => PROBLEM_SHOP,
  },
  [TIMELINE_READER.BUYER]: {
    [SHIPMENT_STATUS.PACKING]: () => "Order confirmed",
    [SHIPMENT_STATUS.READY_FOR_PICKUP]: () => "Being prepared",
    [SHIPMENT_STATUS.PICKUP_BOOKED]: ({ entry }) => `Ships ${entry.pickupDate ?? ""} · arrives by ${entry.estimatedDelivery ?? ""}`,
    [SHIPMENT_STATUS.PICKED_UP]: () => "Shipped",
    [SHIPMENT_STATUS.IN_TRANSIT]: () => "On the way",
    [SHIPMENT_STATUS.OUT_FOR_DELIVERY]: () => "Out for delivery today",
    [SHIPMENT_STATUS.DELIVERY_FAILED]: () => "Delivery attempt missed — the courier will try again",
    [SHIPMENT_STATUS.DELIVERED]: ({ entry }) => `Delivered ${entry.day}`,
    // The refund's state joins this line with the refund record (unit 5).
    [SHIPMENT_STATUS.CANCELLED]: () => "Cancelled",
    [SHIPMENT_STATUS.RTO_IN_TRANSIT]: () => PROBLEM_BUYER,
    [SHIPMENT_STATUS.RTO_DELIVERED]: () => PROBLEM_BUYER,
    [SHIPMENT_STATUS.LOST]: () => PROBLEM_BUYER,
    [SHIPMENT_STATUS.DAMAGED]: () => PROBLEM_BUYER,
  },
  [TIMELINE_READER.ADMIN]: {
    [SHIPMENT_STATUS.PACKING]: ({ entry }) => `Shop packing · paid ${entry.time}`,
    [SHIPMENT_STATUS.READY_FOR_PICKUP]: ({ ageHours }) => `Ready to book · ${ageHours} h`,
    [SHIPMENT_STATUS.PICKUP_BOOKED]: ({ courier, awb }) => `Booked · ${courier} · ${awb}`,
    [SHIPMENT_STATUS.PICKED_UP]: () => "Picked up",
    [SHIPMENT_STATUS.IN_TRANSIT]: ({ entry }) => `In transit · ${wording(entry)}`,
    [SHIPMENT_STATUS.OUT_FOR_DELIVERY]: () => "Out for delivery",
    [SHIPMENT_STATUS.DELIVERY_FAILED]: ({ entry }) => `Attempt failed · ${wording(entry)}`,
    [SHIPMENT_STATUS.DELIVERED]: () => "Delivered",
    [SHIPMENT_STATUS.CANCELLED]: ({ entry }) =>
      withReason(`Cancelled by ${ADMIN_CANCELLED_BY[entry.actor] ?? "us"}`, entry.reason),
    [SHIPMENT_STATUS.RTO_IN_TRANSIT]: ({ entry }) => wording(entry),
    [SHIPMENT_STATUS.RTO_DELIVERED]: ({ entry }) => wording(entry),
    [SHIPMENT_STATUS.LOST]: ({ entry }) => wording(entry),
    [SHIPMENT_STATUS.DAMAGED]: ({ entry }) => wording(entry),
  },
};

/** A date change: the shop and admin see the new pickup day, the buyer the new arrival day. */
const MOVED_LINES: Record<TimelineReader, Line> = {
  [TIMELINE_READER.SHOP]: ({ entry }) => `Pickup moved to ${entry.pickupDate ?? ""}`,
  [TIMELINE_READER.BUYER]: ({ entry }) => `New delivery date: ${entry.estimatedDelivery ?? ""}`,
  [TIMELINE_READER.ADMIN]: ({ entry }) => `Pickup moved to ${entry.pickupDate ?? ""}`,
};

/** The ETA in force before `entry`: the newest earlier row that set one (booking, date change or courier). */
function etaBefore(entry: ParcelTimelineEntry, timeline: ParcelTimelineDto): string {
  const at = timeline.entries.indexOf(entry);
  for (let i = at - 1; i >= 0; i--) {
    const eta = timeline.entries[i].estimatedDelivery;
    if (eta) return eta;
  }
  return "";
}

/** The courier's ETA replaced ours (D10, Q6). The shop has no line for it (ux.md "ETA changed": —). */
const ETA_LINES: Record<TimelineReader, ((ctx: Ctx, timeline: ParcelTimelineDto) => string) | null> = {
  [TIMELINE_READER.SHOP]: null,
  [TIMELINE_READER.BUYER]: ({ entry }) => `New delivery date: ${entry.estimatedDelivery ?? ""}`,
  [TIMELINE_READER.ADMIN]: ({ entry }, timeline) => `ETA ${etaBefore(entry, timeline)} → ${entry.estimatedDelivery ?? ""}`,
};

/** One row's line for one reader; null when this reader has no line for it. */
export function timelineLine(reader: TimelineReader, entry: ParcelTimelineEntry, timeline: ParcelTimelineDto): string | null {
  const ctx: Ctx = {
    entry,
    courier: timeline.courierName ?? "the courier",
    awb: timeline.trackingNumber ?? "",
    ageHours: entry.ageHours,
  };
  if (entry.kind === PARCEL_EVENT_KIND.PICKUP_MOVED) return MOVED_LINES[reader](ctx);
  if (entry.kind === PARCEL_EVENT_KIND.ETA_CHANGED) return ETA_LINES[reader]?.(ctx, timeline) ?? null;
  return MOVE_LINES[reader][entry.status]?.(ctx) ?? label(entry.status);
}
