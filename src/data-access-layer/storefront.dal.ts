/**
 * What a storefront page reads (org-storefront R9, ADR-0030 decisions 5 and 7).
 *
 * Every read here runs for a stranger — these are the first org-scoped queries with no
 * membership behind them — so what a shop may show is decided by the repository's
 * select list, not by the components that render it. Nothing commercial reaches this
 * layer, which is why nothing downstream has to remember not to print it.
 */

import { STOREFRONT_DAL_COPY } from "./dal-copy";
import { cache } from "react";
import { orgRepository } from "@server/catalog/org.repository";
import { orgProfileRepository } from "@server/catalog/org-profile.repository";
import { productsRepository } from "@server/catalog/product.read.repository";
import { orgBannerRepository } from "@server/catalog/org-banner.repository";
import { storefrontService } from "@server/catalog/storefront.service";
import {
  aboutOf,
  type BrandPageDto,
  type StorefrontPageDto,
} from "@server/catalog/storefront.types";
import {
  LANDING_SHELF_LIMIT,
  readStorefrontLook,
  type PaletteKey,
  type StorefrontLook,
  type ThemeKey,
} from "@server/catalog/storefront-themes";
import type { HeroBannerContent } from "@/components/home/hero-banner";
import { toResponsiveImage } from "@server/catalog/image-framing";
import { categoriesDAL } from "@/data-access-layer/categories.dal";
import { productsDAL } from "@/data-access-layer/products.dal";
import type { Category } from "@/domain/category";
import type { Product } from "@/domain/product";
import { holdCutoff } from "@server/catalog/org.handle";
import { chromeShopFor } from "@/lib/storefront-chrome";
import type { OrgRating } from "@server/catalog/review-rating";
import { promotionService } from "@server/promotions/promotion.service";
import { storefrontAccessDAL } from "@/data-access-layer/storefront-access.dal";
import type { StorefrontOfferDto } from "@server/promotions/storefront-offers";

/** One shop, as a visitor sees it. */
export interface Storefront {
  id: string;
  handle: string;
  name: string;
  /** "About your shop" (org-profile D4); null until the owner writes one. */
  about: string | null;
  tagline: string | null;
  logoUrl: string | null;
  heroUrl: string | null;
  /** A palette token name, never a colour literal (ADR-0022). */
  accent: string | null;
  /** The published look, parsed (storefront-themes D1); both null for an unthemed shop. */
  themeKey: ThemeKey | null;
  paletteKey: PaletteKey | null;
}

/** A themed landing page as its sections read it: the DTO plus the goods, priced here (ADR-0018). */
export interface StorefrontPage extends StorefrontPageDto {
  bestSelling: Product[];
  newIn: Product[];
  categories: Category[];
  /** Everything on sale, for "Shop all {n}". */
  productCount: number;
  /** The shop's running offers, worded by promotions (D10; Q12, Q13, Q20). */
  offers: StorefrontOfferDto[];
  /** Goods the one resolver prices below list, for the deals strip (Q12, ADR-0018). */
  dealProducts: Product[];
}

/**
 * The brand page as its sections read it: the profile's public face (brand-page D1) plus
 * the marketplace's own tiles (D5). The tiles are the landing page's reads, so a price, an
 * offer and a bidding suspension on this page are the ones the storefront shows (R6).
 */
export interface BrandPage extends BrandPageDto {
  /** The categories this shop sells in — empty for a shop with nothing listed. */
  categories: Category[];
  /** The newest goods, newest first, capped at `NEWEST_GOODS_ON_BRAND_PAGE`. */
  newest: Product[];
}

/** Two rows of the 3-up phone grid (ADR-0016): a taste, with "see all" for the rest. */
export const NEWEST_GOODS_ON_BRAND_PAGE = 6;

/** A row in the shop directory. */
export interface ShopListing {
  handle: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  /** A themed shop's goods live at `/shop`, its story on the landing page (Q3). */
  themed: boolean;
}

/** A landing page's goods, priced here (ADR-0018), around the service's DTO. */
async function storefrontPageFrom(dto: StorefrontPageDto | null): Promise<StorefrontPage | null> {
  if (!dto) return null;
  const [bestSold, newIn, categories, productCount, offers, dealProducts] = await Promise.all([
    dto.bestSellingIds.length
      ? productsDAL.getProducts({ orgId: dto.id, ids: dto.bestSellingIds })
      : Promise.resolve([]),
    productsDAL.getProducts({ orgId: dto.id, limit: LANDING_SHELF_LIMIT }),
    storefrontDAL.categoriesFor(dto.id),
    storefrontDAL.productCountFor(dto.id),
    // Asked here, never by storefrontService: an offer is promotions' to word (D10).
    promotionService.storefrontOffers(dto.id),
    productsDAL.getProducts({ orgId: dto.id, offerOnly: true, ownOffersOnly: true, limit: LANDING_SHELF_LIMIT }),
  ]);
  const rank = new Map(dto.bestSellingIds.map((id, index) => [id, index]));
  const bestSelling = [...bestSold].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  return { ...dto, bestSelling, newIn, categories, productCount, offers, dealProducts };
}

