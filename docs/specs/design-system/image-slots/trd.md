# TRD — image-slots

- **Status:** Accepted (D1–D9, decided by Q24); D10 Draft
- **Domain:** catalog (banners, storefront slots, media assets), front end
- **Phase:** 13 — Design system
- **Verified:** 2026-11-04
- **References:** [spec.md](spec.md), [../decisions.md](../decisions.md) Q24, [ADR-0026](../../../adr/0026-images-are-delivered-through-the-optimizer.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0051](../../../adr/0051-a-products-facts-are-one-json-column-each-entry-carrying-its-origin.md), [ADR-0058](../../../adr/0058-media-is-one-aggregate-a-derivative-is-lineage-not-a-use-and-usage-is-derived.md), [ADR-0065](../../../adr/0065-storefront-reads-are-shared-across-requests-and-cleared-by-the-tables-a-write-touches.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Declare each slot's two shapes in code; keep each picture a real column with a foreign key; keep how
it is framed in one JSON column parsed on read; draw both pictures with one `<picture>` whose sources
come from the optimizer. Nothing is re-encoded: a crop is a stored rectangle, not a second file.

## Prior art
- **Shopify themes** give a slideshow a separate "mobile image" and fall back to the desktop one
  cropped by a focal point the merchant sets on the image. Followed: phone optional, focus fallback.
- **Art direction with `<picture>`** (MDN; Next.js `getImageProps`, `node_modules/next/dist/docs`):
  one `<source media>` per form factor, each `srcset` from the optimizer. Followed.
- **Sanity / Cloudinary hotspot-and-crop** store a rectangle and a point and cut on delivery. Our
  optimizer resizes but cannot cut an arbitrary rectangle, so the cut is CSS (D3).

## Technical decisions
- D1 — Slot declarations live in `server/catalog/image-slots.ts`: pure data and arithmetic, no
  Prisma, so the server validates with it and the client field imports it (dependency points inward).
  Each slot: desktop and phone width × height and the narrowest width that is not soft. Home banner
  is 5:2 / 4:5; `BANNER_IMAGE` in `src/lib/config.ts` stays and a test holds the two equal.
- D2 — Each picture is a column with a foreign key; framing is JSON. Desktop keeps `imageUrl` +
  `imageAssetId`; phone adds `phoneImageUrl` + `phoneImageAssetId` (`OrgStorefrontSlot`:
  `phoneAssetId`), `onDelete: Restrict`, joined to the media library's use relations (R9, H2). An id
  inside JSON would be invisible to both. The URL is snapshotted beside the id so the cached home read
  never joins `MediaAsset` (H4); a ref never changes and an asset in use cannot be retired.
- D3 — Keep it exact is stored, not rendered into a file: the rectangle in source pixels plus the
  source size, delivered as `object-fit: cover` with an `object-position` derived from it. The frame
  moves but does not zoom (the shape is locked and the picture only "a little off"), so the rectangle
  always spans one whole axis and cover-plus-position reproduces it exactly in a box of the slot's
  shape; in a box of another shape (the hero is fixed-height from `md:`) it stays centred on what was
  kept. Rejected: a derived file per crop (ADR-0058 lineage) — a re-encode and an object per re-crop,
  and `cropAsset` is org-scoped while home banners are the platform's. Kept for Later surfaces that
  cannot use CSS.
- D4 — The wire carries the rectangle as fractions of the picture (H1): whatever preview it was
  measured on, a fraction survives the upload's downscale. The server multiplies by the asset's own
  width and height, refuses a rectangle outside the picture or off the slot's shape by more than 2%,
  and stores pixels.
- D5 — Fit it in is `object-fit: contain` on a background of the fill colour (`#rrggbb`, refused
  otherwise). The field samples it from the border pixels of a small optimizer thumbnail — same
  origin, so the canvas is readable — and the uploader can change it.
- D6 — One renderer, `ResponsiveImage`: `getImageProps` once per form factor (`fill`, each its own
  `sizes`) into `<picture>` with `<source media="(min-width: 768px)">` (ADR-0050); phone at base. Fit,
  position and fill differ per form factor, so they travel as CSS custom properties read by
  `object-(--…)` / `md:object-(--…)` classes. `preload` becomes `loading="eager"` +
  `fetchPriority="high"`: a `<link rel=preload>` names one file and would be wrong for half the visitors.
- D7 — One write path, `resolveImageSlot`, used by both banner services and the storefront save: each
  URL must be a READY image in the owner's library (org id, or null for the platform — H3); the one
  exception is the unchanged legacy desktop URL with no asset (R8), which keeps default framing.
- D8 — Migration is additive: three columns per table and a backfill writing the default framing
  (centred cover, focus centre) for rows with a picture. The reader also treats null or unparseable
  framing as that default, so a row the backfill missed still renders. A test parses the migration's
  literal with the stored schema.
- D9 — The home hero box takes the phone shape below `md:` only when it has a picture; tablet and
  desktop heights are unchanged. Layout is otherwise untouched (the home redesign is page-grammar's).
- D10 — Storefront photos: each hero photo and collection photo carries its own set; the themed
  page's variants keep their own boxes and draw the set through `ResponsiveImage` (`ThemePhoto`).
  Draft: the columns and use relations shipped with D2; the look sheet's field and the themed
  rendering are the next unit.

## Delivery
1. Declarations, schemas, framing arithmetic, tests (R1, D1, D4).
2. Migration and repositories; media-library use relations (D2, D8, R9).
3. `ResponsiveImage` and the home hero (D6, D9, R6).
4. `ImageSlotField` with crop, fit, focus and previews (R2–R5, D5).
5. Admin home banners, then shop banners (R7, D7).
6. Storefront photos (D10).
