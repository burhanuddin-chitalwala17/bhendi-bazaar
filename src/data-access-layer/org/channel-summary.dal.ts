// DATA ACCESS LAYER FOR A SHOP'S CHANNEL READINESS SUMMARY

import { cache } from "react";

import { channelReadinessService } from "@server/catalog/channel-readiness.service";

/**
 * How much of a shop's catalogue each channel would take, on the server
 * ([ADR-0034](../../../docs/adr/0034-render-on-the-server-by-default.md)).
 */
class ChannelSummaryDAL {
  forOrg = cache(async (orgId: string) => channelReadinessService.summaryForOrg(orgId));
}

export const orgChannelSummaryDAL = new ChannelSummaryDAL();
