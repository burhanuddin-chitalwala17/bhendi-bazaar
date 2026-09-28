import { notFound, redirect } from "next/navigation";

import {
  storefrontDAL,
  type BrandPage,
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
  return await resolveOrLeave(handle, storefrontDAL.getByHandle, (current) => `/store/${current}`);
}

/** The brand page's resolve: same three answers, the redirect landing on the moved page. */
export async function resolveBrandPage(handle: string): Promise<BrandPage> {
  return await resolveOrLeave(
    handle,
    storefrontDAL.getBrandPage,
    (current) => `/store/${current}/about`,
  );
}

async function resolveOrLeave<T>(
  handle: string,
  read: (handle: string) => Promise<T | null>,
  movedTo: (current: string) => string,
): Promise<T> {
  const found = await read(handle);
  if (found) return found;

  const current = await storefrontDAL.currentHandleFor(handle);
  if (current) redirect(movedTo(current));

  notFound();
}
