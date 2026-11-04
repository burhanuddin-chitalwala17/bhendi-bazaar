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
import { enhancementService } from "@server/content/enhancement.service";
import { productTeamService } from "@server/catalog/product-team.service";
import type { ShareShop } from "@/lib/store-preview";
import { shareShopFor } from "./share-shop.dal";

/** One line's read: a failure costs that line and shows its own retry, never the page (D7). */
export type HomeRead<T> = { ok: true; value: T } | { ok: false };

/** The two existing widgets Home reads a number from, by their registry key. */
const WIDGET = { PARCELS: "pending-parcels", PAID_ORDERS: "orders" } as const;

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
  /** Widget figures already read here, by registry key, so the grid does not query them twice. */
  widgets: Record<string, WidgetData>;
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
  async forOrg(orgId: string, now: Date = new Date()): Promise<HomeData> {
    const ctx: WidgetContext = { audience: "org", orgId };
    const [shop, setup, parcels, toPackRead, lowStock, channel, stock, photos, teamEdits, paidOrders] = await Promise.all([
      settle("shop", async () => shareShopFor(await shopDetailsService.get(orgId))),
      settle("setup", () => orgOnboardingService.status(orgId)),
      settle("parcels", () => widgetData(WIDGET.PARCELS, ctx)),
      settle("to pack", () => toPack(orgId)),
      settle("low stock", () => sellingLowStock(orgId, now)),
      settle("channel", async () => (await channelConnectionService.overview(orgId)).attention[0] ?? null),
      settle("stock", () => channelStockService.attention(orgId)),
      settle("photos", () => enhancementService.countAwaitingDecision(orgId)),
      settle("team edits", () => productTeamService.teamEditedSummary(orgId)),
      settle("paid orders", () => widgetData(WIDGET.PAID_ORDERS, ctx)),
    ]);
    return {
      shop,
      setup,
      attention: { toPack: toPackRead, lowStock, channel, stock, photos, teamEdits },
      hasPaidOrder: paidOrders.ok ? { ok: true, value: paidOrders.value.value > 0 } : paidOrders,
      widgets: {
        ...(parcels.ok ? { [WIDGET.PARCELS]: parcels.value } : {}),
        ...(paidOrders.ok ? { [WIDGET.PAID_ORDERS]: paidOrders.value } : {}),
      },
      readAt: now.toISOString(),
    };
  },
};
