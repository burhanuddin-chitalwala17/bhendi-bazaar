/**
 * The pickup queue's shapes and tabs, apart from its queries: the admin's list is a client component,
 * and importing the queue itself would pull the database client into the browser.
 */
/** The admin pickup queue's tabs past "Not packed" (ux.md "admin pickups"). */
export const PICKUP_QUEUE_TAB = {
  READY: "ready",
  BOOKED: "booked",
} as const;
export type PickupQueueTab = (typeof PICKUP_QUEUE_TAB)[keyof typeof PICKUP_QUEUE_TAB];


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
