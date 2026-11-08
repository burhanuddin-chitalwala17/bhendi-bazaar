import { channelCatalogueService as catalogue } from "@server/listing/channel-catalogue.service";
import type { Channel } from "@server/shared/channels";
import { homeBrandOrgId } from "@server/shared/home-brand";

import { CONNECTION_STATE, isMarketplaceChannel, type MarketplaceChannel } from "./channel-connection.types";
import { channelConnectionRepository } from "./channel-connection.repository";
import { channelConnectionService } from "./channel-connection.service";
import { providerFor } from "./providers";

/** A required field a channel added to a type we already held (parent Q22). */
export interface CatalogueChange {
  channel: string;
  type: string;
  added: string[];
}

/** One marketplace's daily read: what it read, what failed, what changed, or why it read nothing. */
export interface CatalogueRefresh {
  read: number;
  failed: number;
  changes: CatalogueChange[];
  skipped?: string;
}

/**
 * Reading each marketplace's own types into listing's catalogue (listing-model/channel-catalogue D2):
 * through one connected org, the home brand, once a day, for every type a BB type publishes to. A
 * marketplace that publishes no definitions reads nothing (D3). A failed read leaves the last one (A4).
 */
export const channelCatalogueReader = {
  async refresh(channel: Channel, now = new Date()): Promise<CatalogueRefresh> {
    const homeOrgId = homeBrandOrgId();
    if (!isMarketplaceChannel(channel)) return { read: 0, failed: 0, changes: [], skipped: "not a marketplace" };
    if (!homeOrgId) return { read: 0, failed: 0, changes: [], skipped: "HOME_BRAND_ORG_ID unset" };
    const connection = await channelConnectionRepository.find(homeOrgId, channel as MarketplaceChannel);
    if (!connection || connection.state !== CONNECTION_STATE.CONNECTED) return { read: 0, failed: 0, changes: [], skipped: "home brand not connected" };
    const token = () => channelConnectionService.accessToken(connection.id);
    const provider = providerFor(channel as MarketplaceChannel);
    let read = 0;
    let failed = 0;
    const changes: CatalogueChange[] = [];
    for (const key of await catalogue.publishedTypes(channel)) {
      try {
        const type = await provider.catalogueType(token, key);
        if (!type) continue;
        const added = await catalogue.store(channel, type, `${channel}-definitions-api`, now);
        if (added.length > 0) changes.push({ channel, type: key, added });
        read++;
      } catch (error) {
        failed++;
        console.error(`[channels] catalogue read failed for ${channel}:${key}: ${error instanceof Error ? error.name : "error"}`);
      }
    }
    return { read, failed, changes };
  },

  /**
   * One type read now, for a create that finds it unread (the daily read has not reached it yet): the
   * listing is then shaped and checked by the channel's own rules from its first send. False when the
   * home brand cannot read it; the create goes on without a schema and Amazon's check-only answer decides.
   */
  async readType(channel: Channel, key: string, now = new Date()): Promise<boolean> {
    const homeOrgId = homeBrandOrgId();
    if (!homeOrgId || !isMarketplaceChannel(channel)) return false;
    const connection = await channelConnectionRepository.find(homeOrgId, channel as MarketplaceChannel);
    if (!connection || connection.state !== CONNECTION_STATE.CONNECTED) return false;
    try {
      const type = await providerFor(channel as MarketplaceChannel).catalogueType(() => channelConnectionService.accessToken(connection.id), key);
      if (!type) return false;
      await catalogue.store(channel, type, `${channel}-definitions-api`, now);
      return true;
    } catch (error) {
      console.error(`[channels] catalogue read failed for ${channel}:${key}: ${error instanceof Error ? error.name : "error"}`);
      return false;
    }
  },
};
