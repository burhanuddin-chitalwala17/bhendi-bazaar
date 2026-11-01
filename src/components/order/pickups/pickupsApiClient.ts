import { apiRequest } from "@/lib/api-client";
import type { BookingInput, PickupDateChangeInput } from "@/lib/validation/schemas/booking.schema";

/** The admin's pickup-queue commands (order-fulfilment). */
export const pickupsApiClient = {
  emailShop(shipmentId: string): Promise<{ message: string }> {
    return apiRequest(`/api/admin/shipments/${shipmentId}/email-shop`, { method: "POST" });
  },
  book(shipmentId: string, body: BookingInput): Promise<{ ok: true }> {
    return apiRequest(`/api/admin/shipments/${shipmentId}/booking`, { method: "POST", body });
  },
  changeDates(shipmentId: string, body: PickupDateChangeInput): Promise<{ ok: true }> {
    return apiRequest(`/api/admin/shipments/${shipmentId}/booking`, { method: "PATCH", body });
  },
  markPickedUp(shipmentId: string): Promise<{ ok: true }> {
    return apiRequest(`/api/admin/shipments/${shipmentId}/picked-up`, { method: "POST" });
  },
};
