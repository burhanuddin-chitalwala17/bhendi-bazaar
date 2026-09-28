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

/** Tailwind's `md` — the breakpoint every surface pair in ADR-0040 switches on. Declared once. */
export const DESKTOP_QUERY = "(min-width: 768px)";

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
