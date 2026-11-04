import type { StorefrontPage } from "@/data-access-layer/storefront.dal";
import { hoursToday } from "@server/catalog/storefront-hours";
import { SECTION } from "@server/catalog/storefront-themes";
import type { ThemedPageData } from "./page-data";

/**
 * A themed landing page's DTO as its sections read it (D8, D9). What the shop left empty stays
 * empty, so its section closes up or draws the pattern (R10); collections it never picked are the
 * categories it sells in, unless it hid the section.
 */
export function themedPageData(page: StorefrontPage, now: Date = new Date()): ThemedPageData {
  const picked = page.collections.length > 0;
  const collectionsHidden = page.themedHiddenSections.includes(SECTION.COLLECTIONS);
  return {
    handle: page.handle,
    name: page.name,
    logoUrl: page.logoUrl,
    // A cover chosen before the editor existed still fills the hero (Q11: nothing a shop gave is lost).
    heroPhotos: page.heroPhotos.length ? page.heroPhotos : page.heroUrl ? [page.heroUrl] : [],
    heroImages: page.heroPhotos.length ? page.heroImages : [],
    heroLine: page.heroLine,
    tagline: page.tagline,
    productCount: page.productCount,
    bestSelling: page.bestSelling,
    newIn: page.newIn,
    offers: page.offers,
    dealProducts: page.dealProducts,
    collections: picked || collectionsHidden
      ? page.collections
      : page.categories.map((category) => ({ slug: category.slug, name: category.name, photoUrl: category.heroImage || null })),
    proof: page.proof,
    since: page.since,
    dispatchDays: page.dispatchDays,
    returns: page.returns,
    claims: page.claims,
    about: page.about,
    owner: page.owner,
    reviews: page.buyersSay,
    area: page.location,
    hoursToday: hoursToday(page.openingHours, now),
    hiddenSections: page.themedHiddenSections,
  };
}
