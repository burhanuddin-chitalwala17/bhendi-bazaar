import { apiRequest } from "@/lib/api-client";
import type { UpdateTrackingInput } from "@/lib/validation/schemas/shipment-tracking.schema";

/** The admin's manual tracking entry for a shipment booked outside the app. */
export const shipmentTrackingApiClient = {
  updateTracking: (shipmentId: string, data: UpdateTrackingInput) =>
    apiRequest<unknown>(`/api/admin/shipments/${shipmentId}/tracking`, { method: "PATCH", body: data }),
};
