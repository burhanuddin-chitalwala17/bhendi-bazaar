import { apiRequest } from "@/lib/api-client";
import type { BannerFormSchemaInput } from "@/lib/validation/schemas/banner.schema";

/** The storefront hero's banners, admin side. */
export const bannersApiClient = {
  /** `action` is the create or the edit endpoint; the page that renders the form knows which. */
  save: (action: string, method: "POST" | "PATCH", data: BannerFormSchemaInput) =>
    apiRequest<unknown>(action, { method, body: data }),

  reorder: (ids: string[]) =>
    apiRequest("/api/admin/banners/reorder", { method: "PATCH", body: { ids } }),

  setActive: (id: string, isActive: boolean) =>
    apiRequest(`/api/admin/banners/${id}/active`, { method: "PATCH", body: { isActive } }),

  remove: (id: string) => apiRequest(`/api/admin/banners/${id}`, { method: "DELETE" }),
};
