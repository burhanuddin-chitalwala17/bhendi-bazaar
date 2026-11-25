/**
 * Server-side domain types for Order
 *
 * These types are used exclusively on the server-side (services, repositories).
 * They mirror the database schema and contain server-specific logic.
 */

import { Order } from "@prisma/client";
import { DeliveryAddress } from "@server/identity/profile.types";
import { SHIPMENT_STATUS, type ShipmentStatus } from "@server/shipping/domain/shipping.types";

// ============================================
// Order status — the closed set, declared once
// ============================================

/**
 * Every value `Order.status` may hold. It was a bare `String` with a schema comment
 * naming three values the code never wrote; visibility now turns on one of them
 * (checkout-abandonment D7), so the set is declared here and read from here.
 */
export const ORDER_STATUS = {
  /** Created, stock reserved, nothing paid yet. */
  PENDING_PAYMENT: "pending_payment",
  /**
   * Paid. From here the status is a summary of the parcels (`summariseParcels`, order-fulfilment
   * D4): confirmed while every parcel is with its shop, then shipped, delivered or cancelled.
   */
  CONFIRMED: "confirmed",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  /** Every parcel was cancelled after payment. Not `expired`, which is an unpaid checkout. */
  CANCELLED: "cancelled",
  /** Hand statuses from before order-fulfilment; nothing writes them since unit 3 (Q36), old rows keep them. */
  PROCESSING: "processing",
  PACKED: "packed",
  /** A payment attempt failed. Not terminal: the buyer may still retry. */
  FAILED: "failed",
  /** Abandoned or expired: the reservation has been released (checkout-abandonment). */
  EXPIRED: "expired",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/**
 * How far along a paid order is. A summary is written only over a lower rank, so an order never
 * moves backwards (order-fulfilment D4): delivered and cancelled share the top rank and are
 * terminal. `expired` has no rank, so nothing summarises over it. The parcel migration's SQL
 * repeats these numbers; change both together.
 */
export const ORDER_STATUS_RANK: Partial<Record<OrderStatus, number>> = {
  [ORDER_STATUS.PENDING_PAYMENT]: 0,
  [ORDER_STATUS.FAILED]: 0,
  [ORDER_STATUS.CONFIRMED]: 1,
  [ORDER_STATUS.PROCESSING]: 2,
  [ORDER_STATUS.PACKED]: 3,
  [ORDER_STATUS.SHIPPED]: 4,
  [ORDER_STATUS.DELIVERED]: 5,
  [ORDER_STATUS.CANCELLED]: 5,
};

/** The statuses a summary to `to` may overwrite: every ranked one strictly below it. */
export function statusesBelow(to: OrderStatus): OrderStatus[] {
  const target = ORDER_STATUS_RANK[to];
  if (target === undefined) return [];
  return (Object.entries(ORDER_STATUS_RANK) as [OrderStatus, number][])
    .filter(([, rank]) => rank < target)
    .map(([status]) => status);
}

/**
 * Every value `Order.paymentStatus` may hold.
 *
 * Declared late: this is the set [Invariant 2](../../CLAUDE.md) is entirely about, and until
 * 2026-09-23 it existed only as a schema comment (`// pending, paid, failed`) and 34 copies of
 * the literal `"paid"` spread across thirteen files. A literal comparison does not fail when
 * the set changes — it silently stops matching, which is the failure mode with no symptom.
 *
 * `REFUNDED` is written by nothing yet; it is named here because the admin console already
 * renders it, and a value the UI knows but the domain does not is how the two drift.
 */
export const PAYMENT_STATUS = {
  /** No verified gateway signal yet. The default, and the only state an order is created in. */
  PENDING: "pending",
  /** Written in exactly one place, after a verified signature and a matched amount (ADR-0005). */
  PAID: "paid",
  /** A gateway attempt failed. Not terminal — the buyer may retry against the same order. */
  FAILED: "failed",
  REFUNDED: "refunded",
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

/** Parcels still with the shop — nothing a courier has collected (order-fulfilment D4). */
export const PARCEL_WITH_SHOP: readonly ShipmentStatus[] = [
  SHIPMENT_STATUS.PACKING,
  SHIPMENT_STATUS.READY_FOR_PICKUP,
  SHIPMENT_STATUS.PICKUP_BOOKED,
];

/** A parcel that still counts as sold. */
export const LIVE_PARCEL_WHERE = { status: { not: SHIPMENT_STATUS.CANCELLED } } as const;

/** Paid and not wholly cancelled: a cancelled order was paid but is not business (D4). */
export const PAID_ORDER_WHERE = {
  paymentStatus: PAYMENT_STATUS.PAID,
  status: { not: ORDER_STATUS.CANCELLED },
} as const;

/**
 * An abandoned checkout is kept in full and shown to nobody (checkout-abandonment
 * R4–R7). Applied inside the repositories, never at a call site: a predicate that
 * must be remembered is one the next query forgets (D6). The sweep's worklists are
 * the deliberate exemptions.
 */
export const VISIBLE_ORDER_WHERE = {
  status: { not: ORDER_STATUS.EXPIRED },
} as const;

/** Money that arrived and stands: paid, not cancelled, not abandoned. Both set `status`, hence `AND`. */
export const REVENUE_ORDER_WHERE = { AND: [PAID_ORDER_WHERE, VISIBLE_ORDER_WHERE] };

export interface OrderItem {
  productId: string;
  productName: string;
  productSlug: string;
  thumbnail: string;
  price: number;
  salePrice?: number;
  quantity: number;
  selectedVariant?: string;
}



interface Shipment {
  id: string;
  code: string;
  orderId: string;
  items: OrderItem[];
  orgId: string;
  fromPincode: string;
  fromCity: string;
  fromState: string;
  shippingCost: number;
  shippingProviderId?: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  status: string;
  estimatedDelivery?: string;
}

// UpdateOrderInput is deliberately gone: the paid/failed transitions in
// order.repository are the only writers of payment state (ADR-0005).


// ============================================
// NEW: Multi-Shipment Order Types
// ============================================

export interface ShipmentItem {
  productId: string;
  productName: string;
  productSlug: string;
  thumbnail: string;
  /** On reads since order-and-cart-lines: the unit price actually paid (TRD D2). */
  price: number;
  salePrice?: number;
  quantity: number;
  size?: string;
  color?: string;
}

export interface ShippingGroupInput {
  // Group identifier
  groupId: string;

  // Origin details
  orgId: string;
  orgName: string;
  fromPincode: string;
  fromCity: string;
  fromState: string;

  /** Unpriced on purpose: the server prices every line from the catalogue (Invariant 1). */
  items: Array<{
    productId: string;
    quantity: number;
    size?: string;
    color?: string;
    /** The checkout link that added this line: attribution only, never a price (checkout-links D5). */
    fromLinkId?: string;
  }>;

  /** The signed quote of the chosen rate; the server reads courier and charge from it, nothing else. */
  selectedRate: { quote: string };
}

export interface CreateOrderWithShipmentsInput {
  userId?: string;
  address: DeliveryAddress;
  shippingGroups: ShippingGroupInput[];
  /**
   * The grand total the customer was shown, in paise. Compared against the total the
   * server computes and never persisted — a mismatch means prices changed mid-session
   * and the order is refused rather than silently repriced (trd.md D4, R5).
   */
  displayedGrandTotal: number;
  /**
   * A coupon code, if the buyer entered one. A **string** — the only promotional
   * input a request may carry (promotions spec R16). The discount it produces is
   * computed server-side from the persisted offer; an amount arriving here would be
   * discarded, not validated (Invariant 1, ADR-0002).
   */
  couponCode?: string;
  notes?: string;
  paymentMethod?: string;
}

export interface ServerShipment {
  id: string;
  code: string;
  orderId: string;
  items: ShipmentItem[];
  orgId: string;
  fromPincode: string;
  fromCity: string;
  fromState: string;
  shippingCost: number;
  shippingProviderId?: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  status: string;
  estimatedDelivery?: string;
  createdAt: string;
}

export interface ServerOrderWithShipments extends Omit<Order, 'items' | 'shippingCost' | 'courierName' | 'trackingNumber' | 'totals'> {
  itemsTotal: number;
  shippingTotal: number;
  discount: number;
  grandTotal: number;
  shipments: ServerShipment[];
}
