import { apiRequest } from "@/lib/api-client";

/** The admin's pickup-queue commands (order-fulfilment). */
export const pickupsApiClient = {
  emailShop(shipmentId: string): Promise<{ message: string }> {
    return apiRequest(`/api/admin/shipments/${shipmentId}/email-shop`, { method: "POST" });
  },
};
