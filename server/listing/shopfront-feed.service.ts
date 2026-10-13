import { channelMapRepository } from "./channel-map.repository";
import { orgChannelRepository } from "./org-channel.repository";
import type { CategoryRule, ShopfrontChannel } from "./shopfront-feed";

/**
 * The two channel questions a feed asks ([shopfront-feeds](../../docs/specs/shopfront-feeds/)
 * D6, D7): which shops have said yes, and what the channel calls each type.
 */
export const shopfrontFeedService = {
  /** An absent row is off, so a shop never asked is never published (spec R5). */
  async orgsSellingOn(channel: ShopfrontChannel): Promise<string[]> {
    return await orgChannelRepository.orgsWith(channel);
  },

  /** The channel's own rows, never another's, so either can move alone (ADR-0045). */
  async categoryRules(channel: ShopfrontChannel): Promise<CategoryRule[]> {
    const { categories } = await channelMapRepository.byChannel(channel);
    return categories;
  },
};
