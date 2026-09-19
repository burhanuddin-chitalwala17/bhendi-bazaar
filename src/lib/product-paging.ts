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
 * How a listing may be ordered.
 *
 * `newest` is the default everywhere and the only one the database can serve directly.
 * The price sorts are by the **offer price** — what a shopper is actually asked to pay
 * — which no column holds, so they are resolved and ordered in memory over the row cap
 * (`productsDAL.getPage`). Ordering by the `price` column instead would put an item
 * reduced from ₹1,000 to ₹350 where ₹1,000 belongs.
 */
export const PRODUCT_SORTS = ["newest", "price-asc", "price-desc"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  newest: "New arrivals",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
};

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
  /** Absent means `newest` — the default a shopper gets without asking. */
  sort?: ProductSort;
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
  sort: z.enum(PRODUCT_SORTS).default("newest"),
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
  // Omitted when it is the default, so a plain listing's URL stays plain.
  if (query.sort && query.sort !== "newest") params.set("sort", query.sort);
  return `/api/products?${params}`;
}
