import { orgAddressService } from "@server/catalog/org.address.service";
import { reviewService } from "@server/catalog/review.service";
import { shopDetailsService } from "@server/catalog/shop-details.service";
import { storefrontDAL, type BrandPage } from "@/data-access-layer/storefront.dal";
import type { ShareShop } from "@/lib/store-preview";
import { shareShopFor } from "./share-shop.dal";

/** One row's read: a failure costs that row, never the hub (own-store onboarding D3). */
export type HubRead<T> = { ok: true; value: T } | { ok: false };

export interface ShopHubData {
  /** The shop's link and its chat preview, or null when its details could not be read. */
  share: ShareShop | null;
  details: HubRead<{ hasLogo: boolean; hasTagline: boolean }>;
  page: HubRead<BrandPage | null>;
  /** `total` counts paused ones too: a shop with only paused addresses still needs the way to them. */
  addresses: HubRead<{ active: number; total: number }>;
  reviews: HubRead<{ count: number }>;
}

async function settle<T>(label: string, read: () => Promise<T>): Promise<HubRead<T>> {
  try {
    return { ok: true, value: await read() };
  } catch (error) {
    console.error(`[ShopHub] ${label} read failed:`, error);
    return { ok: false };
  }
}

/** What the Shop tab shows: each row reads its own source and fails alone. */
export const shopHubDAL = {
  async forOrg(orgId: string): Promise<ShopHubData> {
    const detailsRead = await settle("details", () => shopDetailsService.get(orgId));
    const handle = detailsRead.ok ? detailsRead.value.handle : null;
    // One rating read serves both rows; the page row treats a failed one as no reviews yet.
    const rating = reviewService.ratingForOrg(orgId);
    rating.catch(() => {});
    const [share, page, addresses, reviews] = await Promise.all([
      detailsRead.ok ? shareShopFor(detailsRead.value) : null,
      settle("page", async () =>
        handle ? storefrontDAL.brandPageForStanding(handle, await rating.catch(() => ({ average: null, count: 0 }))) : null,
      ),
      settle("addresses", async () => {
        const all = await orgAddressService.listLocations(orgId);
        return { active: all.filter((l) => l.isActive).length, total: all.length };
      }),
      settle("reviews", async () => ({ count: (await rating).count })),
    ]);
    return {
      share,
      details: detailsRead.ok
        ? { ok: true, value: { hasLogo: Boolean(detailsRead.value.logoUrl), hasTagline: Boolean(detailsRead.value.tagline?.trim()) } }
        : { ok: false },
      page,
      addresses,
      reviews,
    };
  },
};
