import { apiRequest } from "@/lib/api-client";
import type {
  EnhancementDto,
  EnhancementUsage,
  RequestEnhancementInput,
} from "@server/content/enhancement.types";

/** One improvement run's requests: start it, ask after it, keep or discard what it proposed. */
export const enhancementRunApiClient = {
  request(orgId: string, input: RequestEnhancementInput) {
    return apiRequest<{ enhancement: EnhancementDto; usage: EnhancementUsage }>(`/api/org/${orgId}/enhancements`, {
      method: "POST",
      body: input,
    });
  },

  get(orgId: string, id: string) {
    return apiRequest<{ enhancement: EnhancementDto }>(`/api/org/${orgId}/enhancements/${id}`);
  },

  decide(orgId: string, id: string, action: "accept" | "discard") {
    const url =
      action === "accept"
        ? `/api/org/${orgId}/enhancements/${id}/accept`
        : `/api/org/${orgId}/enhancements/${id}/discard`;
    return apiRequest<{ enhancement: EnhancementDto }>(url, { method: "POST" });
  },
};
