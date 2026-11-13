import type { ResponsiveImageDto } from "@server/catalog/image-framing";
import type { Product } from "@/domain/product";
import type { ShopReviewDto } from "@server/catalog/review.types";
import type { BrandOwner } from "@server/catalog/brand-page-sections";
import { RETURNS_PRESET_LABEL, type ReturnsPreset } from "@server/catalog/shop-details.types";
import type { BrandProof } from "@server/catalog/storefront.types";
import type { StorefrontOfferDto } from "@server/promotions/storefront-offers";
import type { HeroBannerContent } from "@/components/home/hero-banner";
import { LANDING_SHELF_LIMIT, SECTION, type HideableSection } from "@server/catalog/storefront-themes";
import { formatCount } from "@/lib/format";
import { APP_NAME } from "@/lib/config";
import { THEMED_COPY } from "./themed-copy";

/**
 * What a themed page's sections read (storefront-themes D8). The page DTO that fills it is
 * assembled server-side (D9); each section takes one slice, and emptiness is decided here so
 * a section with nothing to show is absent, never blank (R10, brand-page R2).
 */
export interface ThemedPageData {
  handle: string;
  name: string;
  logoUrl: string | null;
  /** Up to three, the first being what a link preview shows. */
  heroPhotos: string[];
  /** The same photos framed for phone and desktop (image-slots D10); empty for a pre-editor cover. */
  heroImages?: ResponsiveImageDto[];
  heroLine: string | null;
  tagline: string | null;
  /** Everything on sale, for "Shop all {n}". */
  productCount: number;
  bestSelling: Product[];
  newIn: Product[];
  /** The shop's running offers (Q12) and the goods priced below list (ADR-0018). */
  offers: StorefrontOfferDto[];
  dealProducts: Product[];
  /** The shop's active banners, title and link included (storefront-themes Q14); absent reads as none. */
  banners?: HeroBannerContent[];
  collections: CollectionTile[];
  proof: BrandProof | null;
  since: number;
  /** Derived, never typed; null with no data (Q22). */
  dispatchDays: number | null;
  returns: { preset: ReturnsPreset; note: string | null } | null;
  /** Picked from the category's fixed list (Q21); labels already resolved. */
  claims: ShopClaim[];
  about: string | null;
  owner: BrandOwner | null;
  reviews: ShopReviewDto[] | null;
  area: string | null;
  /** Today's hours, already worded ("10:30 am – 9 pm"); null when the shop gave none. */
  hoursToday: string | null;
  hiddenSections: HideableSection[];
}

export interface CollectionTile {
  slug: string;
  name: string;
  photoUrl: string | null;
  /** The shop's own framed photo (image-slots D10); without it the tile draws `photoUrl`. */
  image?: ResponsiveImageDto | null;
}

export interface ShopClaim {
  label: string;
  detail: string | null;
}

export { LANDING_SHELF_LIMIT };
/** Q34: too few is not "best". */
export const MIN_BEST_SELLING = 4;
export const COLLECTIONS_LIMIT = 6;

export interface HeroSlice {
  handle: string;
  name: string;
  logoUrl: string | null;
  photoUrl: string | null;
  /** The first hero photo framed for phone and desktop (image-slots D10). */
  image: ResponsiveImageDto | null;
  /** Daily's rail: the shop's banners first, then its hero photos (storefront-look D3). */
  slides: HeroSlide[];
  line: string | null;
  since: number;
  productCount: number;
  /** Derived, above brand-page's floor, or null (storefront-themes Q15). */
  rating: { average: number; count: number } | null;
  /** What fills the hero's side (storefront-look Q11): best selling in stock, then new in. */
  featured: Product[];
  /** Derived facts only, for Daily's trust strip (storefront-themes Q21). */
  trust: string[];
}

export interface HeroSlide {
  key: string;
  src: string | null;
  image: ResponsiveImageDto | null;
  /** A banner's own title and link, drawn on a solid label below the picture (storefront-look Q3). */
  title: string | null;
  href: string | null;
  actionLabel: string | null;
}

/** The most a hero shows beside its photo (storefront-look D3: Bloom's row of four). */
export const HERO_FEATURED_MAX = 4;
/** Daily shows a main slide and two beside it (storefront-look D3). */
export const HERO_SLIDES_MAX = 3;

export interface ShelfSlice {
  handle: string;
  products: Product[];
  productCount: number;
}

export interface DealsSlice {
  handle: string;
  offers: StorefrontOfferDto[];
  products: Product[];
}

export interface CollectionsSlice {
  handle: string;
  tiles: CollectionTile[];
}

export interface WhyBuyFact {
  key: "rating" | "orders" | "dispatch" | "returns" | "since";
  text: string;
  /** The returns note, beneath the preset (Q22). */
  note?: string | null;
}

export interface WhyBuySlice {
  facts: WhyBuyFact[];
  claims: ShopClaim[];
}

export interface StorySlice {
  name: string;
  about: string | null;
  owner: BrandOwner | null;
}

export interface ReviewsSlice {
  handle: string;
  reviews: ShopReviewDto[];
}

export interface VisitSlice {
  name: string;
  area: string | null;
  hoursToday: string | null;
  dispatchDays: number | null;
  returns: { preset: ReturnsPreset; note: string | null } | null;
}

const hidden = (page: ThemedPageData, section: HideableSection) =>
  page.hiddenSections.includes(section);

export const heroSlice = (page: ThemedPageData): HeroSlice => ({
  handle: page.handle,
  name: page.name,
  logoUrl: page.logoUrl,
  photoUrl: page.heroPhotos[0] ?? null,
  image: page.heroImages?.[0] ?? null,
  slides: heroSlides(page),
  line: page.heroLine ?? page.tagline,
  since: page.since,
  productCount: page.productCount,
  rating: page.proof?.rating ?? null,
  featured: featuredProducts(page, HERO_FEATURED_MAX),
  trust: trustFacts(page),
});

