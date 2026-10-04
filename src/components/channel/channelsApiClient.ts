import { apiRequest } from "@/lib/api-client";
import type { ChannelValueMappingInput } from "@/lib/validation/schemas/channel-mapping.schema";
import type { OrgChannelsParsed } from "@/lib/validation/schemas/org-channels.schema";

export const channelsApiClient = {
  /** Records what a channel calls one of our values (ADR-0045). */
  mapValue(mapping: ChannelValueMappingInput) {
    return apiRequest("/api/admin/channels/values", { method: "PUT", body: mapping });
  },

  /** Where an org sells. */
  saveOrgChannels(orgId: string, data: OrgChannelsParsed) {
    return apiRequest(`/api/org/${orgId}/channels`, { method: "PUT", body: data });
  },
};
