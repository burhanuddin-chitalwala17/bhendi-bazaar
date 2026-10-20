import { apiRequest } from "@/lib/api-client";
import type { ChannelValueMappingInput } from "@/lib/validation/schemas/channel-mapping.schema";
import type { OrgChannelsParsed } from "@/lib/validation/schemas/org-channels.schema";
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
};
