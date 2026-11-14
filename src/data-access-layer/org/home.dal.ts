import { orgOnboardingService } from "@server/catalog/org-onboarding.service";
import type { OnboardingStatus } from "@server/catalog/org-onboarding.types";
import { shopDetailsService } from "@server/catalog/shop-details.service";
import { DASHBOARD_WIDGETS, fetchWidget, type WidgetContext, type WidgetData } from "@server/analytics/widgets";
import { sellingLowStock, toPack } from "@server/analytics/attention.service";
import type { SellingLowStock, ToPack } from "@server/analytics/attention.types";
import { channelConnectionService } from "@server/channels/channel-connection.service";
import type { ChannelAttentionDTO } from "@server/channels/channel-connection.types";
import { channelStockService } from "@server/channels/channel-stock.service";
import type { StockAttentionDTO } from "@server/channels/channel-stock.types";
import { listingProblemsService } from "@server/channels/listing-problems.service";
import { channelCatalogueService, type CatalogueAttentionDTO } from "@server/listing/channel-catalogue.service";
import { completenessService } from "@server/listing/completeness.service";
import type { ListingProblemsAttentionDTO } from "@server/channels/platform-listing.types";
import { enhancementService } from "@server/content/enhancement.service";
import { productTeamService } from "@server/catalog/product-team.service";
import type { ShareShop } from "@/lib/store-preview";
import { shareShopFor } from "./share-shop.dal";

/** One line's read: a failure costs that line and shows its own retry, never the page (D7). */
export type HomeRead<T> = { ok: true; value: T } | { ok: false };

/** The widget Home reads "has this shop sold yet" from, by its registry key. */
const WIDGET = { PAID_ORDERS: "orders" } as const;

/**
 * "Needs you now" (Q5, Q22, Q25; design-system Q31): each line hides at zero, and fails alone. New
 * reviews and an ending auction left it under Q31: neither has an action that clears it.
 */
export interface HomeAttentionDto {
  /** Paid parcels still packing: the shop's to resolve, unlike one waiting on a courier. */
  toPack: HomeRead<ToPack>;
  /** Low stock on products that sold in the last 30 days (Q31). */
  lowStock: HomeRead<SellingLowStock>;
  channel: HomeRead<ChannelAttentionDTO | null>;
  /** Stock sync waiting on a location match, or listings it put out of stock (inventory-sync Q28). */
  stock: HomeRead<StockAttentionDTO | null>;
  /** Linked listings a marketplace says need a fix, from the daily look (marketplace-publish Q23). */
  listingProblems: HomeRead<ListingProblemsAttentionDTO | null>;
  /** A channel now asks more of a type this shop sells (listing-model Q22). */
  channelAsks: HomeRead<CatalogueAttentionDTO | null>;
  /** Per channel the shop sells on, how many products miss details and the most any misses (dynamic-form R5). */
  channelNeeds: HomeRead<Array<{ channel: string; products: number; details: number }>>;
  photos: HomeRead<number>;
  /** Products the team changed, until the shop next saves each (product-form Q23). */
  teamEdits: HomeRead<{ count: number; productId: string | null }>;
}

export interface HomeData {
  shop: HomeRead<ShareShop>;
  setup: HomeRead<OnboardingStatus>;
  attention: HomeAttentionDto;
  /** Q14: before the first paid order the numbers are one line, not a grid of zeros. */
  hasPaidOrder: HomeRead<boolean>;
  readAt: string;
}

async function settle<T>(label: string, read: () => Promise<T>): Promise<HomeRead<T>> {
  try {
    return { ok: true, value: await read() };
  } catch (error) {
    console.error(`[Home] ${label} read failed:`, error);
    return { ok: false };
  }
}

async function widgetData(key: string, ctx: WidgetContext): Promise<WidgetData> {
  const widget = DASHBOARD_WIDGETS.find((entry) => entry.key === key);
  if (!widget) throw new Error(`Widget "${key}" is not registered`);
  return fetchWidget(widget, ctx);
}

/** Home asks each area whether it needs the shop (own-store onboarding D7). */
export const homeDAL = {
  /** `channels` false leaves out every channel nudge: the shop could not act on one (feature-access Q31). */
  async forOrg(orgId: string, now: Date = new Date(), { channels = true }: { channels?: boolean } = {}): Promise<HomeData> {
    const ctx: WidgetContext = { audience: "org", orgId };
    const none = async () => null;
    const [shop, setup, toPackRead, lowStock, channel, stock, listingProblems, channelAsks, channelNeeds, photos, teamEdits, paidOrders] = await Promise.all([
      settle("shop", async () => shareShopFor(await shopDetailsService.get(orgId))),
      settle("setup", () => orgOnboardingService.status(orgId)),
      settle("to pack", () => toPack(orgId)),
      settle("low stock", () => sellingLowStock(orgId, now)),
      settle("channel", channels ? async () => (await channelConnectionService.overview(orgId)).attention[0] ?? null : none),
      settle("stock", channels ? () => channelStockService.attention(orgId) : none),
      settle("listing problems", channels ? () => listingProblemsService.attention(orgId) : none),
      settle("channel asks", channels ? () => channelCatalogueService.attention(orgId, now) : none),
      settle("channel needs", () => completenessService.needsFor(orgId)),
      settle("photos", () => enhancementService.countAwaitingDecision(orgId)),
      settle("team edits", () => productTeamService.teamEditedSummary(orgId)),
      settle("paid orders", () => widgetData(WIDGET.PAID_ORDERS, ctx)),
    ]);
    return {
      shop,
      setup,
      attention: { toPack: toPackRead, lowStock, channel, stock, listingProblems, channelAsks, channelNeeds, photos, teamEdits },
      hasPaidOrder: paidOrders.ok ? { ok: true, value: paidOrders.value.value > 0 } : paidOrders,
      readAt: now.toISOString(),
    };
  },
};
