// DATA ACCESS LAYER FOR A SHOP'S CHANNEL READINESS SUMMARY

import { cache } from "react";

import { channelReadinessService } from "@server/listing/channel-readiness.service";
import type { Channel } from "@server/shared/channels";

/**
 * How much of a shop's catalogue each channel would take, on the server
 * ([ADR-0034](../../../docs/adr/0034-render-on-the-server-by-default.md)).
 */
class ChannelSummaryDAL {
  forOrg = cache(async (orgId: string) => channelReadinessService.summaryForOrg(orgId));
  /** The products one channel would refuse, with why (design-system Q35). */
  notReadyOn = cache(async (orgId: string, channel: Channel) => channelReadinessService.notReadyOn(orgId, channel));
}

export const orgChannelSummaryDAL = new ChannelSummaryDAL();
