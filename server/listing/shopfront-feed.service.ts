import { channelMapRepository } from "./channel-map.repository";
import type { BuiltField } from "./field-map.types";
import { listingBuildService, type ListingSource } from "./listing-build.service";
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

  /** Each product's built attributes for its channel category, the whole feed's inputs read once (field-maps R5). */
  async attributes(channel: ShopfrontChannel, items: ReadonlyArray<{ product: ListingSource; channelType: string }>): Promise<Map<string, BuiltField[]>> {
    const { built } = await listingBuildService.build(channel, items);
    return new Map([...built].map(([id, listing]) => [id, listing.fields]));
  },
};
