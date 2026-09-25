# Spec — renditions

- **Summary:** Every surface that needs its own size or shape gets a derived image made once from a declared recipe, and the source never changes
- **Status:** ✅ Accepted — 2026-09-26
- **Domain:** content, reading catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-09-25
- **References:** [../spec.md](../spec.md) (media-library), [trd.md](trd.md), [ADR-0026](../../../adr/0026-images-are-delivered-through-the-optimizer.md), [ADR-0027](../../../adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

Every surface that needs an image in its own size or shape — a square post, a portrait post, a marketplace main image — gets one made from the library's source image, on demand, and kept as a derived image of its own.

## Why

Channels disagree about images. Instagram wants a square or a 4:5 portrait at 1080 wide; Amazon wants a square on white at 1000 or more and refuses WebP; the store wants WebP at a size that survives zoom. One source cannot serve them all by being served differently, and hand-cropping a copy per channel is the retyping problem in pictures. A rendition made once from a declared recipe, and recorded as coming from its source, answers every channel without the seller lifting a finger and without the source ever changing.

## Requirements

- **R1** — Each surface is declared once, with the width, height, fit, format and quality it serves. Adding a channel is adding a declaration, not code.
- **R2** — A rendition is produced from the source, or from the seller's crop when one exists, the first time a surface asks for it, and the same surface asks once: the next request returns the one already made.
- **R3** — A rendition is a derived image in the library ([../spec.md](../spec.md) R3): it records its source and its surface, and the source is never altered.
- **R4** — When the seller's crop lacks the pixels a surface needs — a portrait from a square crop — the rendition reaches back to the untouched original rather than stretching or padding the crop.
- **R5** — Every declared size clears the zoom rule the store already holds itself to ([ADR-0027](../../../adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md)), and every rendition is delivered through the same optimizer as every other image ([ADR-0026](../../../adr/0026-images-are-delivered-through-the-optimizer.md)).
- **R6** — A rendition that the source outlives is retired with it; a retired source's renditions are unreachable from any surface.

## Product acceptance

- **A1** — Asking for the square post of one gallery image twice produces one derived image, byte-identical on both asks, pointing at its source.
- **A2** — A source cropped square by the seller yields a portrait post with the product uncropped at top and bottom.
- **A3** — The Amazon main-image rendition of a stored WebP is a JPEG on the stated size, and the stored WebP is unchanged.
- **A4** — Adding a new surface declaration makes that rendition available to every existing image with no other change.

## Out of scope (this feature)

- Cutting the product out, white backgrounds, generated scenes — [image-enhancement](../../image-enhancement/). Those produce new sources; this feature only resizes and re-encodes.
- Which surface a channel requires and whether an image satisfies it — [listing-schema](../../listing-schema/).
