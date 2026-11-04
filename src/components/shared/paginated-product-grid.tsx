"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ProductGrid, SkeletonProductGrid } from "@/components/shared/product-grid";
import { ThemedProductGrid, type ThemedGridStyle } from "@/components/storefront/themed/themed-product-grid";
import { Button } from "@/components/ui/button";
import type { Product } from "@/domain/product";
import { PRODUCT_PAGE_SIZE, type ProductPageQuery } from "@/lib/product-paging";
import { formatCount } from "@/lib/format";

/** Placeholders while the next page loads: a desktop row, two phone rows. */
const PLACEHOLDER_ROW = 4;
import { productPagesApiClient } from "@/components/product/productPagesApiClient";
import { PAGINATED_PRODUCT_GRID_COPY } from "./shared-copy";
import { PAGINATED_GRID_COPY } from "@/components/shared/shared-copy";

/**
 * The one product listing that loads as you scroll (design-system Q23): the first page is
 * server-rendered and handed in; the button is the control and the observer only presses it
 * early, since an observer that never fires would leave a shop looking like it sells twelve things.
 */
export function PaginatedProductGrid({
  initial,
  initiallyDone,
  query,
  emptyLabel,
  themed,
  total,
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
  /** The listing's full count, for "12 of 248" under the grid; omitted where the page does not read it. */
  total?: number;
}) {
  // `query` and `initial` are new on every render; this string changes only when the listing does.
  const queryKey = [
    query.handle ?? "",
    query.category ?? "",
    query.search ?? "",
    query.offersOnly ? "1" : "",
    query.heroOnly ? "1" : "",
    query.sort ?? "",
  ].join("\u0000");

  const [products, setProducts] = useState(initial);
  const [done, setDone] = useState(initiallyDone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const queryRef = useRef(query);
  queryRef.current = query;

  // A filter or sort change is a fresh server render; reset so its results never append under the old ones.
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
      // By id: a product added mid-scroll shifts the offset, and a page would repeat a row.
      setProducts((current) => {
        const seen = new Set(current.map((product) => product.id));
        return [...current, ...page.products.filter((p) => !seen.has(p.id))];
      });
      setDone(page.done);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : PAGINATED_GRID_COPY.loadFailed,
      );
    } finally {
      setLoading(false);
    }
    // `query` is read through the ref: a listing change already resets `products.length`.
  }, [loading, done, products.length]);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || done || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      // A screen early, so the next rows are usually there before they are reached.
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
          ? PAGINATED_GRID_COPY.loading
          : PAGINATED_GRID_COPY.shown(products.length, emptyLabel ?? PAGINATED_GRID_COPY.noun)}
      </p>

      {error && (
        <div role="alert" className="flex flex-col items-center gap-2">
          <p className="text-small text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void loadMore()}>
            {PAGINATED_PRODUCT_GRID_COPY.tryAgain}
          </Button>
        </div>
      )}

      {loading && !themed && <SkeletonProductGrid count={PLACEHOLDER_ROW} />}

      {!done && !error && total !== undefined && (
        <p className="text-center text-caption tabular-nums text-muted-foreground">
          {formatCount(products.length)} of {formatCount(total)} · more load as you scroll
        </p>
      )}

      {/* A fallback: the sentinel loads on scroll, but an observer that never fires must not end the list. */}
      {!done && !error && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadMore()}
            pending={loading}
          >
            {PAGINATED_PRODUCT_GRID_COPY.showMore}
          </Button>
        </div>
      )}

      {done && products.length > PRODUCT_PAGE_SIZE && (
        <p className="text-center text-caption text-muted-foreground">
          {PAGINATED_PRODUCT_GRID_COPY.thatIsEverything}
        </p>
      )}
    </div>
  );
}
