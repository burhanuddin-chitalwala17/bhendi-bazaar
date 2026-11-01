import { apiRequest } from "@/lib/api-client";
import type { HandleChangeInput, StorefrontSettingsInput } from "@/lib/validation/schemas/storefront.schema";
import type { OrgBannerFormInput } from "@/lib/validation/schemas/org-banner.schema";
import type { ManagedBanner } from "@/components/org/storefront-banners-manager";
import type { StorefrontLookPayload } from "@/lib/validation/schemas/storefront.schema";
import type { StorefrontLookState } from "@server/catalog/storefront-look.types";
import type { StorefrontSettingsDto } from "@server/catalog/storefront.types";

const banners = (orgId: string) => `/api/org/${orgId}/storefront/banners`;

/** An org's storefront: its settings, its public address, and its promotions. */
export const orgStorefrontApiClient = {
  /** What the editor and the section sheets edit, with the version a save compares on (D13). */
  getSettings: (orgId: string, signal?: AbortSignal) =>
    apiRequest<StorefrontSettingsDto>(`/api/org/${orgId}/storefront`, { signal }),

  /** Only the fields sent change; conditional on `expectedUpdatedAt` (D13). */
  saveSettings: (orgId: string, data: StorefrontSettingsInput) =>
    apiRequest<StorefrontSettingsDto>(`/api/org/${orgId}/storefront`, { method: "PATCH", body: data }),

  changeHandle: (orgId: string, data: HandleChangeInput) =>
    apiRequest<unknown>(`/api/org/${orgId}/storefront/handle`, { method: "PATCH", body: data }),

  /** Publish a look at the version the picker saw (storefront-themes D11). */
  publishLook: (orgId: string, data: StorefrontLookPayload) =>
    apiRequest<StorefrontLookState>(`/api/org/${orgId}/storefront/look`, { method: "PUT", body: data }),

  /** Switch back to the kept look (Q4). */
  revertLook: (orgId: string, lookVersion: number) =>
    apiRequest<StorefrontLookState>(`/api/org/${orgId}/storefront/look/revert`, { method: "POST", body: { lookVersion } }),

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
