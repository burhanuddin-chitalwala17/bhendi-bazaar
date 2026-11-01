import { apiRequest } from "@/lib/api-client";
import type { ChannelVerdict, UnsavedReadinessInput } from "@server/listing/channel-readiness.service";

/**
 * Where a shop's listing reads live: its own portal, or the team's twin of it (product-form D12).
 * Literal paths, so the reachability guard sees both callers.
 */
export function listingApiPrefix(orgId: string, team: boolean): string {
  const id = encodeURIComponent(orgId);
  return team ? `/api/admin/orgs/${id}` : `/api/org/${id}`;
}

/** What the product form fetches on interaction; the page serves the first load (ADR-0034). */
export const listingApiClient = {
  /** The permitted answers for a type's lists, fetched when the category changes. */
  async listValues(prefix: string, lists: readonly string[]) {
    if (lists.length === 0) return {};
    const params = new URLSearchParams({ lists: lists.join(",") });
    return apiRequest<Record<string, Array<{ key: string; label: string; orgId: string | null }>>>(
      `${prefix}/listing-values?${params}`,
    );
  },

  /** Making a family from the product form, so a sibling can be added without leaving it. */
  createFamily(prefix: string, input: { name: string; description?: string | null; categoryId: string }) {
    return apiRequest<{ id: string; name: string }>(`${prefix}/families`, {
      method: "POST",
      body: input,
    });
  },

  /** What each place the shop sells on would still ask of the unsaved product (product-form D4). */
  readiness(prefix: string, input: UnsavedReadinessInput, signal?: AbortSignal) {
    return apiRequest<ChannelVerdict[]>(`${prefix}/products/readiness`, {
      method: "POST",
      body: input,
      signal,
    });
  },
};
