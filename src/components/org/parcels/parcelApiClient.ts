import { apiRequest } from "@/lib/api-client";

/** The shop's parcel commands (order-fulfilment D6). */
export const parcelApiClient = {
  markReady(orgId: string, shipmentId: string): Promise<void> {
    return apiRequest(`/api/org/${orgId}/shipments/${shipmentId}/ready`, { method: "POST" });
  },
};
