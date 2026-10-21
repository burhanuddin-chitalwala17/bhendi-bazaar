/**
 * What the Listings page and a product's "On marketplaces" block read (channel-import D10). The
 * channels domain answers both; a missing connection or listing is the page's 404.
 */

import { channelImportService } from "@server/channels/channel-import.service";
import type {
  ChannelListingDetailDTO,
  ChannelListingsPageDTO,
  ProductMarketplaceLinkDTO,
} from "@server/channels/channel-connection.types";
import { NotFoundError } from "@server/shared/domain-error";

export type ListingsTab = "linked" | "notLinked";

export interface ListingsPageQuery {
  tab: ListingsTab;
  search: string | null;
  pages: number;
  listingId: string | null;
}

export const channelListingsDAL = {
  /** Null when the shop has no connection to this marketplace. */
  async page(
    orgId: string,
    channel: string,
    query: ListingsPageQuery,
  ): Promise<{ page: ChannelListingsPageDTO; detail: ChannelListingDetailDTO | null } | null> {
    try {
      const [page, detail] = await Promise.all([
        channelImportService.listingsPage(orgId, channel, query.tab, query.search, query.pages),
        query.listingId ? channelImportService.detail(orgId, query.listingId) : Promise.resolve(null),
      ]);
      return { page, detail };
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  },

  /** The block fails alone: a read that throws costs the block, never the product page. */
  async forProduct(orgId: string, productId: string): Promise<ProductMarketplaceLinkDTO[]> {
    try {
      return await channelImportService.linksForProduct(orgId, productId);
    } catch (error) {
      console.error("[ProductPage] marketplace links read failed:", error);
      return [];
    }
  },
};
