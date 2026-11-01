import { SHIPMENT_STATUS, type ShipmentStatus } from "@server/shipping/domain/shipping.types";
import { SHOP_PARCEL_TAB, type ShopParcelTab } from "@server/checkout/shop-parcel.types";

/** Shop orders and shop parcel copy, exactly as order-fulfilment ux.md signs it off. */
export const SHOP_ORDERS_COPY = {
  title: "Orders",
  firstUse: "No orders yet. When someone buys, it appears here and we email you.",
  shareShop: "Share your shop",
  loadFailed: "Couldn't load orders. Check your internet.",
  tryAgain: "Try again",
  refused: "You don't have access to this shop's orders.",
  goToMyShops: "Go to my shops",
  search: "Search order number",
  loadMore: "Load more",
  refresh: "Refresh",
  open: "Open",
} as const;

export const SHOP_TAB_LABEL: Record<ShopParcelTab, string> = {
  [SHOP_PARCEL_TAB.TO_PACK]: "To pack",
  [SHOP_PARCEL_TAB.READY]: "Ready",
  [SHOP_PARCEL_TAB.ON_THE_WAY]: "On the way",
  [SHOP_PARCEL_TAB.DONE]: "Done",
  [SHOP_PARCEL_TAB.CANCELLED]: "Cancelled",
};

/** ux.md "Empty", per tab. On the way and Done have no line of their own; they share the first. */
export const SHOP_TAB_EMPTY: Record<ShopParcelTab, string> = {
  [SHOP_PARCEL_TAB.TO_PACK]: "Nothing to pack. Nice.",
  [SHOP_PARCEL_TAB.READY]: "Nothing waiting for pickup.",
  [SHOP_PARCEL_TAB.ON_THE_WAY]: "Nothing to pack. Nice.",
  [SHOP_PARCEL_TAB.DONE]: "Nothing to pack. Nice.",
  [SHOP_PARCEL_TAB.CANCELLED]: "No cancelled parcels.",
};

export const SHOP_PARCEL_COPY = {
  ready: "Ready for pickup",
  marking: "Marking ready…",
  firstUseHint: "Pack the items below, then tap Ready for pickup. We book the courier for you.",
  partial: "You see only the parcels that ship from your shop.",
  successReady: "Ready — we're booking your pickup. We'll email you the date.",
  toast: "Marked ready. We'll book the pickup.",
  retry: "Couldn't mark ready. Check your internet and try again.",
  ok: "OK",
  confirmTitle: "Is everything packed and sealed?",
  confirmBody: "Once marked ready, it can't be cancelled here.",
  confirmYes: "Yes, it's ready",
  showAll: (n: number) => `Show all ${n} items`,
  /** ux.md "Success: booked". */
  booked: (day: string, courier: string | null, awb: string | null) =>
    [`Pickup booked for ${day}`, courier, awb ? `AWB ${awb}` : null].filter(Boolean).join(" · "),
  downloadLabel: "Download label",
  allOrders: "← All orders",
} as const;

/** "Parcel 1 of 2 · Ready" (ux.md "Shop orders", Partial). */
export const parcelOfLine = (position: number, of: number, status: ShipmentStatus) =>
  `${of > 1 ? `Parcel ${position} of ${of} · ` : ""}${SHOP_STATUS_SHORT[status]}`;

/** "Updated 12 min ago", shown once the list is over five minutes old (ux.md "Stale"). */
export const updatedAgo = (minutes: number) => `Updated ${minutes} min ago`;

/** The shop's wording per state (ux.md "Timeline wording", Shop column). Placeholders filled where known. */
export const SHOP_STATUS_LINE: Record<ShipmentStatus, string> = {
  [SHIPMENT_STATUS.PACKING]: "To pack — mark ready when it's packed",
  [SHIPMENT_STATUS.READY_FOR_PICKUP]: "Ready — we're booking your pickup",
  [SHIPMENT_STATUS.PICKUP_BOOKED]: "Pickup booked",
  [SHIPMENT_STATUS.PICKED_UP]: "Picked up",
  [SHIPMENT_STATUS.IN_TRANSIT]: "On the way",
  [SHIPMENT_STATUS.OUT_FOR_DELIVERY]: "Out for delivery",
  [SHIPMENT_STATUS.DELIVERY_FAILED]: "Courier couldn't deliver — trying again",
  [SHIPMENT_STATUS.DELIVERED]: "Delivered",
  [SHIPMENT_STATUS.CANCELLED]: "Cancelled",
  [SHIPMENT_STATUS.RTO_IN_TRANSIT]: "Coming back to you",
  [SHIPMENT_STATUS.RTO_DELIVERED]: "Coming back to you",
  [SHIPMENT_STATUS.LOST]: "Problem in transit — we'll contact you",
  [SHIPMENT_STATUS.DAMAGED]: "Problem in transit — we'll contact you",
};

/** The tab a state sits under, as a short badge. */
const SHOP_STATUS_SHORT: Record<ShipmentStatus, string> = {
  [SHIPMENT_STATUS.PACKING]: "To pack",
  [SHIPMENT_STATUS.READY_FOR_PICKUP]: "Ready",
  [SHIPMENT_STATUS.PICKUP_BOOKED]: "Ready",
  [SHIPMENT_STATUS.PICKED_UP]: "On the way",
  [SHIPMENT_STATUS.IN_TRANSIT]: "On the way",
  [SHIPMENT_STATUS.OUT_FOR_DELIVERY]: "On the way",
  [SHIPMENT_STATUS.DELIVERY_FAILED]: "On the way",
  [SHIPMENT_STATUS.RTO_IN_TRANSIT]: "On the way",
  [SHIPMENT_STATUS.DELIVERED]: "Done",
  [SHIPMENT_STATUS.RTO_DELIVERED]: "Done",
  [SHIPMENT_STATUS.LOST]: "Done",
  [SHIPMENT_STATUS.DAMAGED]: "Done",
  [SHIPMENT_STATUS.CANCELLED]: "Cancelled",
};
