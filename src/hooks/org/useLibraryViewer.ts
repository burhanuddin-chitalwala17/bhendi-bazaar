"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MEDIA_VIEWER_COPY } from "@/components/org/media-library-copy";

/** How close to the end of what is loaded the next page is asked for (viewer trd D9). */
const PREFETCH_SLACK = 2;

interface Options {
  count: number;
  index: number;
  onIndexChange: (index: number) => void;
  /** The grid's own load-more; nothing is asked for once `done`. */
  onMore: () => void;
  done: boolean;
}

/**
 * Where the viewer is in the grid's list, and what moving does: the keys, the next page near the
 * end, and the word at the end (viewer trd D9, ux Last item). The list itself stays the grid's.
 */
export function useLibraryViewer({ count, index, onIndexChange, onMore, done }: Options) {
  /** Pictures whose bytes would not load; cleared by Try again (ux Retryable error). */
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());

  const atEnd = index >= count - 1;

  const next = () => {
    if (atEnd) {
      // Not done means the next page is already on its way: it is not the last one yet.
      if (done) toast(MEDIA_VIEWER_COPY.lastOne);
      return;
    }
    onIndexChange(index + 1);
  };

  const previous = () => {
    if (index <= 0) return;
    onIndexChange(index - 1);
  };

  const go = (to: number) => {
    if (to < 0 || to >= count) return;
    onIndexChange(to);
  };

  // Near the end of what is loaded, bring the next page in, so a swipe never stops (spec R3).
  useEffect(() => {
    if (!done && index >= count - PREFETCH_SLACK) onMore();
  }, [done, index, count, onMore]);

  // Re-subscribes each render so the handlers never close over a stale index.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") previous();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return {
    next,
    previous,
    go,
    atEnd,
    hasFailed: (id: string) => failed.has(id),
    markFailed: (id: string) => setFailed((prev) => new Set(prev).add(id)),
    retry: (id: string) =>
      setFailed((prev) => {
        const without = new Set(prev);
        without.delete(id);
        return without;
      }),
  };
}
