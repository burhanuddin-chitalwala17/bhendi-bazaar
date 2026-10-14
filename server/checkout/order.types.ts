/**
 * Server-side domain types for Order
 *
 * These types are used exclusively on the server-side (services, repositories).
 * They mirror the database schema and contain server-specific logic.
 */

import { Order } from "@prisma/client";
import { DeliveryAddress } from "@server/identity/profile.types";

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
  /** Paid, and — once fulfilment has run — booked with a carrier. */
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  PACKED: "packed",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  /** Paid, but the carrier booking failed for some or all parcels. */
  PARTIALLY_FULFILLED: "partially_fulfilled",
  FULFILLMENT_FAILED: "fulfillment_failed",
  /** A payment attempt failed. Not terminal: the buyer may still retry. */
  FAILED: "failed",
  /** Abandoned or expired: the reservation has been released (checkout-abandonment). */
  EXPIRED: "expired",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/**
 * The fulfilment moves an operator may make by hand, and nothing else: the table is the guard,
 * as `SHIPMENT_TRANSITIONS` is for a parcel. Payment-driven states (`confirmPaid`,
 * `expireAndRestock`, `markPaymentFailed`) and the booking pipeline's outcomes have their own
 * conditional writers in `order.repository.ts` and are deliberately absent here — an admin
 * dropdown must not be a second way to reach them. `delivered` is terminal.
 */
export const ORDER_TRANSITIONS: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.PACKED],
  [ORDER_STATUS.PACKED]: [ORDER_STATUS.SHIPPED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
};

/** The statuses `ORDER_TRANSITIONS` can reach — what an operator may ask for at all. */
export const OPERATOR_SETTABLE_STATUSES: readonly OrderStatus[] = [
  ...new Set(Object.values(ORDER_TRANSITIONS).flat()),
];

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

/**
 * An abandoned checkout is kept in full and shown to nobody (checkout-abandonment
 * R4–R7). Applied inside the repositories, never at a call site: a predicate that
 * must be remembered is one the next query forgets (D6). The sweep's worklists are
 * the deliberate exemptions.
 */
export const VISIBLE_ORDER_WHERE = {
  status: { not: ORDER_STATUS.EXPIRED },
} as const;

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
  items: Array<{ productId: string; quantity: number; size?: string; color?: string }>;

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
