/**
 * Server-side domain types for Order
 *
 * These types are used exclusively on the server-side (services, repositories).
 * They mirror the database schema and contain server-specific logic.
 */

import { Order } from "@prisma/client";
import { DeliveryAddress } from "@server/identity/profile.types";

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

export interface CreateOrderInput {
  userId?: string; // Optional for guest orders
  items: OrderItem[];
  itemsTotal: number;
  shippingTotal: number;
  discount: number;
  grandTotal: number;
  address: DeliveryAddress;
  notes?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentId?: string;
  status?: string;
  shipments: Shipment[];
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

export interface UpdateOrderInput {
  status?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentId?: string;
}

// ============================================
// NEW: Multi-Shipment Order Types
// ============================================

export interface ShipmentItem {
  productId: string;
  productName: string;
  productSlug: string;
  thumbnail: string;
  price: number;
  salePrice?: number;
  quantity: number;
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
  items: Array<{ productId: string; quantity: number }>;

  // Selected shipping rate
  selectedRate: {
    providerId: string;
    providerName: string;
    courierName: string;
    courierCode?: string;
    rate: number;
    estimatedDays: number;
    mode?: string;
    etd?: string;
  };
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
