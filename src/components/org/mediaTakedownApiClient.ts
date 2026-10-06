import { apiRequest } from "@/lib/api-client";
import type { PlatformRetireInput } from "@/lib/validation/schemas/media-library.schema";

/** The platform taking one image down (media-library spec R12). */
export const mediaTakedownApiClient = {
  retire: (assetId: string, data: PlatformRetireInput) =>
    apiRequest<unknown>(`/api/admin/media/${assetId}/retire`, { method: "POST", body: data }),
};
