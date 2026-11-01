"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ProductGrid } from "@/components/shared/product-grid";
import { ThemedProductGrid, type ThemedGridStyle } from "@/components/storefront/themed/themed-product-grid";
import { Button } from "@/components/ui/button";
import type { Product } from "@/domain/product";
import { PRODUCT_PAGE_SIZE, type ProductPageQuery } from "@/lib/product-paging";
import { productPagesApiClient } from "@/components/product/productPagesApiClient";

/**
 * The one product listing that loads as you scroll.
 *
 * Every grid in the store goes through this — a shop's catalogue, a category, a search,
 * the offers page — so there is one fetch, one page size and one set of failure states
 * rather than four that drift.
 *
 * The **first page is rendered on the server** and handed in, so a shared link shows
 * products in its first paint and a visitor whose JavaScript never arrives still sees a
 * full screenful rather than a spinner.
 *
 * `"use client"` is earned here and pushed no further: accumulating pages and watching
 * an element is the only part of a listing that needs a browser.
 *
 * A **button as well as the observer**, always rendered while there is more. An observer
 * that never fires — an old browser, a scroll container that confuses it, a page in a
 * background tab — would otherwise leave a shop looking like it sells twelve things.
 * The button is the control; the observer only presses it early.
 */
export function PaginatedProductGrid({
  initial,
  initiallyDone,
  query,
  emptyLabel,
  themed,
}: {
  initial: Product[];
  /** The server already knows whether its first page was the last one. */
  initiallyDone: boolean;
  /** What this listing is, carried forward when it asks for more. */
  query: ProductPageQuery;
  /** Announced to a screen reader with the running count. */
  emptyLabel?: string;
  /** A themed shop's page draws its theme's card (storefront-themes D8); the fetching is the same. */
  themed?: ThemedGridStyle;
}) {
  // Every caller builds `query` inline, so its identity changes on each render and
  // `initial` is a fresh array from each RSC payload. Depending on either directly
  // would re-run the effects below constantly — and the reset one would throw away
  // pages the shopper had already loaded. A string of what actually identifies this
  // listing is stable across renders and changes exactly when the listing does.
  const queryKey = [
    query.handle ?? "",
    query.category ?? "",
    query.search ?? "",
    query.offersOnly ? "1" : "",
    query.heroOnly ? "1" : "",
  ].join("\u0000");

  const [products, setProducts] = useState(initial);
  const [done, setDone] = useState(initiallyDone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const queryRef = useRef(query);
  queryRef.current = query;

  // Filters live in the URL, so changing one is a fresh server render. Resetting on
  // that is what stops a category switch appending its results underneath the previous
  // category's — keyed on the listing rather than the array, so an unrelated re-render
  // cannot discard loaded pages.
  const latest = useRef({ initial, initiallyDone });
  latest.current = { initial, initiallyDone };
  useEffect(() => {
    setProducts(latest.current.initial);
    setDone(latest.current.initiallyDone);
    setError(null);
  }, [queryKey]);

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    setError(null);
    try {
      const page = await productPagesApiClient.next(
        queryRef.current,
        products.length,
      );
      // Filtered by id rather than concatenated blindly: a product added while someone
      // is scrolling shifts every later row by one, and an offset page would then
      // repeat whichever row moved across the boundary.
      setProducts((current) => {
        const seen = new Set(current.map((product) => product.id));
        return [...current, ...page.products.filter((p) => !seen.has(p.id))];
      });
      setDone(page.done);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load more. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
    // `query` is read through the ref rather than listed here: its identity changes
    // every render, and what it names is already covered — a listing change resets
    // `products`, which moves `products.length`.
  }, [loading, done, products.length]);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || done || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      // Starts a screen early, so the next rows are usually already there by the time
      // a shopper scrolls to them.
      { rootMargin: "600px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, done]);

  return (
    <div className="space-y-4">
      {themed ? <ThemedProductGrid products={products} {...themed} /> : <ProductGrid products={products} />}

      <div ref={sentinel} aria-hidden className="h-px" />

      {/* One live region: a screen reader is told the count grew, rather than nothing. */}
      <p aria-live="polite" className="sr-only">
        {loading
          ? "Loading more products"
          : `${products.length} ${emptyLabel ?? "products"} shown`}
      </p>

      {error && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void loadMore()}>
            Try again
          </Button>
        </div>
      )}

      {!done && !error && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadMore()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Show more"}
          </Button>
        </div>
      )}

      {done && products.length > PRODUCT_PAGE_SIZE && (
        <p className="text-center text-2xs text-muted-foreground">
          That is everything.
        </p>
      )}
    </div>
  );
}
