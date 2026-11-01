import { calendarDay, indiaDay, indiaTime } from "@server/shared/india-time";
import { parcelEventsOf } from "@server/shipping/shipment-status.service";
import type { ParcelActor, ParcelEventKind, ShipmentStatus } from "@server/shipping/domain/shipping.types";
import type { ParcelRefund } from "@server/checkout/parcel-cancel.types";

/**
 * One row of a parcel's timeline, as every reader receives it (order-fulfilment D5, R7). The facts
 * only: `ParcelTimeline` words them per reader. Every date is already India's (A14).
 */
export interface ParcelTimelineEntry {
  kind: ParcelEventKind;
  status: ShipmentStatus;
  actor: ParcelActor;
  reason: string | null;
  courierWording: string | null;
  /** "Sat 2 Nov", for a booking or a date change. */
  pickupDate: string | null;
  estimatedDelivery: string | null;
  /** India's day and time of the row: "2 Nov", "5:00 am". */
  day: string;
  time: string;
  at: string;
  /** Whole hours since the row, as of the read: "Ready to book · {age}". */
  ageHours: number;
}

export interface ParcelTimelineDto {
  courierName: string | null;
  trackingNumber: string | null;
  entries: ParcelTimelineEntry[];
  /** The buyer's "Cancelled · refund {state}" (ux.md Timeline wording); absent means no refund is owed. */
  refund?: ParcelRefund;
}

type EventRow = Awaited<ReturnType<typeof parcelEventsOf>>[number];

/** Pure, so A14 is provable without a database: a row at 23:30 UTC reads as India's next day. */
export function toTimelineEntry(row: Omit<EventRow, "shipmentId">, now: Date = new Date()): ParcelTimelineEntry {
  return {
    kind: row.kind as ParcelEventKind,
    status: row.toStatus as ShipmentStatus,
    actor: row.actor as ParcelActor,
    reason: row.reason,
    courierWording: row.courierWording,
    pickupDate: row.pickupDate ? calendarDay(row.pickupDate) : null,
    estimatedDelivery: row.estimatedDelivery ? calendarDay(row.estimatedDelivery) : null,
    day: indiaDay(row.createdAt),
    time: indiaTime(row.createdAt),
    at: row.createdAt.toISOString(),
    ageHours: Math.max(0, Math.floor((now.getTime() - row.createdAt.getTime()) / 3_600_000)),
  };
}

/** Each parcel's timeline, oldest row first, from the one event log all three screens read. */
export async function parcelTimelines(
  parcels: { id: string; courierName: string | null; trackingNumber: string | null }[],
): Promise<Record<string, ParcelTimelineDto>> {
  const rows = await parcelEventsOf(parcels.map((p) => p.id));
  const now = new Date();
  const out: Record<string, ParcelTimelineDto> = {};
  for (const p of parcels) out[p.id] = { courierName: p.courierName, trackingNumber: p.trackingNumber, entries: [] };
  for (const { shipmentId, ...row } of rows) out[shipmentId]?.entries.push(toTimelineEntry(row, now));
  return out;
}
