import { orgAddressService } from "@server/catalog/org.address.service";
import { reviewService } from "@server/catalog/review.service";
import { shopDetailsService } from "@server/catalog/shop-details.service";
import { appUrl } from "@server/shared/app-url";
import { storefrontDAL, type BrandPage } from "@/data-access-layer/storefront.dal";

/** One row's read: a failure costs that row, never the hub (own-store onboarding D3). */
export type HubRead<T> = { ok: true; value: T } | { ok: false };

export interface ShopHubData {
  /** The shop's public path and full link, or null when its details could not be read. */
  link: { path: string; url: string } | null;
  name: string;
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

/** A missing origin costs the full link, not the page: the card falls back to the path. */
function absolute(path: string): string {
  try {
    return `${appUrl()}${path}`;
  } catch {
    return path;
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
    const [page, addresses, reviews] = await Promise.all([
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
      link: handle ? { path: `/store/${handle}`, url: absolute(`/store/${handle}`) } : null,
      name: detailsRead.ok ? detailsRead.value.name : "",
      details: detailsRead.ok
        ? { ok: true, value: { hasLogo: Boolean(detailsRead.value.logoUrl), hasTagline: Boolean(detailsRead.value.tagline?.trim()) } }
        : { ok: false },
      page,
      addresses,
      reviews,
    };
  },
};
