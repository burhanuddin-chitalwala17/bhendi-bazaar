import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `tailwind-merge`, taught this project's own tokens (ADR-0022).
 *
 * Without this it does not know `rounded-card` is a `rounded`, or `max-h-overlay` a
 * `max-h`, so a component overriding one keeps **both** classes and which wins is
 * decided by their order in the generated stylesheet. That is not a theoretical
 * problem: the image lightbox asked for `max-h-none rounded-none` over the dialog's
 * `max-h-overlay rounded-card` and silently kept the cap, so a "full screen" viewer
 * was neither full height nor square-cornered.
 *
 * Every custom value declared in `globals.css` belongs here. A token added there and
 * not added here still renders — it just stops being overridable, which is the failure
 * mode that hides.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // `--radius-card` / `--radius-field`
      rounded: [{ rounded: ["card", "field"] }],
      // `--tracking-label` and friends
      tracking: [{ tracking: ["label", "eyebrow", "eyebrow-wide", "display", "headline", "tag"] }],
      // elevation *roles*, not sizes
      shadow: [{ shadow: ["raised", "lifted", "overlay", "inset-field", "tile"] }],
      // the sub-`text-xs` scale, and the storefront type roles a theme repoints
      "font-size": [{ text: ["2xs", "display", "headline", "title", "body", "small", "caption", "label", "tag", "price"] }],
      // storefront faces and theme colour roles (storefront-themes D2, D3)
      "font-family": [{ font: ["display", "label"] }],
      // `deal` and `feature` are fills only: as text on the page they fall below AA.
      "text-color": [{ text: ["deal-foreground", "feature-foreground", "on-photo"] }],
      "bg-color": [{ bg: ["deal", "feature", "photo-scrim"] }],
      // a theme's drawn pattern where a photo is missing (Q17)
      "bg-image": [{ bg: ["theme-pattern"] }],
      "max-w": [{ "max-w": ["store"] }],
      "duration": [{ duration: ["theme", "fast", "base", "slow"] }],
      "ease": [{ ease: ["theme", "standard", "emphasised"] }],
      // `@utility max-h-overlay` — the one cap token. `none` is here because
      // tailwind-merge 3.4 omits it from its own `max-h` group, so `max-h-none` was
      // not recognised either and could not override anything.
      "max-h": [{ "max-h": ["overlay", "none"] }],
      // `@utility` sizing and spacing helpers for the phone app shell (ADR-0016)
      h: [{ h: ["tabbar"] }],
      "pb": [{ pb: ["safe", "tabbar"] }],
      // storefront rhythm: section air, page gutter, grid gap
      p: [{ p: ["section", "gutter", "grid"] }],
      px: [{ px: ["section", "gutter", "grid"] }],
      py: [{ py: ["section", "gutter", "grid"] }],
      gap: [{ gap: ["section", "gutter", "grid"] }],
      bottom: [{ bottom: ["tabbar"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
