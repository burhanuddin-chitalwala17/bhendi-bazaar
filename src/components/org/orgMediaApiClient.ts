import { apiRequest } from "@/lib/api-client";
import type { CropTransform } from "@/lib/image/crop-transform";
import type { MediaAssetDetailDto, MediaAssetDto, MediaTag } from "@server/catalog/media-library.types";
import type { Pagination } from "@server/shared/pagination";

export interface MediaLibraryPage {
  assets: MediaAssetDto[];
  pagination: Pagination;
}

/** One org's media library: its pages, one asset's uses, and what can be done to an asset. */
export const orgMediaApiClient = {
  /** `query` is the filter string the library route parses; `page` is appended to it. */
  page(orgId: string, query: string, page: number): Promise<MediaLibraryPage> {
    const separator = query ? "&" : "";
    return apiRequest<MediaLibraryPage>(`/api/org/${orgId}/media?${query}${separator}page=${page}`);
  },

  detail(orgId: string, assetId: string, signal?: AbortSignal): Promise<MediaAssetDetailDto> {
    return apiRequest<MediaAssetDetailDto>(`/api/org/${orgId}/media/${assetId}`, { signal });
  },

  /** null puts back the frame the worker cut. Answers the video's record as it now reads. */
  setPoster(orgId: string, videoId: string, posterAssetId: string | null): Promise<MediaAssetDto> {
    return apiRequest<MediaAssetDto>(`/api/org/${orgId}/media/${videoId}/poster`, {
      method: "PUT",
      body: { posterAssetId },
    });
  },

  /** Switch one tag on or off (ai-images/media-tags R6). Answers the image's record as it now reads. */
  setTag(orgId: string, assetId: string, tag: MediaTag, on: boolean): Promise<MediaAssetDto> {
    return apiRequest<MediaAssetDto>(`/api/org/${orgId}/media/${assetId}/tags`, { method: "PUT", body: { tag, on } });
  },

  async crop(orgId: string, assetId: string, transform: CropTransform): Promise<void> {
    await apiRequest(`/api/org/${orgId}/media/${assetId}/crop`, { method: "POST", body: transform });
  },

  async retire(orgId: string, assetId: string): Promise<void> {
    await apiRequest(`/api/org/${orgId}/media/${assetId}/retire`, { method: "POST" });
  },
};
