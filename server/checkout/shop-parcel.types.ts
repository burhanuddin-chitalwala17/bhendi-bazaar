import { z } from "zod";
import { SHIPMENT_STATUS, type ShipmentStatus } from "@server/shipping/domain/shipping.types";
import type { ShipmentItem } from "@server/checkout/order.types";

/**
 * The buyer as a shop sees them: name, city, pincode — never phone or street (order-fulfilment
 * D7, Q22, spec A10). The platform books the courier and the label carries the address.
 */
export interface ShopBuyer {
  name: string;
  city: string;
  pincode: string;
}

const addressPart = z.object({ fullName: z.string(), city: z.string(), pincode: z.string() }).partial();

/** Trim an order's address snapshot to `ShopBuyer`. Parsed, never cast: the column is JSON. */
export function toShopBuyer(address: unknown): ShopBuyer {
  const parsed = addressPart.safeParse(address);
  const a = parsed.success ? parsed.data : {};
  return { name: a.fullName ?? "", city: a.city ?? "", pincode: a.pincode ?? "" };
}

/** One of the shop's own parcels, as every org read returns it (D7). */
export interface ShopParcelView {
  id: string;
  code: string;
  status: ShipmentStatus;
  orderId: string;
  orderCode: string;
  /** When the order was paid, ISO; the clock "To pack" is sorted by. */
  paidAt: string | null;
  buyer: ShopBuyer;
  items: ShipmentItem[];
  /** This parcel's lines at what was paid, paise — never the basket's total. */
  parcelValue: number;
  itemCount: number;
  shippingCost: number;
  courierName: string | null;
  trackingNumber: string | null;
  /** "Parcel 1 of 2": its place among this shop's parcels in the order. */
  position: number;
  ofCount: number;
}

/** An order as the shop sees it: only its own parcels (spec R3, A1). */
export interface ShopOrderView {
  id: string;
  code: string;
  paidAt: string | null;
  buyer: ShopBuyer;
  parcels: ShopParcelView[];
}

/** The shop's order tabs (ux.md "Shop orders"), each a set of parcel states. */
export const SHOP_PARCEL_TAB = {
  TO_PACK: "to-pack",
  READY: "ready",
  ON_THE_WAY: "on-the-way",
  DONE: "done",
  CANCELLED: "cancelled",
} as const;
export type ShopParcelTab = (typeof SHOP_PARCEL_TAB)[keyof typeof SHOP_PARCEL_TAB];

/** Keyed by tab and covering every state, so a new state cannot be left off every tab. */
export const SHOP_TAB_STATUSES: Record<ShopParcelTab, readonly ShipmentStatus[]> = {
  [SHOP_PARCEL_TAB.TO_PACK]: [SHIPMENT_STATUS.PACKING],
  [SHOP_PARCEL_TAB.READY]: [SHIPMENT_STATUS.READY_FOR_PICKUP, SHIPMENT_STATUS.PICKUP_BOOKED],
  [SHOP_PARCEL_TAB.ON_THE_WAY]: [
    SHIPMENT_STATUS.PICKED_UP,
    SHIPMENT_STATUS.IN_TRANSIT,
    SHIPMENT_STATUS.OUT_FOR_DELIVERY,
    SHIPMENT_STATUS.DELIVERY_FAILED,
    SHIPMENT_STATUS.RTO_IN_TRANSIT,
  ],
  [SHOP_PARCEL_TAB.DONE]: [SHIPMENT_STATUS.DELIVERED, SHIPMENT_STATUS.RTO_DELIVERED, SHIPMENT_STATUS.LOST, SHIPMENT_STATUS.DAMAGED],
  [SHOP_PARCEL_TAB.CANCELLED]: [SHIPMENT_STATUS.CANCELLED],
};

export const isShopParcelTab = (value: unknown): value is ShopParcelTab =>
  Object.values(SHOP_PARCEL_TAB).includes(value as ShopParcelTab);

/** Rows per page on the shop's list (ux.md "Many items"). */
export const SHOP_PARCELS_PAGE = 20;

/** ux.md "Refused: ready on a cancelled parcel". Pure, so the sheet can tell it from "Stale". */
export const CANCELLED_PARCEL_PREFIX = "This parcel was cancelled by";
export const cancelledBeforeReadyMessage = (by: string, onDay: string) =>
  `${CANCELLED_PARCEL_PREFIX} ${by} on ${onDay}. Don't send it.`;
