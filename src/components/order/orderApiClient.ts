import { apiRequest } from "@/lib/api-client";
import { ApiError } from "@/lib/api-error";
import type { Order } from "@/domain/order";
import type { DeliveryAddress } from "@/domain/profile";

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

// No updateOrder: payment state has exactly one writer (ADR-0005). No getOrders: the profile
// screen reads through `ordersDAL` on the server ([ADR-0034]).
export const orderApiClient = {
  async lookupOrderByCode(code: string, signal?: AbortSignal): Promise<Order> {
    try {
      return await apiRequest<Order>("/api/orders/lookup", { method: "POST", body: { code }, signal });
    } catch (error) {
      // A rate limit carries its own message; the rest are said plainly to a guest.
      if (!(error instanceof ApiError) || error.status === 429) throw error;
      throw new ApiError(
        error.status === 404 ? "Order not found" : "Failed to lookup order",
        error.status,
        error.details,
      );
    }
  },

  /** The envelope's field details survive, so a validation failure names its field (ADR-0013). */
  createOrderWithShipments(input: CreateOrderWithShipmentsInput): Promise<Order> {
    return apiRequest("/api/orders/create-with-shipments", { method: "POST", body: input });
  },
};
