import { apiRequest } from "@/lib/api-client";
import type { ListingDraftInput, ListingPublishInput, ListingSaveInput } from "@/lib/validation/schemas/platform-listing.schema";
import type { PublishResultDTO } from "@server/channels/platform-listing.types";
import type { PageMatch } from "@server/channels/providers/publish";
import type { ChannelReadDTO, MarketplaceChannel } from "@server/channels/channel-connection.types";

/** A product's marketplace listing: saving it (channel-listings) and publishing it (marketplace-publish). */
export const listingsApiClient = {
  /** Save the listing's own values; never sends anything to the marketplace (channel-listings R8). */
  save(orgId: string, productId: string, channel: MarketplaceChannel, body: ListingSaveInput) {
    return apiRequest<{ version: number; waiting: number }>(`/api/org/${orgId}/products/${productId}/listings/${channel}`, { method: "PUT", body });
  },

  /** Send reviewed changes (marketplace-publish D3); listings that moved since the review come back refused. */
  publish(orgId: string, channel: MarketplaceChannel, body: ListingPublishInput) {
    return apiRequest<PublishResultDTO>(`/api/org/${orgId}/channels/${channel}/publish`, { method: "POST", body });
  },

  /** Pages already on the marketplace for a product (marketplace-publish D6). */
  findPages(orgId: string, productId: string, channel: MarketplaceChannel, signal?: AbortSignal) {
    return apiRequest<{ pages: PageMatch[] }>(`/api/org/${orgId}/products/${productId}/listings/${channel}/pages`, { signal });
  },

  /** Where a running read of the shop's listings has got to (channel-import D10). */
  readProgress(orgId: string, channel: string, signal?: AbortSignal) {
    return apiRequest<ChannelReadDTO>(`/api/org/${orgId}/channels/${channel}/listings/read`, { signal });
  },

  /** Start a draft: on a page found, or a new page (marketplace-publish Q7). */
  startDraft(orgId: string, productId: string, channel: MarketplaceChannel, body: ListingDraftInput) {
    return apiRequest<{ id: string }>(`/api/org/${orgId}/products/${productId}/listings/${channel}`, { method: "POST", body });
  },

  /** Put a family on a marketplace: its page and every member as drafts (marketplace-publish Q11). */
  startFamily(orgId: string, familyId: string, channel: MarketplaceChannel) {
    return apiRequest<{ id: string; members: number }>(`/api/org/${orgId}/channels/${channel}/families/${familyId}`, { method: "POST" });
  },
};
