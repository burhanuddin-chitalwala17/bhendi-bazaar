import { orgOnboardingService } from "@server/catalog/org-onboarding.service";
import type { OnboardingStatus } from "@server/catalog/org-onboarding.types";
import { reviewService, type NewReviews } from "@server/catalog/review.service";
import { shopDetailsService } from "@server/catalog/shop-details.service";
import { DASHBOARD_WIDGETS, fetchWidget, type WidgetContext, type WidgetData } from "@server/analytics/widgets";
import { channelConnectionService } from "@server/channels/channel-connection.service";
import type { ChannelAttentionDTO } from "@server/channels/channel-connection.types";
import { enhancementService } from "@server/content/enhancement.service";
import { biddingService } from "@server/bidding/bidding.service";
import { isAcceptingBids } from "@server/bidding/bidding-window";
import { appUrl } from "@server/shared/app-url";

/** One line's read: a failure costs that line and shows its own retry, never the page (D7). */
export type HomeRead<T> = { ok: true; value: T } | { ok: false };

/** The two existing widgets Home reads a number from, by their registry key. */
const WIDGET = { PARCELS: "pending-parcels", PAID_ORDERS: "orders" } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface HomeAuction {
  productName: string;
  endsAt: string;
}

/** "Needs you now" (Q5, Q22, Q25): each line hides at zero, and fails alone. */
export interface HomeAttentionDto {
  parcels: HomeRead<number>;
  reviews: HomeRead<NewReviews>;
  channel: HomeRead<ChannelAttentionDTO | null>;
  photos: HomeRead<number>;
  auction: HomeRead<HomeAuction | null>;
}

export interface HomeData {
  shop: HomeRead<{ name: string; path: string; url: string }>;
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

const valueOf = (read: HomeRead<WidgetData>): HomeRead<number> =>
  read.ok ? { ok: true, value: read.value.value } : read;

/** A live auction ending within a day, soonest first. */
async function endingAuction(orgId: string, now: Date): Promise<HomeAuction | null> {
  const ending = (await biddingService.listForOrg(orgId))
    .filter((event) => isAcceptingBids(event, now) && event.endAt.getTime() - now.getTime() <= DAY_MS)
    .sort((a, b) => a.endAt.getTime() - b.endAt.getTime())[0];
  return ending ? { productName: ending.product.name, endsAt: ending.endAt.toISOString() } : null;
}

/** Home asks each area whether it needs the shop (own-store onboarding D7). */
export const homeDAL = {
  async forOrg(orgId: string, now: Date = new Date()): Promise<HomeData> {
    const ctx: WidgetContext = { audience: "org", orgId };
    const [shop, setup, parcels, reviews, channel, photos, auction, paidOrders] = await Promise.all([
      settle("shop", async () => {
        const details = await shopDetailsService.get(orgId);
        const path = `/store/${details.handle}`;
        return { name: details.name, path, url: `${appUrl()}${path}` };
      }),
      settle("setup", () => orgOnboardingService.status(orgId)),
      settle("parcels", () => widgetData(WIDGET.PARCELS, ctx)),
      settle("reviews", () => reviewService.newForOrg(orgId, now)),
      settle("channel", async () => (await channelConnectionService.overview(orgId)).attention[0] ?? null),
      settle("photos", () => enhancementService.countAwaitingDecision(orgId)),
      settle("auction", () => endingAuction(orgId, now)),
      settle("paid orders", () => widgetData(WIDGET.PAID_ORDERS, ctx)),
    ]);
    return {
      shop,
      setup,
      attention: { parcels: valueOf(parcels), reviews, channel, photos, auction },
      hasPaidOrder: paidOrders.ok ? { ok: true, value: paidOrders.value.value > 0 } : paidOrders,
      widgets: {
        ...(parcels.ok ? { [WIDGET.PARCELS]: parcels.value } : {}),
        ...(paidOrders.ok ? { [WIDGET.PAID_ORDERS]: paidOrders.value } : {}),
      },
      readAt: now.toISOString(),
    };
  },
};
