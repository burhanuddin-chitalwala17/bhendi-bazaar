/**
 * Client-side Order Service
 *
 * This service handles all order-related API calls from the client side.
 * UI components should use this service instead of making direct fetch calls.
 */

import type { Order } from "@/domain/order";
import type { CartItem, CartTotals } from "@/domain/cart";
import type { ShippingGroup } from "@/domain/shipping";
import type { DeliveryAddress } from "@/domain/profile";
import { readApiError } from "@/lib/api-error";

export interface CreateOrderInput {
  items: CartItem[];
  totals: CartTotals;
  address: DeliveryAddress;
  notes?: string;
  paymentMethod?: string;
  paymentStatus?: string;
}

/** One shipping group as the create-order wire accepts it: lines are product + quantity, priced server-side. */
export interface ShippingGroupPayload {
  groupId: string;
  orgId: string;
  orgName: string;
  fromPincode: string;
  fromCity: string;
  fromState: string;
  items: Array<{ productId: string; quantity: number }>;
  selectedRate: {
    providerId: string;
    providerName: string;
    courierName: string;
    courierCode?: string;
    rate: number; // paise
    estimatedDays: number;
    mode?: string;
    etd?: string;
  };
}

export interface CreateOrderWithShipmentsInput {
  /**
   * A coupon code, if one was entered. The only promotional input the wire carries —
   * the discount it produces is computed server-side from the persisted offer, so no
   * amount, percentage or promotion id belongs here (promotions R16).
   */
  couponCode?: string;
  shippingGroups: ShippingGroupPayload[];
  /** The total the customer saw — compared server-side, never persisted (R5). */
  displayedGrandTotal: number;
  address: DeliveryAddress;
  notes?: string;
  paymentMethod?: string;
}

// UpdateOrderInput and updateOrder are gone with their route: payment state has
// exactly one writer (ADR-0005), and nothing else ever updated an order from the browser.


class OrderService {
  /**
   * Get all orders for the authenticated user
   */
  async getOrders(): Promise<Order[]> {
    const response = await fetch("/api/orders", {
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Unauthorized - please sign in");
      }
      throw new Error("Failed to fetch orders");
    }

    return response.json();
  }


  /**
   * Lookup order by code (for guest orders)
   */
  async lookupOrderByCode(code: string): Promise<Order> {
    const response = await fetch("/api/orders/lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });

    if (response.status === 429) {
      const error = await response.json();
      throw new Error(
        error.error || "Too many requests. Please try again later."
      );
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Order not found");
      }
      throw new Error("Failed to lookup order");
    }

    return response.json();
  }


  
  /**
   * Create a new order with multiple shipments (NEW)
   */
  async createOrderWithShipments(
    input: CreateOrderWithShipmentsInput
  ): Promise<Order> {
    const response = await fetch("/api/orders/create-with-shipments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(input),
    });

    if (response.status === 429) {
      const error = await response.json();
      throw new Error(
        error.error || "Too many requests. Please try again later."
      );
    }

    if (!response.ok) {
      // The envelope's field details survive: a validation failure names its
      // field instead of collapsing to "Validation failed" (ADR-0013).
      throw await readApiError(response);
    }

    return response.json();
  }

}

// Export a singleton instance
export const orderApiClient = new OrderService();

