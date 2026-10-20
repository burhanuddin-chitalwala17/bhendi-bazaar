/**
 * What the Channels page and the dashboard banner read (channel-connectors UI approach): the cards
 * and attention from the channels domain, and the shop's storefront path for its own card.
 */

import { channelConnectionService } from "@server/channels/channel-connection.service";
import type { ChannelAttentionDTO, ChannelsOverviewDTO } from "@server/channels/channel-connection.types";
import { storefrontService } from "@server/catalog/storefront.service";
import { appUrl } from "@server/shared/app-url";

export interface ChannelsPageData {
  overview: ChannelsOverviewDTO;
  /** `/store/<handle>`, or null when the shop has no handle yet. */
  storePath: string | null;
  /** `<our host>/store/<handle>`, for the card to show. */
  storeLabel: string | null;
}

export const channelsDAL = {
  async page(orgId: string): Promise<ChannelsPageData> {
    const [overview, settings] = await Promise.all([
      channelConnectionService.overview(orgId),
      storefrontService.getSettings(orgId).catch(() => null),
    ]);
    const storePath = settings?.handle ? `/store/${settings.handle}` : null;
    return { overview, storePath, storeLabel: storePath ? `${new URL(appUrl()).host}${storePath}` : null };
  },

  /** The dashboard banner fails alone: a read that throws costs the banner, never the page. */
  async attention(orgId: string): Promise<ChannelAttentionDTO[]> {
    try {
      return (await channelConnectionService.overview(orgId)).attention;
    } catch (error) {
      console.error("[OrgDashboard] channel attention read failed:", error);
      return [];
    }
  },
};
