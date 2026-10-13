/**
 * Admin Order Management Domain Types
 */

import type { ShipmentItem } from "@server/checkout/order.types";
import type { ShipmentStatus } from "@server/shipping/domain/shipping.types";

/** One parcel as the console shows it. Tracking is null until an operator fills it in. */
export interface AdminShipmentView {
  id: string;
  code: string;
  status: ShipmentStatus;
  fromCity: string;
  fromState: string;
  packageWeight: number | null;
  shippingCost: number;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  items: ShipmentItem[];
}

/**
 * One order in full, for the console's detail screen.
 *
 * Declared rather than inferred from the query, because the screen used to type this as the
 * storefront's `Order` — which has no `shipments[].packageWeight`, no `fromCity`, and a
 * differently-shaped address — and then reached past the mismatch with eleven `as any` casts.
 * `address` is a `Json` column, so it is null-checked here once instead of at every field.
 */
export interface AdminOrderDetail {
  id: string;
  code: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentId: string | null;
  address: OrderAddressSnapshot | null;
  itemsTotal: number;
  shippingTotal: number;
  discount: number;
  grandTotal: number;
  createdAt: Date;
  shipments: AdminShipmentView[];
}

/** What `Order.address` holds. Mirrors `OrderAddress` in `src/domain/order.ts`, which the
 *  browser reads — the two are the same snapshot, declared on each side of the boundary. */
export interface OrderAddressSnapshot {
  fullName: string;
  mobile: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface OrderListFilters {
  search?: string; // Search by code, customer name, email
  status?: string; // Filter by order status
  paymentStatus?: string; // Filter by payment status
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "updatedAt" | "total";
  sortOrder?: "asc" | "desc";
}

/** One row of the console's order listing — only what the table shows, so the full
 *  order row (address, payment ids, internal notes) never reaches the browser. */
export interface AdminOrderRow {
  id: string;
  code: string;
  customerName: string | null;
  grandTotal: number;
  status: string;
  paymentStatus: string | null;
  createdAt: Date;
}

export interface OrderListResult {
  orders: AdminOrderRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateOrderStatusInput {
  status?: string;
  notes?: string;
}

export interface OrderStats {
  totalOrders: number;
  processingOrders: number;
  packedOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  totalRevenue: number;
  revenueThisMonth: number;
  averageOrderValue: number;
}


