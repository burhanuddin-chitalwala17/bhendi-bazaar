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
      tracking: [{ tracking: ["label", "eyebrow", "eyebrow-wide", "display"] }],
      // elevation *roles*, not sizes
      shadow: [{ shadow: ["raised", "lifted", "overlay", "inset-field"] }],
      // the sub-`text-xs` scale
      "font-size": [{ text: ["2xs", "3xs", "4xs"] }],
      // `@utility max-h-overlay` — the one cap token. `none` is here because
      // tailwind-merge 3.4 omits it from its own `max-h` group, so `max-h-none` was
      // not recognised either and could not override anything.
      "max-h": [{ "max-h": ["overlay", "none"] }],
      // `@utility` sizing and spacing helpers for the phone app shell (ADR-0016)
      h: [{ h: ["tabbar"] }],
      "pb": [{ pb: ["safe", "tabbar"] }],
      bottom: [{ bottom: ["tabbar"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
