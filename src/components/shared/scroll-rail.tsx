"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { SCROLL_RAIL_COPY } from "./shared-copy";

/**
 * One line of items that scrolls sideways with no scrollbar (owner, 2026-11-05: "looks ugly"). A
 * phone swipes; from a tablet two arrows step a screenful, each shown only while there is more that
 * way — so a mouse without a trackpad still reaches the end, and hover is never the only way.
 */
export function ScrollRail({ children, className }: { children: ReactNode; className?: string }) {
  const rail = useRef<HTMLUListElement>(null);
  const [more, setMore] = useState({ back: false, ahead: false });

  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setMore({ back: el.scrollLeft > 1, ahead: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    return () => resize.disconnect();
  }, [measure]);

  const step = (direction: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: still ? "auto" : "smooth" });
  };

  return (
    <div className="relative">
      <ul ref={rail} onScroll={measure} className={cn("no-scrollbar flex snap-x overflow-x-auto", className)}>
        {children}
      </ul>
      {more.back && (
        <Button
          type="button"
          variant="outline"
          shape="icon"
          size="lg"
          aria-label={SCROLL_RAIL_COPY.previous}
          onClick={() => step(-1)}
          className="absolute left-2 top-1/3 hidden -translate-y-1/2 rounded-full bg-background/90 shadow-raised md:inline-flex"
        >
          <Icon name="previous" size="md" />
        </Button>
      )}
      {more.ahead && (
        <Button
          type="button"
          variant="outline"
          shape="icon"
          size="lg"
          aria-label={SCROLL_RAIL_COPY.next}
          onClick={() => step(1)}
          className="absolute right-2 top-1/3 hidden -translate-y-1/2 rounded-full bg-background/90 shadow-raised md:inline-flex"
        >
          <Icon name="next" size="md" />
        </Button>
      )}
    </div>
  );
}
