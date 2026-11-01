import { indiaToday, isoDay, calendarDay } from "@server/shared/india-time";
import { countParcelsIn, parcelsInQueue } from "@server/shipping/shipment-status.service";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";

/** The admin pickup queue's tabs past "Not packed" (ux.md "admin pickups"). */
export const PICKUP_QUEUE_TAB = {
  READY: "ready",
  BOOKED: "booked",
} as const;
export type PickupQueueTab = (typeof PICKUP_QUEUE_TAB)[keyof typeof PICKUP_QUEUE_TAB];

const STATUS_OF_TAB = {
  [PICKUP_QUEUE_TAB.READY]: SHIPMENT_STATUS.READY_FOR_PICKUP,
  [PICKUP_QUEUE_TAB.BOOKED]: SHIPMENT_STATUS.PICKUP_BOOKED,
} as const;

export const isPickupQueueTab = (value: unknown): value is PickupQueueTab =>
  Object.values(PICKUP_QUEUE_TAB).includes(value as PickupQueueTab);

/** Rows per page (ux.md "Many items"). */
export const PICKUP_QUEUE_PAGE = 50;

/** One parcel in the queue, as the admin's screen receives it (TRD UI approach). */
export interface PickupQueueRow {
  shipmentId: string;
  orgId: string;
  parcelCode: string;
  orderId: string;
  /** How many parcels the order has: "Parcel 2 of 2" (ux.md Partial). */
  parcelsInOrder: number;
  shopName: string;
  shopPhone: string | null;
  city: string;
  pincode: string;
  /** Hours since the shop marked it ready; amber past 24 (ux.md Stale). */
  readyHours: number | null;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  /** "YYYY-MM-DD" for the date fields; "Sat 2 Nov" for reading. */
  pickupDay: string | null;
  pickupDate: string | null;
  estimatedDelivery: string | null;
  /** Whole days the booked pickup date is behind India's today; 0 when not overdue. */
  daysOverdue: number;
}

const DAY_MS = 86_400_000;

/** Narrow the queue to one shop or one pickup city (ux.md "Many items"). */
export interface PickupQueueFilter {
  orgId?: string;
  city?: string;
}

/** One page of a tab, `page` from 1; a page past the end is empty. */
export async function listPickupQueue(
  tab: PickupQueueTab,
  { page = 1, ...filter }: PickupQueueFilter & { page?: number } = {},
  now: Date = new Date(),
): Promise<PickupQueueRow[]> {
  const today = Date.parse(`${indiaToday(now)}T00:00:00Z`);
  const skip = (Math.max(1, Math.floor(page)) - 1) * PICKUP_QUEUE_PAGE;
  const rows = await parcelsInQueue(STATUS_OF_TAB[tab], { ...filter, skip, take: PICKUP_QUEUE_PAGE });
  return rows.map((row) => {
    const readyAt = tab === PICKUP_QUEUE_TAB.READY ? row.parcelEvents[0]?.createdAt : undefined;
    return {
      shipmentId: row.id,
      orgId: row.orgId,
      parcelCode: row.code,
      orderId: row.order.id,
      parcelsInOrder: row.order._count.shipments,
      shopName: row.org.name,
      shopPhone: row.org.phone,
      city: row.fromCity,
      pincode: row.fromPincode,
      readyHours: readyAt ? Math.floor((now.getTime() - readyAt.getTime()) / 3_600_000) : null,
      courierName: row.courierName,
      trackingNumber: row.trackingNumber,
      trackingUrl: row.trackingUrl,
      pickupDay: row.pickupDate ? calendarDay(row.pickupDate) : null,
      pickupDate: row.pickupDate ? isoDay(row.pickupDate) : null,
      estimatedDelivery: row.estimatedDelivery ? isoDay(row.estimatedDelivery) : null,
      daysOverdue: row.pickupDate ? Math.max(0, Math.round((today - row.pickupDate.getTime()) / DAY_MS)) : 0,
    };
  });
}

export async function pickupQueueCount(tab: PickupQueueTab, filter: PickupQueueFilter = {}): Promise<number> {
  return await countParcelsIn(STATUS_OF_TAB[tab], filter);
}
