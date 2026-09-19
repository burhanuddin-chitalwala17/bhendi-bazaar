import { z } from "zod";

/**
 * How many products any listing asks for at a time.
 *
 * One number for the storefront, the category pages, search and offers — read by the
 * page that renders the first batch, the route that serves the rest, and the grid that
 * decides when to stop asking. Those three must agree: a page sized differently from
 * the route's would make "a short page means the end" wrong, and the grid would either
 * stop early or ask forever.
 *
 * Twelve is four rows at the phone's 3-up grid (ADR-0016) — enough that the first
 * screenful is full and the next is one fetch away.
 */
export const PRODUCT_PAGE_SIZE = 12;

/**
 * What a listing carries forward when it asks for more.
 *
 * Deliberately **no `orgId`**. A shop is named by its public handle and resolved on the
 * server; an org id arriving from a browser is the one thing that could widen a
 * storefront listing past its own shop (ADR-0030 decision 6).
 */
export interface ProductPageQuery {
  /** A shop's public handle, when the listing belongs to one storefront. */
  handle?: string;
  category?: string;
  search?: string;
  offersOnly?: boolean;
}

/**
 * The same shape as the route sees it. Parsed, never cast (Invariant 4) — and `offset`
 * is capped, because an unbounded one turns a listing into a bulk export.
 */
export const productPageParams = z.object({
  offset: z.coerce.number().int().min(0).max(5_000).default(0),
  handle: z.string().trim().min(1).max(60).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  offers: z.literal("1").optional(),
});

/** Build the query string for one more page of `query`, starting at `offset`. */
export function productPageUrl(
  query: ProductPageQuery,
  offset: number,
): string {
  const params = new URLSearchParams({ offset: String(offset) });
  if (query.handle) params.set("handle", query.handle);
  if (query.category) params.set("category", query.category);
  if (query.search) params.set("q", query.search);
  if (query.offersOnly) params.set("offers", "1");
  return `/api/products?${params}`;
}
