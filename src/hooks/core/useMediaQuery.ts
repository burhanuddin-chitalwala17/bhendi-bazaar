"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a media query matches. The browser's own list is the store, read through
 * `useSyncExternalStore` rather than mirrored into state, so nothing is stale between the render
 * and the effect that would have set it.
 *
 * The server's answer is always false, so the first paint is the phone's form and a wide screen
 * corrects it on hydration. That is the mobile-first direction
 * ([ADR-0015](../../../docs/adr/0015-mobile-first-design.md)), and it is the safe way round: a
 * surface that briefly shows its phone form is usable, one that briefly shows its desktop form is
 * not.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * The form factors, as media queries (ADR-0050). Tailwind's own breakpoints, not new ones:
 * `md` starts the tablet, `lg` the desktop. Declared once so a script can never disagree
 * with the stylesheet about which device it is on.
 */
export const FORM_FACTOR_QUERY = {
  tablet: "(min-width: 768px)",
  desktop: "(min-width: 1024px)",
} as const;

/** Tablet and wider — where every surface pair in ADR-0040 leaves its phone form. */
export function useIsTabletUp(): boolean {
  return useMediaQuery(FORM_FACTOR_QUERY.tablet);
}