/** Best selling first, then new in, never sold out and never twice (storefront-look Q11). */
export function featuredProducts(page: ThemedPageData, max: number): Product[] {
  const seen = new Set<string>();
  const picked: Product[] = [];
  for (const product of [...page.bestSelling, ...page.newIn]) {
    if (picked.length === max) break;
    if (product.stock <= 0 || seen.has(product.id)) continue;
    seen.add(product.id);
    picked.push(product);
  }
  return picked;
}

function heroSlides(page: ThemedPageData): HeroSlide[] {
  const banners: HeroSlide[] = (page.banners ?? [])
    .filter((banner) => banner.image)
    .map((banner) => ({
      key: `banner-${banner.id}`,
      src: null,
      image: banner.image ?? null,
      title: banner.title ?? null,
      href: banner.actions?.[0]?.href ?? null,
      actionLabel: banner.actions?.[0]?.label ?? null,
    }));
  const photos: HeroSlide[] = page.heroPhotos.map((src, index) => ({
    key: `photo-${index}`,
    src,
    image: page.heroImages?.[index] ?? null,
    title: null,
    href: null,
    actionLabel: null,
  }));
  return [...banners, ...photos].slice(0, HERO_SLIDES_MAX);
}

/** Facts the platform knows, in the order a buyer weighs them; never typed (storefront-themes Q21, Q22). */
function trustFacts(page: ThemedPageData): string[] {
  const facts: string[] = [];
  if (page.returns) facts.push(returnsText(page.returns.preset));
  if (page.dispatchDays != null) facts.push(THEMED_COPY.facts.ships(dispatchWithin(page.dispatchDays)));
  const orders = page.proof?.ordersFulfilled;
  if (orders != null) facts.push(THEMED_COPY.facts.ordersDelivered(formatCount(orders)));
  return facts;
}

export const collectionsSlice = (page: ThemedPageData): CollectionsSlice | null =>
  page.collections.length && !hidden(page, SECTION.COLLECTIONS)
    ? { handle: page.handle, tiles: page.collections.slice(0, COLLECTIONS_LIMIT) }
    : null;

export const bestSellingSlice = (page: ThemedPageData): ShelfSlice | null =>
  page.bestSelling.length >= MIN_BEST_SELLING
    ? {
        handle: page.handle,
        products: page.bestSelling.slice(0, LANDING_SHELF_LIMIT),
        productCount: page.productCount,
      }
    : null;

export const newInSlice = (page: ThemedPageData): ShelfSlice | null =>
  page.newIn.length
    ? {
        handle: page.handle,
        products: page.newIn.slice(0, LANDING_SHELF_LIMIT),
        productCount: page.productCount,
      }
    : null;

/** R7: a shop with no offer and nothing reduced shows no deals section. */
export const dealsSlice = (page: ThemedPageData): DealsSlice | null =>
  page.offers.length || page.dealProducts.length
    ? { handle: page.handle, offers: page.offers, products: page.dealProducts.slice(0, LANDING_SHELF_LIMIT) }
    : null;

/**
 * Facts the platform knows, each under its floor where the DTO was built (Q15, R8). Since-when
 * and the returns preset are true of every shop, so they ride along but never make the section
 * on their own: a strip of only those would be filler, not a reason to buy.
 */
export function whyBuySlice(page: ThemedPageData): WhyBuySlice | null {
  const earned: WhyBuyFact[] = [];
  const rating = page.proof?.rating;
  if (rating) {
    earned.push({ key: "rating", text: `★ ${rating.average} from ${formatCount(rating.count)} reviews` });
  }
  const orders = page.proof?.ordersFulfilled;
  if (orders != null) {
    earned.push({ key: "orders", text: THEMED_COPY.facts.ordersDelivered(formatCount(orders)) });
  }
  if (page.dispatchDays != null) {
    earned.push({ key: "dispatch", text: THEMED_COPY.facts.ships(dispatchWithin(page.dispatchDays)) });
  }
  if (!earned.length && !page.claims.length) return null;

  const always: WhyBuyFact[] = [{ key: "since", text: `On ${APP_NAME} since ${page.since}` }];
  if (page.returns) {
    always.push({ key: "returns", text: returnsText(page.returns.preset), note: page.returns.note });
  }
  return { facts: [...earned, ...always], claims: page.claims.slice(0, 3) };
}

export const storySlice = (page: ThemedPageData): StorySlice | null =>
  (page.about || page.owner) && !hidden(page, SECTION.STORY)
    ? { name: page.name, about: page.about, owner: page.owner }
    : null;

export const reviewsSlice = (page: ThemedPageData): ReviewsSlice | null =>
  page.reviews?.length ? { handle: page.handle, reviews: page.reviews } : null;

/** Never empty while shown: "Contact us" always has somewhere to go (Q22). */
export const visitSlice = (page: ThemedPageData): VisitSlice | null =>
  hidden(page, SECTION.VISIT)
    ? null
    : {
        name: page.name,
        area: page.area,
        hoursToday: page.hoursToday,
        dispatchDays: page.dispatchDays,
        returns: page.returns,
      };

export const returnsText = (preset: ReturnsPreset) => RETURNS_PRESET_LABEL[preset];

/** dispatchDays is derived, so a fast shop reaches 1 or 0 (Q38). */
export const dispatchWithin = (days: number) =>
  days <= 0 ? "today" : `in ${days} ${days === 1 ? "day" : "days"}`;
