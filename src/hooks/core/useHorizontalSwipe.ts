"use client";

import { useRef } from "react";

/** How far a one-finger drag must travel to count as a swipe rather than a tap. */
export const SWIPE_PX = 75;

interface Options {
  onNext?: () => void;
  onPrevious?: () => void;
  /** False while something else owns the finger — a zoomed photograph being panned. */
  enabled?: boolean;
}

/**
 * A left/right swipe on a surface that has no arrows to offer, which on a phone is every
 * full-screen surface (viewer ux, phone row). Touch only: a mouse has the arrows and the keys.
 */
export function useHorizontalSwipe({ onNext, onPrevious, enabled = true }: Options) {
  const startX = useRef(0);
  const endX = useRef(0);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX.current = e.touches[0].clientX;
      endX.current = e.touches[0].clientX;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      endX.current = e.touches[0].clientX;
    },
    onTouchEnd: () => {
      if (!enabled) return;
      const delta = startX.current - endX.current;
      if (delta > SWIPE_PX) onNext?.();
      if (delta < -SWIPE_PX) onPrevious?.();
    },
  };
}
