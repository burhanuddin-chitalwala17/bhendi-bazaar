/**
 * Client-side domain types for Order
 *
 * These types are used on the client-side (components, hooks).
 * They mirror the API response structure and are used for type safety.
 */

import type { CartItem } from "./cart";

export interface OrderAddress {
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

export interface Order {
  id: string;
  code: string;
  userId?: string; // Optional for guest orders
  itemsTotal: number;
  shippingTotal: number;
  discount: number;
  grandTotal: number;
  status: string;
  address: OrderAddress;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentId?: string;
  shipments: Shipment[];
}

// create shipment interface
export interface Shipment {
  id: string;
  code: string;
  items: CartItem[];
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
  estimatedDelivery?: Date;
  createdAt: Date;
  updatedAt: Date;
}
