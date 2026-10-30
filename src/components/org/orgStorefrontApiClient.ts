import { apiRequest } from "@/lib/api-client";
import type { HandleChangeInput, StorefrontSettingsInput } from "@/lib/validation/schemas/storefront.schema";
import type { OrgBannerFormInput } from "@/lib/validation/schemas/org-banner.schema";
import type { ManagedBanner } from "@/components/org/storefront-banners-manager";

/** The cover is managed by `ImageUpload` outside the form, so it travels beside its fields. */
type StorefrontSave = StorefrontSettingsInput & { heroUrl: string };

const banners = (orgId: string) => `/api/org/${orgId}/storefront/banners`;

/** An org's storefront: its settings, its public address, and its promotions. */
export const orgStorefrontApiClient = {
  saveSettings: (orgId: string, data: StorefrontSave) =>
    apiRequest<unknown>(`/api/org/${orgId}/storefront`, { method: "PATCH", body: data }),

  changeHandle: (orgId: string, data: HandleChangeInput) =>
    apiRequest<unknown>(`/api/org/${orgId}/storefront/handle`, { method: "PATCH", body: data }),

  addBanner: (orgId: string, data: Omit<OrgBannerFormInput, "imageUrl"> & { imageUrl: string | null }) =>
    apiRequest<unknown>(banners(orgId), { method: "POST", body: data }),

  updateBanner: (orgId: string, banner: ManagedBanner) =>
    apiRequest(`${banners(orgId)}/${banner.id}`, { method: "PATCH", body: banner }),

  deleteBanner: (orgId: string, bannerId: string) =>
    apiRequest(`${banners(orgId)}/${bannerId}`, { method: "DELETE" }),

  /** The whole order at once, so the result is what the org saw rather than interleaved moves. */
  reorderBanners: (orgId: string, ids: string[]) =>
    apiRequest(`${banners(orgId)}/reorder`, { method: "PATCH", body: { ids } }),
};
