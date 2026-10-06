# ADR-0050: Three form factors, on Tailwind's own breakpoints

- **Date:** 2026-10-02
- **Status:** Accepted

## Context

The store is built and checked for phone, tablet and desktop. [ADR-0015](0015-mobile-first-design.md) fixed the direction: the base styles are the phone, and breakpoints add. It never said which breakpoint *is* the tablet, and the code answered three ways:

- **Prefix counts were lopsided:** `sm:` 294 times, `md:` 169, `lg:` 26, `xl:` twice. Nothing said what `sm` was for.
- **The one script-side query was named `DESKTOP_QUERY`** (`src/hooks/core/useMediaQuery.ts`) but matched at 768px, which is the tablet. `video-player.tsx` declared the same query a second time.
- **The product gallery's image hint was wrong at two sizes.** It assumed half-width from 768px and a third from 1200px. The page itself is full width until `lg` and half the 72rem column after. So a tablet downloaded images at half the size they were shown, and 1200px matched nothing in the layout. The same string had been copied into the video poster and the YouTube thumbnail.

## Decision

1. **Three form factors, mapped to Tailwind's default breakpoints. No custom ones.**

   | Form factor | Starts at | Prefix |
   |---|---|---|
   | Phone | base (~360px) | none; `sm:` (640px) only refines it for a large phone held sideways |
   | Tablet | 768px | `md:` |
   | Desktop | 1024px | `lg:` |

   `xl:` and above add width inside the desktop layout and are not a fourth form. Above 72rem the page column (`--container-page`) stops growing, so there is little for them to do.
2. **Scripts read the same breakpoints.** `FORM_FACTOR_QUERY` in `src/hooks/core/useMediaQuery.ts` declares the tablet and desktop queries once, and `useIsTabletUp` replaces `useIsDesktop`, whose name described the wrong device.
3. **A hand-written media query names a declared breakpoint.** That covers an image `sizes` string and a `matchMedia` call. A `sizes` string describes the layout at those breakpoints, so a hint that disagrees with the grid it sits in is a bug, not a tuning choice.
4. **`tests/unit/form-factors.test.ts` enforces 2 and 3.** No stylesheet redefines a breakpoint. Whether a layout is *right* on each form factor stays a review judgement (ADR-0015's consequence still holds).

## Alternatives considered

- **Custom breakpoints tuned to our layouts** (e.g. tablet at 820px). Common in design systems with a device lab. Rejected: every Tailwind example, shadcn component and contributor's habit assumes the defaults, and a renamed scale is a translation cost on every change.
- **Ban `sm:`, so there are exactly three prefixes.** Tidier, but `sm:` is the most-used prefix and almost entirely spacing and type nudges for a wide phone. Banning it would mean rewriting nearly 300 call sites for no visible gain.
- **Treat `md` as desktop**, as the old hook name implied. Rejected: the admin and org portals are used on tablets, and a 768px screen with a sidebar is not a desktop layout.

## Consequences

- ✅ "Which device is this?" has one answer in CSS and in scripts. The tablet gets images at the size it shows them.
- ✅ A new `sizes` string with an invented width fails a test, instead of quietly shipping blurry or oversized images.
- ⚠️ Only the media-query literals are guarded. A tablet layout built from `sm:` alone would still pass, and is caught at review.
