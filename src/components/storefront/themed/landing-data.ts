import type { StorefrontPage } from "@/data-access-layer/storefront.dal";
import type { ThemedPageData } from "./page-data";

/**
 * A themed landing page's DTO as its sections read it (D8, D9). The hero line, claims, opening
 * hours, chosen collections and hidden themed sections arrive with the editor (unit 6); until
 * then each is empty, so its section closes up or draws the pattern (R10).
 */
export function themedPageData(page: StorefrontPage): ThemedPageData {
  return {
    handle: page.handle,
    name: page.name,
    logoUrl: page.logoUrl,
    heroPhotos: page.heroUrl ? [page.heroUrl] : [],
    heroLine: null,
    tagline: page.tagline,
    productCount: page.productCount,
    bestSelling: page.bestSelling,
    newIn: page.newIn,
    collections: page.categories.map((category) => ({ slug: category.slug, name: category.name, photoUrl: null })),
    proof: page.proof,
    since: page.since,
    dispatchDays: page.dispatchDays,
    returns: page.returns,
    claims: [],
    about: page.about,
    owner: page.owner,
    reviews: page.buyersSay,
    area: page.location,
    hoursToday: null,
    hiddenSections: [],
  };
}
