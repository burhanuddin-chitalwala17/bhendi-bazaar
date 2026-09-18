# ADR-0027: A zoomable surface declares the size it zooms to, and the stored ceiling clears it

- **Date:** 2026-09-17
- **Status:** Accepted
- **Amends:** [ADR-0026](0026-images-are-delivered-through-the-optimizer.md) decision 4 (the stored ceiling) and decision 3 (honest `sizes`). ADR-0026 otherwise stands.
- **Context:** ADR-0026 capped stored photographs at 1600px and required `sizes` to describe the CSS box, calling an overstated `sizes` a defect. Both are wrong on a surface that magnifies, and this catalogue has two of them: `product-gallery.tsx` pinches to 3× and hover-zooms to 2×, and `image-lightbox.tsx` zooms to 3× with pan and a minimap.

  A zoom scales the bytes the browser already has. It does not fetch a sharper image. So a zoomable element's real slot is its box times the zoom, and a `sizes` describing only the box guarantees a soft image at magnification — the defect ADR-0026 was written to prevent, arriving through the rule it wrote.

  The 1600px ceiling failed the same test independently. A 3:4 photograph in a 1440×900 lightbox is height-bound at roughly 675px wide; at 3× that asks for ~2025px. Measured against a pristine source, 1600px WebP q82 showed **6.63** mean absolute error at full zoom versus **3.33** for 2000px and **1.28** for the original — twice the error of a variant costing 67KB more. At tile and page sizes the difference was negligible (2.50 vs 2.46), so ADR-0026's listing gains are unaffected; the loss was confined to the one surface where a buyer inspects weave and stonework, which for this catalogue is where the purchase decision is made.

  ADR-0026 also made this worse than a like-for-like comparison suggests: the lightbox previously carried `unoptimized` and therefore served the full original.
- **Decision:**
  1. **The stored ceiling is derived from the zoom cap, not chosen.** `MAX_ZOOM_SCALE` is declared in `server/catalog/media.ts` and `MAX_IMAGE_EDGE` is 2048 because it must clear the widest displayed edge times that scale. Raising the zoom without raising the ceiling is a defect, and `tests/unit/image-delivery.test.ts` fails on it.
  2. **The zoom cap is declared once.** It was spelled three times — `MAX_SCALE = 3` in the lightbox, `Math.min(3, …)` in the gallery, and implicitly in the chosen ceiling. The components now import it, and the test fails on a second spelling.
  3. **A zoomable surface uses `ZOOMABLE_IMAGE_SIZES`, which deliberately overstates its box.** This is the one sanctioned exception to ADR-0026 decision 3, and it is a named constant rather than a literal so that it reads as a decision at the call site. It is capped at 2× viewport rather than the full 3×, because beyond that the optimizer's `deviceSizes` ceiling takes over and the download stops buying detail.
  4. **Only the inspect surfaces get it, and only when active.** The listing tile does not zoom and stays honest — overstating there is precisely what cost the transfer allowance. The gallery applies it to the active slide alone; off-screen slides are not being inspected.
  5. **The lightbox additionally requests `quality={88}`.** It is the deliberate detail surface, reached by a tap, and worth more bits than a grid.
  6. **A backfill overwrites each blob at its own pathname**, with `contentType: image/webp` even where the pathname still says `.jpg`. This inverts the rule `migrate-blob-store.ts` follows — that a pathname should describe its bytes — because a new pathname would change every URL, requiring eight columns to be rewritten and risking a half-migrated catalogue for a cosmetic gain. `contentType` is what browsers and `next/image` honour.
- **Alternatives considered:**
  - *Leave the ceiling at 1600px and accept softer zoom* — rejected on the measurement. 67KB per image against a doubling of error on the surface that sells the product is not a trade worth making, and at 2048px a 1GB allowance still holds roughly 800–1,000 products at this catalogue's shape.
  - *Store the original as well, and serve it only to the lightbox* — the conventional two-tier answer. Rejected because it reintroduces exactly what ADR-0026 removed: multi-megabyte objects in a store with a 1GB allowance, where the lightbox is a normal part of browsing rather than a rare path. The zoom target is bounded by `MAX_ZOOM_SCALE`, so one file sized for it is sufficient.
  - *Raise the ceiling far higher — 3000px or 4000px* — rejected as paying for pixels no surface can display. At `MAX_ZOOM_SCALE` of 3 nothing requests beyond ~2025px, and 3000px measured **no better** at full zoom (4.08 vs 3.33 for 2000px) while storing 535KB against 262KB. More pixels past the requirement is cost without fidelity.
  - *Drop the zoom features instead* — rejected outright. Zoom is how a buyer checks fabric and stonework on this catalogue; removing it to protect a storage figure optimises the wrong thing.
  - *Fetch a separate high-resolution image when the user actually zooms* — the most bandwidth-efficient answer, and genuinely attractive. Rejected as premature: it needs a second stored variant or an optimizer request at a fixed large width, plus a loading state mid-gesture, to save bandwidth that decision 4 has already confined to deliberate taps. Worth revisiting if lightbox traffic ever shows up as a line item.
- **Consequences:**
  - ✅ Zoom is sharp again on both inspect surfaces, and measurably closer to the original than what ADR-0026 shipped.
  - ✅ The zoom cap and the stored ceiling can no longer drift apart, in either direction, without a test failing.
  - ✅ Stored images are ~250KB rather than ~195KB — against 2.17MB today, still a roughly 8× reduction, and about 9% of the 1GB allowance for the current catalogue.
  - ⚠️ Opening the lightbox downloads a larger image than its box needs, by design. This is the cost of decision 3 and is confined to a deliberate action.
  - ⚠️ `ZOOMABLE_IMAGE_SIZES` is an overstated `sizes`, which is the pattern `/bb-review` is told to treat as a finding. Reviewers must check that new uses are genuinely zoomable surfaces, since the constant's name is now cover for the thing it legitimises.
  - ⚠️ After a backfill, a blob's pathname extension may not match its bytes (decision 6). Anything reasoning about stored images from the pathname — a future cleanup or audit script — must read `contentType` instead.
