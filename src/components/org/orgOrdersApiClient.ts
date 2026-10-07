import { apiRequest } from "@/lib/api-client";

export const orgOrdersApiClient = {
  transitionOrder(orgId: string, orderId: string, status: string): Promise<void> {
    return apiRequest(`/api/org/${orgId}/orders/${orderId}/transition`, {
      method: "PATCH",
      body: { status },
    });
  },
};
