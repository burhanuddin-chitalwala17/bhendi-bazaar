import { apiRequest } from "@/lib/api-client";
import type { ShopCancelInput } from "@/lib/validation/schemas/parcel-cancel.schema";

/** The shop's parcel commands (order-fulfilment D6). */
export const parcelApiClient = {
  markReady(orgId: string, shipmentId: string): Promise<void> {
    return apiRequest(`/api/org/${orgId}/shipments/${shipmentId}/ready`, { method: "POST" });
  },
  /** The shop's cancel (D12): the reason only; the fee charged comes back. */
  cancel(orgId: string, shipmentId: string, body: ShopCancelInput): Promise<{ feePaise: number }> {
    return apiRequest(`/api/org/${orgId}/shipments/${shipmentId}/cancel`, { method: "POST", body });
  },
};
