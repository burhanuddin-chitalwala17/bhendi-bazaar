import type { BrandPage } from "@/data-access-layer/storefront.dal";
import type { Category } from "@/domain/category";
import type { Product } from "@/domain/product";
import type { ShopReviewDto } from "@server/catalog/review.types";
import type { SocialLink } from "@server/catalog/social-networks";

/**
 * Which sections a brand page has, in the one order the platform sets (brand-page R1, D4).
 *
 * Each extractor answers "what does this section show" or null, and `brandPageSections`
 * is nothing but those answers in order. Emptiness is decided here and nowhere else, so
 * the page never branches on how much an org has written (R2), and a section that shows
 * nothing is absent rather than blank.
 *
 * Pure, so it can be tested without rendering. The proof strip is part of the hero, not a
 * section of its own (R3). Pillars join this list in part (b) of PR 4.
 */
export const BRAND_PAGE_SECTION_ORDER = [
  "hero",
  "story",
  "categories",
  "brands",
  "buyersSay",
  "newest",
  "policies",
  "social",
] as const;

export type BrandPageSection = (typeof BRAND_PAGE_SECTION_ORDER)[number];

export interface StorySlice {
  name: string;
  about: string | null;
  story: string | null;
}

export interface CategoriesSlice {
  handle: string;
  categories: Category[];
}

export interface BuyersSaySlice {
  reviews: ShopReviewDto[];
}

export interface NewestSlice {
  handle: string;
  name: string;
  products: Product[];
}

export interface PoliciesSlice {
  name: string;
  delivery: string | null;
  returns: string | null;
}

export interface SocialSlice {
  name: string;
  links: SocialLink[];
}

export const storySlice = (page: BrandPage): StorySlice | null =>
  page.about || page.story
    ? { name: page.name, about: page.about, story: page.story }
    : null;

export const categoriesSlice = (page: BrandPage): CategoriesSlice | null =>
  page.categories.length
    ? { handle: page.handle, categories: page.categories }
    : null;

export const brandsSlice = (page: BrandPage): string[] | null =>
  page.brands?.length ? page.brands : null;

/** The floor was applied where the DTO was built (D3); null here is "too few to be convincing". */
export const buyersSaySlice = (page: BrandPage): BuyersSaySlice | null =>
  page.buyersSay?.length ? { reviews: page.buyersSay } : null;

/**
 * Never null: a shop with nothing listed shows the honest "nothing here yet" state, which
 * is the storefront's first state and not a placeholder (brand-page A1, storefront-pages R7a).
 */
export const newestSlice = (page: BrandPage): NewestSlice => ({
  handle: page.handle,
  name: page.name,
  products: page.newest,
});

export const policiesSlice = (page: BrandPage): PoliciesSlice | null =>
  page.deliveryPolicy || page.returnsPolicy
    ? {
        name: page.name,
        delivery: page.deliveryPolicy,
        returns: page.returnsPolicy,
      }
    : null;

export const socialSlice = (page: BrandPage): SocialSlice | null =>
  page.social?.length ? { name: page.name, links: page.social } : null;

const SLICES = {
  hero: (page) => page,
  story: storySlice,
  categories: categoriesSlice,
  brands: brandsSlice,
  buyersSay: buyersSaySlice,
  newest: newestSlice,
  policies: policiesSlice,
  social: socialSlice,
} satisfies Record<BrandPageSection, (page: BrandPage) => unknown>;

/** The sections this page renders, in order — the ones whose slice is not null. */
export function brandPageSections(page: BrandPage): BrandPageSection[] {
  return BRAND_PAGE_SECTION_ORDER.filter((key) => SLICES[key](page) !== null);
}
