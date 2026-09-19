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
    const org = await orgRepository.findPublicByHandle(handle);
    if (!org) return null;
    return {
      id: org.id,
      handle: org.handle,
      name: org.name,
      about: org.description,
      tagline: org.tagline,
      logoUrl: org.logoUrl,
      heroUrl: org.heroUrl,
      accent: org.accent,
      deliveryPolicy: org.deliveryPolicy,
      returnsPolicy: org.returnsPolicy,
    };
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

  /** Every shop open for business and with something to sell. */
  listShops: cache(async (): Promise<ShopListing[]> => {
    return await orgRepository.listPublicShops();
  }),
};
