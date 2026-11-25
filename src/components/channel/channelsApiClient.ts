import { apiRequest } from "@/lib/api-client";
import type { ChannelValueMappingInput } from "@/lib/validation/schemas/channel-mapping.schema";
import type { FieldMapRemoveInput, FieldMapSaveInput } from "@/lib/validation/schemas/field-map.schema";
import type { OrgChannelsParsed } from "@/lib/validation/schemas/org-channels.schema";
import type { ChannelListingDTO, LeftOffReason, SettlePickerProductDTO, SettleResultDTO } from "@server/channels/channel-connection.types";
import type { SettleListingFormValues } from "@/lib/validation/schemas/settle-listing.schema";
import type { ChannelTypeChangeInput } from "@/lib/validation/schemas/channel-mapping.schema";
import type { Channel } from "@server/shared/channels";
import type { SocialPlatform } from "@server/channels/social/types";
import type { MarketplaceFactsChangeInput } from "@/lib/validation/schemas/marketplace-facts.schema";
import type { FillNowOutcome } from "@server/channels/channel-facts.types";
import type { FamilySettleFormValues } from "@/lib/validation/schemas/family-settle.schema";
import type { FamilySettleResultDTO } from "@server/channels/channel-family.types";
import type { LocationMatchInput, StockSyncChangeInput } from "@/lib/validation/schemas/stock-sync.schema";

