import { apiRequest } from "@/lib/api-client";
import type { FulfilmentFeeInput } from "@/lib/validation/schemas/fulfilment-settings.schema";

/** The admin's cancellation-fee setting (order-fulfilment D14). */
export const feeApiClient = {
  save(body: FulfilmentFeeInput): Promise<{ feeRupees: number }> {
    return apiRequest("/api/admin/settings/fulfilment", { method: "PUT", body });
  },
};
