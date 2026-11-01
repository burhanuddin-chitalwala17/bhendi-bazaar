"use client";

import { useEffect } from "react";

/** What a tapped section posts to the picker (D12); the section editor (unit 6) listens for it. */
export const PREVIEW_MESSAGE = { SECTION: "storefront-preview:section" } as const;

/**
 * The preview is a picture of the shop, not a way out of the picker (D12): a link inside the
 * frame (and the search form) goes nowhere, since every buyer page refuses to be framed. A tap on a section posts its
 * key to the parent, to our own origin only.
 */
export function PreviewFrameGuard() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("a")) event.preventDefault();
      const section = target?.closest<HTMLElement>("[data-section]")?.dataset.section;
      if (section && window.parent !== window) {
        window.parent.postMessage({ type: PREVIEW_MESSAGE.SECTION, section }, window.location.origin);
      }
    };
    const onSubmit = (event: SubmitEvent) => event.preventDefault();
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);
  return null;
}
