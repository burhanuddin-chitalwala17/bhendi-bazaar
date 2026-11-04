import { apiRequest } from "@/lib/api-client";
import { ApiError } from "@/lib/api-error";
import type { Order } from "@/domain/order";
import type { DeliveryAddress } from "@/domain/profile";
import type { BuyerCancelInput } from "@/lib/validation/schemas/parcel-cancel.schema";
import { ORDER_API_COPY } from "@/components/order/order-copy";

/** One shipping group as the create-order wire accepts it: lines are product + quantity, priced server-side. */
export interface ShippingGroupPayload {
  groupId: string;
  orgId: string;
  orgName: string;
  fromPincode: string;
  fromCity: string;
  fromState: string;
  items: Array<{ productId: string; quantity: number }>;
  /** The chosen rate's signed quote; the server charges what it signed, not what the page shows. */
  selectedRate: { quote: string };
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
        error.status === 404 ? ORDER_API_COPY.notFound : ORDER_API_COPY.lookupFailed,
        error.status,
        error.details,
      );
    }
  },

  /** The buyer cancels one parcel of their own order (order-fulfilment D12); the reason is optional. */
  cancelParcel(orderId: string, shipmentId: string, body: BuyerCancelInput): Promise<{ refundPaise: number }> {
    return apiRequest(`/api/orders/${orderId}/shipments/${shipmentId}/cancel`, { method: "POST", body });
  },

  /** The envelope's field details survive, so a validation failure names its field (ADR-0013). */
  createOrderWithShipments(input: CreateOrderWithShipmentsInput): Promise<Order> {
    return apiRequest("/api/orders/create-with-shipments", { method: "POST", body: input });
  },
};
