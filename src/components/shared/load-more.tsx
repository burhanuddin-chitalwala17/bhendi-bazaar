"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { LOAD_MORE_COPY } from "./shared-copy";

interface LoadMoreProps {
  onMore: () => void;
  done: boolean;
  loading: boolean;
  error: string | null;
  /** What is being counted, for the screen-reader line: "24 photos shown". */
  count: number;
  noun: string;
}

/**
 * Scrolling pagination's tail: a sentinel the observer watches, and a button as the control the
 * observer only presses early. The button is always there while there is more — an observer
 * that never fires (an old browser, a background tab, a confused scroll container) would
 * otherwise leave a list looking finished. Same reasoning as `paginated-product-grid.tsx`.
 */
export function LoadMore({ onMore, done, loading, error, count, noun }: LoadMoreProps) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || done || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading) onMore();
      },
      // A screen early, so the next rows are usually there by the time they are reached.
      { rootMargin: "600px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [onMore, done, loading]);

  return (
    <div className="space-y-2">
      <div ref={sentinel} aria-hidden className="h-px" />
      <p aria-live="polite" className="sr-only">
        {loading ? `Loading more ${noun}` : `${count} ${noun} shown`}
      </p>
      {error && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-small text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={onMore}>
            {LOAD_MORE_COPY.tryAgain}
          </Button>
        </div>
      )}
      {!done && !error && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" size="sm" onClick={onMore} pending={loading}>
            {LOAD_MORE_COPY.showMore}
          </Button>
        </div>
      )}
    </div>
  );
}
