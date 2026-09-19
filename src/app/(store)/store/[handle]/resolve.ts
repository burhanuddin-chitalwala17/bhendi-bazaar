import { notFound, redirect } from "next/navigation";

import {
  storefrontDAL,
  type Storefront,
} from "@/data-access-layer/storefront.dal";

/**
 * Turn a handle in the URL into the shop it names, or leave the page.
 *
 * Three answers, in the order they cost (ADR-0030 decision 4):
 *  - a live shop, returned;
 *  - a handle it used to hold and still holds the lease on → a permanent redirect to
 *    where the shop lives now, so a card printed last quarter still arrives;
 *  - anything else → 404. Not 410: a released handle may belong to another shop later,
 *    and 410 tells a crawler the address is gone for good.
 *
 * The history lookup runs only after the live one misses, so the extra query falls on
 * the rare request rather than every storefront view.
 */
export async function resolveStorefront(handle: string): Promise<Storefront> {
  const shop = await storefrontDAL.getByHandle(handle);
  if (shop) return shop;

  const current = await storefrontDAL.currentHandleFor(handle);
  if (current) redirect(`/store/${current}`);

  notFound();
}