export const storefrontDAL = {
  /**
   * The shop at this handle, or null.
   *
   * Memoised per request: a storefront page and its metadata both need the shop, and
   * Next calls `generateMetadata` and the page separately — without this that is two
   * identical queries on every storefront view.
   */
  getByHandle: cache(async (handle: string): Promise<Storefront | null> => {
    const profile = await orgProfileRepository.findPublicByHandle(handle);
    if (!profile) return null;
    const look = readStorefrontLook(profile.themeKey, profile.paletteKey);
    return {
      id: profile.org.id,
      handle: profile.org.handle,
      name: profile.org.name,
      about: aboutOf(profile),
      tagline: profile.tagline,
      logoUrl: profile.logoUrl,
      heroUrl: profile.heroUrl,
      accent: profile.accent,
      themeKey: look?.theme ?? null,
      paletteKey: look?.palette ?? null,
    };
  }),

  /**
   * A themed shop's landing page, or null when it has published no look (Q19). Memoised: the
   * route's metadata and its page both read it. Best selling is priced in the service's order;
   * a product that left sale since it sold simply drops out.
   */
  getStorefrontPage: cache(async (handle: string): Promise<StorefrontPage | null> => {
    return await storefrontPageFrom(await storefrontService.storefrontPage(handle));
  }),

  /**
   * The landing page in a look its owner is trying (D12), published or not: the same reads a
   * buyer's page makes, so the preview is the page, not a picture of it.
   */
  getStorefrontPreview: async (handle: string, look: StorefrontLook): Promise<StorefrontPage | null> => {
    return await storefrontPageFrom(await storefrontService.storefrontPage(handle, look));
  },

  /**
   * The shop's brand page, or null. Memoised for the same reason as `getByHandle`: the
   * route's metadata and its page both read it in one request.
   */
  getBrandPage: cache(async (handle: string): Promise<BrandPage | null> => {
    const dto = await storefrontService.brandPage(handle);
    if (!dto) return null;
    const [categories, newest] = await Promise.all([
      storefrontDAL.categoriesFor(dto.id),
      // Scoped by the id resolved from the handle, never by anything in the URL
      // (ADR-0030 decision 6). Newest first is the listing's default order.
      productsDAL.getProducts({ orgId: dto.id, limit: NEWEST_GOODS_ON_BRAND_PAGE }),
    ]);
    return { ...dto, categories, newest };
  }),

  /**
   * Enough of the brand page to say which sections show, for the shop's own status line: the
   * section facts and the categories, not the priced goods (the newest section always shows).
   */
  brandPageForStanding: async (handle: string, rating: OrgRating): Promise<BrandPage | null> => {
    const dto = await storefrontService.brandPageSectionFacts(handle, rating);
    if (!dto) return null;
    return { ...dto, categories: await storefrontDAL.categoriesFor(dto.id), newest: [] };
  },

  /**
   * Where a retired handle should send a visitor, or null once its hold has lapsed.
   *
   * Asked only after `getByHandle` has come back empty, so the cost falls on the rare
   * request rather than every one.
   */
  currentHandleFor: cache(async (retired: string): Promise<string | null> => {
    return await orgRepository.findCurrentHandleForRetired(
      retired,
      holdCutoff(),
    );
  }),

  /**
   * The categories this shop actually sells in (storefront-browse R2).
   *
   * Intersected with the platform tree rather than read from it: the taxonomy is
   * platform-owned and most of it is empty for any one shop, so a bar built from the
   * tree would offer a shopper categories with nothing behind them.
   */
  categoriesFor: cache(async (orgId: string): Promise<Category[]> => {
    const [ids, all] = await Promise.all([
      productsRepository.categoryIdsForOrg(orgId),
      categoriesDAL.getCategories(),
    ]);
    const owned = new Set(ids);
    // Whole rows, not a reduced shape: a shop's rail is the platform's `CategoryLanes`
    // with a different destination, and that wants the hero image and accent too.
    return all.filter((category) => owned.has(category.id));
  }),

  /**
   * The promotions this shop is running, in its chosen order, as the platform's own
   * hero content.
   *
   * Mapped to `HeroBannerContent` rather than rendered by a second banner component:
   * a shop's promotion and the platform's are the same thing on the same page shape,
   * and the hand-rolled version that briefly existed here looked worse for no reason.
   */
  promotionsFor: cache(async (orgId: string): Promise<HeroBannerContent[]> => {
    const rows = await orgBannerRepository.listActiveForOrg(orgId);
    return rows.map((row) => ({
      id: row.id,
      title: row.title ?? undefined,
      description: row.description ?? undefined,
      image: toResponsiveImage(row, row.imageAlt ?? row.title ?? "") ?? undefined,
      // One action, labelled generically: an org sets where a promotion points, not
      // the words on the button, so there is one less field to get wrong.
      actions: row.href ? [{ label: STOREFRONT_DAL_COPY.shopNow, href: row.href }] : undefined,
    }));
  }),

  /**
   * The themed shop whose chrome a product page keeps (Q33), or null: the shop must have
   * published a look and the product must be its own, whatever the URL claimed.
   */
  chromeShopForProduct: async (handle: string, slug: string): Promise<Storefront | null> => {
    const [shop, productOrgId] = await Promise.all([
      storefrontDAL.getByHandle(handle),
      productsRepository.orgIdForSlug(slug),
    ]);
    return chromeShopFor(shop?.themeKey ? shop : null, productOrgId);
  },

  /** Everything this shop has on sale, for "Shop all {n}" (Q23). */
  productCountFor: cache(async (orgId: string): Promise<number> => {
    return await productsRepository.countOnSaleForOrg(orgId);
  }),

  /**
   * Every shop open for business, with something to sell, and holding Storefront: the `/store`
   * directory and the sitemap (subscriptions/feature-access D10, Q7). Which hold it is asked of
   * `storefrontAccessDAL`, so this file keeps to catalog and promotions.
   */
  listShops: cache(async (): Promise<ShopListing[]> => {
    const rows = await orgProfileRepository.listPublicShops();
    const open = await storefrontAccessDAL.openAmong(rows.map((r) => r.orgId));
    return rows
      .filter((row) => open.has(row.orgId))
      .map(({ themeKey, orgId: _orgId, ...shop }) => ({
        ...shop,
        themed: readStorefrontLook(themeKey, null) !== null,
      }));
  }),

};
