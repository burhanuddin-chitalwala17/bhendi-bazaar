/**
 * What a marketplace's stock sync screens read (inventory-sync D6): the section, the location
 * matches and the turn-on preview. Each fails alone: a read that throws costs its block, not the page.
 */

import { channelStockService } from "@server/channels/channel-stock.service";
import { channelLocationService } from "@server/channels/channel-location.service";
import { channelOrdersService } from "@server/channels/channel-orders.service";
import type { LocationMatchDTO, MarketplaceOrderDTO, StockPreviewDTO, StockSyncSectionDTO } from "@server/channels/channel-stock.types";

export const channelStockDAL = {
  async section(orgId: string, channel: string): Promise<{ section: StockSyncSectionDTO; locations: LocationMatchDTO } | null> {
    try {
      const [section, locations] = await Promise.all([channelStockService.section(orgId, channel), channelLocationService.matches(orgId, channel)]);
      return { section, locations };
    } catch (error) {
      console.error("[Listings] stock sync section read failed:", error instanceof Error ? error.name : error);
      return null;
    }
  },

  async preview(orgId: string, channel: string): Promise<StockPreviewDTO | null> {
    try {
      return await channelStockService.preview(orgId, channel);
    } catch (error) {
      console.error("[StockSync] preview read failed:", error instanceof Error ? error.name : error);
      return null;
    }
  },

  /** The Marketplace orders tab (Q10). */
  async orders(orgId: string, pages: number): Promise<{ orders: MarketplaceOrderDTO[]; hasMore: boolean }> {
    return await channelOrdersService.page(orgId, pages);
  },
};
