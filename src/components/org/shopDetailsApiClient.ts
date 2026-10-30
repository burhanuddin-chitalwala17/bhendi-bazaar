import { apiRequest } from "@/lib/api-client";
import type { ShopDetailsDto } from "@server/catalog/shop-details.types";
import type { ShopDetailsSectionInput } from "@/lib/validation/schemas/shop-details.schema";

/** Shop details: one section per save (org-profile D3). */
export const shopDetailsApiClient = {
  saveSection: (orgId: string, data: ShopDetailsSectionInput) =>
    apiRequest<ShopDetailsDto>(`/api/org/${orgId}/shop/details`, { method: "PATCH", body: data }),
};
