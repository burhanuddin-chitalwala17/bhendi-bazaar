import { apiRequest } from "@/lib/api-client";
import type { BrandInput } from "@/lib/validation/schemas/brand.schema";
import type { BrandDto } from "@server/catalog/brand.types";

/** An org's brands (org-profile spec R3). A brand is retired, never deleted (ADR-0032). */
export const orgBrandsApiClient = {
  /** Creates when `brandId` is absent, updates it otherwise. */
  save: (orgId: string, brandId: string | undefined, data: BrandInput) =>
    apiRequest<BrandDto>(brandId ? `/api/org/${orgId}/brands/${brandId}` : `/api/org/${orgId}/brands`, {
      method: brandId ? "PATCH" : "POST",
      body: data,
    }),

  retire: (orgId: string, brandId: string) =>
    apiRequest(`/api/org/${orgId}/brands/${brandId}/retire`, { method: "POST" }),
};
