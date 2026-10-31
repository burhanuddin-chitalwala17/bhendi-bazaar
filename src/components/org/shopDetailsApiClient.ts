import { apiRequest } from "@/lib/api-client";
import type { ShopDetailsDto } from "@server/catalog/shop-details.types";
import type { ShopContactFormInput, ShopDetailsSectionInput } from "@/lib/validation/schemas/shop-details.schema";

/** Shop details: one section per save (org-profile D3); name, mobile and email by the owner (D7). */
export const shopDetailsApiClient = {
  saveSection: (orgId: string, data: ShopDetailsSectionInput) =>
    apiRequest<ShopDetailsDto>(`/api/org/${orgId}/shop/details`, { method: "PATCH", body: data }),
  saveContact: (orgId: string, data: ShopContactFormInput) =>
    apiRequest<ShopDetailsDto>(`/api/org/${orgId}/shop/contact`, { method: "PATCH", body: data }),
};