export const channelsApiClient = {
  /** Where one channel field's value comes from (listing-model/field-maps R6). */
  saveFieldMap(map: FieldMapSaveInput) {
    return apiRequest("/api/admin/field-maps", { method: "PUT", body: map });
  },

  /** Removes one field map (field-maps Q24). */
  removeFieldMap(key: FieldMapRemoveInput) {
    return apiRequest("/api/admin/field-maps", { method: "DELETE", body: key });
  },

  /** Records what a channel calls one of our values (ADR-0045). */
  mapValue(mapping: ChannelValueMappingInput) {
    return apiRequest("/api/admin/channels/values", { method: "PUT", body: mapping });
  },

  /** That a type does not sell on a channel, or takes it back (channel-registry D12). */
  setNotSold(body: { channel: Channel; productType: string; kind: string | null; notSold: boolean }) {
    return apiRequest("/api/admin/channels/not-sold", { method: "PUT", body });
  },

  /** Where an org sells. */
  saveOrgChannels(orgId: string, data: OrgChannelsParsed) {
    return apiRequest(`/api/org/${orgId}/channels`, { method: "PUT", body: data });
  },

  /** A link, not a request: the browser follows it to the marketplace's consent page (connectors D5). */
  connectUrl(orgId: string, channel: Channel | SocialPlatform) {
    return `/api/org/${orgId}/channels/${channel}/connect`;
  },

  /** Stop acting for the shop on this marketplace (connectors R7). */
  disconnect(orgId: string, channel: Channel | SocialPlatform) {
    return apiRequest(`/api/org/${orgId}/channels/${channel}/connection`, { method: "DELETE" });
  },

  /** "Check now": one read against the marketplace, recorded (connectors D7). */
  checkNow(orgId: string, channel: Channel | SocialPlatform) {
    return apiRequest<{ result: "ok" | "needs_reconnect" | "unreachable" }>(
      `/api/org/${orgId}/channels/${channel}/connection/check`,
      { method: "POST" },
    );
  },

  /** "Done" on Instagram's Turn on replies sheet: the step waits for the first message (connect-instagram D3). */
  repliesTurnedOn(orgId: string) {
    return apiRequest(`/api/org/${orgId}/channels/instagram/replies`, { method: "POST" });
  },

  /** "Read again": queue a read of every listing (channel-import R2). */
  readListings(orgId: string, channel: Channel) {
    return apiRequest(`/api/org/${orgId}/channels/${channel}/listings/read`, { method: "POST" });
  },

  /** Undo a link; no later read links it again by itself (channel-import Q5). */
  unlinkListing(orgId: string, channel: Channel, id: string) {
    return apiRequest(`/api/org/${orgId}/channels/${channel}/listings/${id}/unlink`, { method: "POST" });
  },

  /** Restore the SKU match the owner removed (channel-import Q16). */
  linkBackListing(orgId: string, channel: Channel, id: string) {
    return apiRequest<{ listing: ChannelListingDTO }>(
      `/api/org/${orgId}/channels/${channel}/listings/${id}/link-back`,
      { method: "POST" },
    );
  },

  /** One command on a product's "Facts from {marketplace}" card (marketplace-facts D8). */
  changeMarketplaceFacts(orgId: string, channel: Channel, listingId: string, change: MarketplaceFactsChangeInput) {
    return apiRequest<{ ok: true; outcome?: FillNowOutcome }>(`/api/org/${orgId}/channels/${channel}/listings/${listingId}/facts`, {
      method: "POST",
      body: change,
    });
  },

  /** Make one family of several listings, or add them to one (family-merge D3). */
  settleFamily(orgId: string, body: FamilySettleFormValues) {
    return apiRequest<{ result: FamilySettleResultDTO }>(`/api/org/${orgId}/channels/family`, { method: "POST", body });
  },

  /** "Not one item" on a suggested group (family-merge Q21). */
  dismissGroup(orgId: string, channel: Channel, listingIds: string[]) {
    return apiRequest(`/api/org/${orgId}/channels/${channel}/listings/dismiss-group`, { method: "POST", body: { listingIds } });
  },

  /** Stock sync's switch (inventory-sync D6). */
  changeStockSync(orgId: string, channel: Channel, change: StockSyncChangeInput) {
    return apiRequest(`/api/org/${orgId}/channels/${channel}/stock-sync`, { method: "PUT", body: change });
  },

  /** The owner's location matches (inventory-sync Q15). */
  matchLocations(orgId: string, channel: Channel, body: LocationMatchInput) {
    return apiRequest(`/api/org/${orgId}/channels/${channel}/locations`, { method: "PUT", body });
  },

  /** Leave a listing off Bhendi Bazaar (product-merge Q9). */
  leaveOffListing(orgId: string, channel: Channel, id: string, reason?: LeftOffReason) {
    return apiRequest(`/api/org/${orgId}/channels/${channel}/listings/${id}/leave-off`, { method: "POST", body: reason ? { reason } : {} });
  },

  /** Back to the to-do (product-merge Q9). */
  bringBackListing(orgId: string, channel: Channel, id: string) {
    return apiRequest(`/api/org/${orgId}/channels/${channel}/listings/${id}/bring-back`, { method: "POST" });
  },

  /** Add listings as a new product, or match them to one (product-merge D4). */
  settle(orgId: string, body: SettleListingFormValues) {
    return apiRequest<{ result: SettleResultDTO }>(`/api/org/${orgId}/channels/settle`, { method: "POST", body });
  },

  /** The match picker's products: similar names first, then the search (product-merge Q22). */
  settlePickerProducts(orgId: string, listingId: string, search: string, signal?: AbortSignal) {
    const query = new URLSearchParams({ listing: listingId, ...(search ? { q: search } : {}) });
    return apiRequest<{ similar: SettlePickerProductDTO[]; all: SettlePickerProductDTO[] }>(
      `/api/org/${orgId}/channels/settle/products?${query.toString()}`,
      { signal },
    );
  },

  /** Copy a listing's photos onto its product again (product-merge Q21). */
  retryListingPhotos(orgId: string, channel: Channel, id: string) {
    return apiRequest(`/api/org/${orgId}/channels/${channel}/listings/${id}/photos/retry`, { method: "POST" });
  },

  /** Add, remove or mark the publishing marketplace type for one of our types (marketplace-facts Q26). */
  changeChannelType(change: ChannelTypeChangeInput) {
    return apiRequest<{ id?: string; ok?: boolean }>("/api/admin/channels/types", { method: "PUT", body: change });
  },
};
