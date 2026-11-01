import { apiRequest } from "@/lib/api-client";
import type { BookingInput, PickupDateChangeInput } from "@/lib/validation/schemas/booking.schema";
import type { ShopCancelInput } from "@/lib/validation/schemas/parcel-cancel.schema";

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
  /** The admin's cancel (D12): a reason; the AWB to cancel on Shiprocket comes back when it was booked. */
  cancel(shipmentId: string, body: ShopCancelInput): Promise<{ awb: string | null }> {
    return apiRequest(`/api/admin/shipments/${shipmentId}/cancel`, { method: "POST", body });
  },
  dismissConflict(conflictId: string): Promise<{ ok: true }> {
    return apiRequest(`/api/admin/courier-conflicts/${conflictId}/dismiss`, { method: "POST" });
  },
};
