/**
 * What a storefront page reads (org-storefront R9, ADR-0030 decisions 5 and 7).
 *
 * Every read here runs for a stranger — these are the first org-scoped queries with no
 * membership behind them — so what a shop may show is decided by the repository's
 * select list, not by the components that render it. Nothing commercial reaches this
 * layer, which is why nothing downstream has to remember not to print it.
 */

import { cache } from "react";
import { orgRepository } from "@server/catalog/org.repository";
import { orgProfileRepository } from "@server/catalog/org-profile.repository";
import { productsRepository } from "@server/catalog/product.repository";
import { orgBannerRepository } from "@server/catalog/org-banner.repository";
import { storefrontService } from "@server/catalog/storefront.service";
import type { BrandPageDto } from "@server/catalog/storefront.types";
import type { HeroBannerContent } from "@/components/home/hero-banner";
import { isRenderableImageUrl } from "@server/catalog/image-paths";
import { categoriesDAL } from "@/data-access-layer/categories.dal";
import { productsDAL } from "@/data-access-layer/products.dal";
import type { Category } from "@/domain/category";
import type { Product } from "@/domain/product";
import { holdCutoff } from "@server/catalog/org.handle";

/** One shop, as a visitor sees it. */
export interface Storefront {
  id: string;
  handle: string;
  name: string;
  /** The long-form introduction; null until the owner writes one. */
  about: string | null;
  tagline: string | null;
  logoUrl: string | null;
  heroUrl: string | null;
  /** A palette token name, never a colour literal (ADR-0022). */
  accent: string | null;
  deliveryPolicy: string | null;
  returnsPolicy: string | null;
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
    return {
      id: profile.org.id,
      handle: profile.org.handle,
      name: profile.org.name,
      about: profile.description,
      tagline: profile.tagline,
      logoUrl: profile.logoUrl,
      heroUrl: profile.heroUrl,
      accent: profile.accent,
      deliveryPolicy: profile.deliveryPolicy,
      returnsPolicy: profile.returnsPolicy,
    };
  }),

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
      image: isRenderableImageUrl(row.imageUrl)
        ? { src: row.imageUrl, alt: row.imageAlt ?? row.title ?? "" }
        : undefined,
      // One action, labelled generically: an org sets where a promotion points, not
      // the words on the button, so there is one less field to get wrong.
      actions: row.href ? [{ label: "Shop now", href: row.href }] : undefined,
    }));
  }),

  /** Every shop open for business and with something to sell. */
  listShops: cache(async (): Promise<ShopListing[]> => {
    return await orgProfileRepository.listPublicShops();
  }),
};
