# Spec — media-library

- **Summary:** Every stored image is a record with dimensions, source and uses; galleries fill by named slot; capture is guided on the phone
- **Status:** 🔨 In progress — PR-152, PR-161, PR-163 (3 of 6)
- **Domain:** catalog (assets, slots), content (renditions, capture checks)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-09-27
- **References:** [trd.md](trd.md), [renditions](renditions/) (subfeature), [image-delivery](../image-delivery/), [product-video](../product-video/), [bulk-catalog-upload](../bulk-catalog-upload/), [ADR-0026](../../adr/0026-images-are-delivered-through-the-optimizer.md), [ADR-0027](../../adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md), [ADR-0028](../../adr/0028-images-live-in-cloudflare-r2.md), [ADR-0032](../../adr/0032-records-people-authored-are-retired-not-deleted.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

Every image the platform stores becomes a thing the platform knows about: how big it is, what format it is in, who uploaded it, what it was made from, and where it is used. A seller browses their images in one place, reuses them across products, and fills a product's gallery by named slot — front, back, detail, label — instead of by position. Before a seller picks a photo, the slot says what shot is needed; after they pick one, however it was taken, the picture is checked and the seller is warned if it is too dark or blurred to be worth uploading.

## Why

Today an image is a URL string on a row. Nothing knows its dimensions, so nothing can say whether it meets Amazon's minimum or Instagram's crop; nothing knows its source, so an enhanced copy would silently replace an original; nothing knows where it is used, so nothing can be safely removed. Every channel to come needs a derived image in its own size and format from a source we can vouch for, and the pack-label photo is the most accurate source of a reseller's manufacturer and origin. All of that rests on images being records rather than strings.

Good photography is the small seller's largest handicap. Cleanup after the fact fixes background and size; it cannot fix a shot that was never framed or lit. So the library also helps at capture, on the phone, before the upload is spent.

## Requirements

- **R1** — Every stored image has a record from the moment it is stored: dimensions, byte size, format, owning organisation, uploader, when. This holds for every path an image enters by, including the browser's direct upload.
- **R2** — Every image already stored is brought under the same record, and nothing a buyer sees changes: same URLs, same optimizer, same sizes ([ADR-0026](../../adr/0026-images-are-delivered-through-the-optimizer.md)).
- **R3** — An image can be derived from another — resized, cropped, cut out, enhanced — and the derived image records its source and how it was made. A source is never overwritten or altered by deriving from it.
- **R4** — A product's gallery is a set of named slots decided by its category. Every category starts with the same five — front, back, detail, label, scale — and a category may add or rename slots for what it sells: sole and pair for footwear, drape and border for a saree. Every slot is optional. One slot is the cover. Extra images beyond the named slots are allowed and ordered, and one slot may be marked lifestyle for a staged or creative shot.
- **R5** — The label slot is recognised as the pack label, so later work can read manufacturer, origin and quantity from it.
- **R5a** — The library also holds embedded video references — a video id and its poster, never a file ([ADR-0017](../../adr/0017-video-is-embedded-not-hosted.md)) — so a seller browses and reuses videos as they do images. The product gallery keeps handling video exactly as it does today.
- **R6** — A seller browses every image their organisation owns, sees where each is used, and can pick any of them for any slot of any of their products. A hero, a banner and a gallery may share one image. The library filters by product, by slot, by whether an image is used, by how it came to be — uploaded, cropped, cut out, generated — and by date.
- **R7** — An image that nothing uses can be removed; one that something uses cannot. Removal is retirement first, and the stored object goes only after a stated grace period ([ADR-0032](../../adr/0032-records-people-authored-are-retired-not-deleted.md)).
- **R8** — An empty slot shows what it wants before anything is chosen: its name, a framing hint and an example silhouette. Once a photo is chosen for a product or label slot, the picture is checked before upload and the seller is warned when it is too dark, too blurred, or too small for any marketplace. A lifestyle slot is checked for size only: a moody or dark creative shot is the seller's choice, and a post made for Instagram is never checked at all. The check knows nothing about where the photo came from — the phone's camera, its gallery, a desktop file — because on the web the camera hands back a file like any other. The warning advises; it never blocks.
- **R8a** — At upload the seller may rotate and crop, with aspect presets and free crop, and nothing else: no colour or effect filters, which misrepresent a product on a marketplace. The crop is a derived image with its rectangle recorded (R3); the untouched original remains the source, so a later surface that needs more canvas than the crop kept reaches back to it, and re-cropping is free.
- **R9** — For each surface that needs its own size or shape, a rendition is produced from the source on demand and kept as a derived image — specified in [renditions](renditions/), a subfeature of this spec.
- **R10** — The library exposes what a channel's image rules need to judge a picture — dimensions, format, aspect, and an estimate of whether the background is plain — and does not itself judge. Readiness belongs to [listing-schema](../listing-schema/).
- **R11** — The whole of it works on a ~360px phone, camera included, and every image still passes through the one image seam ([ADR-0028](../../adr/0028-images-live-in-cloudflare-r2.md)).
- **R12** — The platform owner sees every organisation's library read-only, filterable by organisation, with each image's provenance visible, and can retire an image for a policy breach with a reason that is recorded ([ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md)). The platform does not upload into or edit a seller's library. The platform's own images — category heroes, home banners — are its own collection in the same library.
- **R13** — The same photograph is one image in an organisation's library, however many times it is chosen: a repeat upload is recognised by its bytes and answered with the existing image, so nothing is stored twice and every use of it shows one record. Another organisation's identical file is its own image; libraries never share.

## Product acceptance

- **A1** — Every image visible on the store the day before this ships is visible, at the same URL, the day after, and each has a record with correct dimensions.
- **A2** — A seller picks a photo for the "label" slot, is warned it is dark, picks another, and the second upload lands with its dimensions recorded. The same warning appears for the same file whether it came from the camera, the gallery or a desktop.
- **A2a** — A seller crops a photo to square at upload. The square fills the slot, the original is still in the library unchanged, and a portrait rendition made later comes out uncropped at the sides.
- **A3** — A seller reuses one photo as a product's front slot and as a banner, and the library shows both uses. Removing it is refused while either remains.
- **A4** — A square rendition of a gallery image exists as its own record pointing at its source, and the source is byte-identical to before.
- **A5** — A product in a category with five named slots, two filled, shows the three empty ones by name and still renders its gallery correctly to buyers.
- **A6** — Nothing in a buyer-facing payload changed shape except by addition.
- **A7** — The platform owner opens a seller's library, filters to generated images, retires one with a reason, and the seller's product no longer shows it; the seller's own library shows it as retired by the platform.

## Out of scope (this feature)

- AI cutout, white background and generated backdrops — [image-enhancement](../image-enhancement/); this feature gives them a source to derive from and a record to write.
- Reading the label — the vision and OCR pass in [listing-schema](../listing-schema/) and [product-form](../product-form/).
- Review photographs. They stay on their own table with their own lifecycle ([product-reviews](../product-reviews/)) until there is a reason to bring them in.
- Judging whether an image satisfies a channel — [listing-schema](../listing-schema/).
