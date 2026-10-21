import { apiRequest } from "@/lib/api-client";
import type { ChannelValueMappingInput } from "@/lib/validation/schemas/channel-mapping.schema";
import type { OrgChannelsParsed } from "@/lib/validation/schemas/org-channels.schema";
import type { ChannelListingDTO } from "@server/channels/channel-connection.types";
import type { Channel } from "@server/shared/channels";

export const channelsApiClient = {
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
  connectUrl(orgId: string, channel: Channel) {
    return `/api/org/${orgId}/channels/${channel}/connect`;
  },

  /** Stop acting for the shop on this marketplace (connectors R7). */
  disconnect(orgId: string, channel: Channel) {
    return apiRequest(`/api/org/${orgId}/channels/${channel}/connection`, { method: "DELETE" });
  },

  /** "Check now": one read against the marketplace, recorded (connectors D7). */
  checkNow(orgId: string, channel: Channel) {
    return apiRequest<{ result: "ok" | "needs_reconnect" | "unreachable" }>(
      `/api/org/${orgId}/channels/${channel}/connection/check`,
      { method: "POST" },
    );
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
};
