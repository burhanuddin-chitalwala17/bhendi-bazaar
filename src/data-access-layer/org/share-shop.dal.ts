import type { ShopDetailsDto } from "@server/catalog/shop-details.types";
import { appUrl } from "@server/shared/app-url";
import { storePreview, type ShareShop } from "@/lib/store-preview";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";

/** A missing origin costs the full link, not the page: the sheet falls back to the path. */
function absolute(path: string): string {
  try {
    return `${appUrl()}${path}`;
  } catch {
    return path;
  }
}

type ShareSource = Pick<ShopDetailsDto, "handle" | "name" | "tagline" | "about" | "logoUrl">;

/**
 * The shop's link and the card a chat shows for it (own-store onboarding D13). The public read
 * carries the hero image; a shop not yet public, or a failed read, previews from its own details.
 */
export async function shareShopFor(details: ShareSource): Promise<ShareShop> {
  const path = `/store/${details.handle}`;
  const live = await storefrontDAL.getByHandle(details.handle).catch(() => null);
  return {
    name: details.name,
    path,
    url: absolute(path),
    preview: storePreview(live ?? { ...details, heroUrl: null }),
  };
}
