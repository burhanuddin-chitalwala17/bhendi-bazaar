import { apiRequest } from "@/lib/api-client";
import type { ChannelVerdict, UnsavedReadinessInput } from "@server/listing/channel-readiness.service";

/** What the product form fetches on interaction; the page serves the first load (ADR-0034). */
export const listingApiClient = {
  /** The permitted answers for a type's lists, fetched when the category changes. */
  async listValues(orgId: string, lists: readonly string[]) {
    if (lists.length === 0) return {};
    const params = new URLSearchParams({ lists: lists.join(",") });
    return apiRequest<Record<string, Array<{ key: string; label: string; orgId: string | null }>>>(
      `/api/org/${encodeURIComponent(orgId)}/listing-values?${params}`,
    );
  },

  /** Making a family from the product form, so a sibling can be added without leaving it. */
  createFamily(orgId: string, input: { name: string; description?: string | null; categoryId: string }) {
    return apiRequest<{ id: string; name: string }>(`/api/org/${encodeURIComponent(orgId)}/families`, {
      method: "POST",
      body: input,
    });
  },

  /** What each place the shop sells on would still ask of the unsaved product (product-form D4). */
  readiness(orgId: string, input: UnsavedReadinessInput, signal?: AbortSignal) {
    return apiRequest<ChannelVerdict[]>(`/api/org/${encodeURIComponent(orgId)}/products/readiness`, {
      method: "POST",
      body: input,
      signal,
    });
  },
};
