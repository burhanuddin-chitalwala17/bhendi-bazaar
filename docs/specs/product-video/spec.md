# Spec — product video

- **Status:** 📝 Draft
- **Domain:** catalog, checkout
- **Phase:** 6 — Catalogue richness
- **Verified:** 2026-08-13
- **References:** [trd.md](trd.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0016](../../adr/0016-mobile-app-shell.md), [CONTRACTS.md](../../CONTRACTS.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is

A product page can show video alongside its photographs, in an order the selling organisation chooses.

## Why

Stills do not answer the questions a buyer actually has. Drape, sheen, texture, how a thing moves, how big it really is against a hand — these are the things that decide a purchase and the things a photograph is worst at. The buyer's alternative to seeing them is guessing, and a guess that turns out wrong comes back as a return, which costs the store the item, the shipping both ways, and the customer.

The material also already exists. An org photographing stock on a phone can film it in the same minute, at no extra cost and no new skill. What is missing is somewhere to put it.

The order matters as much as the presence. A video is not an appendix to the photographs — for some products it is the single most persuasive thing on the page, and the selling organisation is the only one who knows which those are. So this feature is about a gallery the org composes, not a photo gallery with a video bolted to the end.

## Requirements

- **R1** — A product can carry video as well as photographs.
- **R2** — The selling organisation controls the order media appears in, and can place a video at any position in the sequence, including first.
- **R3** — Wherever a product is represented by a single picture — cards, listings, search results, link previews — that picture is always a photograph, never a frame lifted from a video.
- **R4** — A video is visibly a video before it is played: on a phone there is a play affordance you can see and tap, not one that appears on hover.
- **R5** — Video never delays or blocks the rest of the page. Photographs render and the page is fully usable whether or not any video ever loads.
- **R6** — A product with no video behaves exactly as it does today, with no empty slot, no placeholder, and no extra weight on the page.
- **R7** — Every media item carries its own description, used by screen readers and shown when the item cannot load. Position in the gallery is not a description.
- **R8** — Video plays on a mid-range phone on a slow connection, or fails visibly to a still rather than stalling on a spinner.
- **R9** — Media is added, removed, described, and reordered from the organisation's own product form, on a phone.
- **R10** — Removing a product's media, or the product itself, leaves no record of that media behind and nothing referencing it, other than the purchase records R17 deliberately keeps.
- **R11** — Video is optional; at least one photograph is mandatory. A product can be published with photographs and no video, but never with video and no photograph, and the last photograph cannot be removed while the product is published. Photographs are what every surface other than the gallery relies on, and they are the fallback when video cannot play at all — so a product that has only video is a product that cannot be listed, shared, or shopped on a bad connection.
- **R12** — The selling organisation chooses which photograph represents the product on cards, listings, search results, and link previews. The choice is made from that product's own photographs, and can never land on a video.
- **R13** — A video that has become unavailable, because its owner deleted it, made it private, or disallowed embedding, shows as unavailable in place. It does not appear as a broken frame, and it does not stop the photographs around it rendering.
- **R14** — A product carries at most ten media items.
- **R15** — Exactly one photograph is the cover, at all times. It is chosen when the product is created and a product cannot be saved without one; it can be changed at any time; and it cannot be left unset by any later edit. The cover photograph cannot be removed while it is the cover — another must be chosen first. This subsumes R11's mandatory photograph: a product that must always have a cover cannot exist without a picture.
- **R16** — Gallery order carries no meaning beyond gallery order. Reordering media changes what a buyer sees on the product page and nothing else — not the cover, not the card, not a listing, not a link preview. Nothing outside the gallery reads position.
- **R17** — An order shows the product as it looked when it was bought. Changing a product's cover, reordering its gallery, or deleting the photograph that was on the card does not change what a past order looks like. A cart is not history and follows the product as it is now.

## Product acceptance

- **A1** — An org member adds a video to a product, places it second in the gallery, saves, reopens, and finds it still second.
- **A2** — On a ~360px phone, the gallery shows that the second item is a video without the buyer tapping anything, and tapping it plays.
- **A3** — The same product's card in a listing shows a photograph, before and after the video is added.
- **A4** — A product with no video looks and weighs the same as it does today.
- **A5** — With video blocked at the network level, the page still renders every photograph and remains shoppable.
- **A6** — A screen reader announces each gallery item by its own description, not "image 2 of 5".
- **A7** — An org member reorders four media items on a phone without a mouse and without a desktop-only control.
- **A8** — Saving a product whose only media is a video is refused, with a message saying a photograph is required. Removing the last photograph from a published product is refused the same way. Saving a product with photographs and no video succeeds.
- **A9** — Choosing the third photograph as the cover changes that product's card in a listing. Reordering the gallery afterwards changes nothing outside the gallery.
- **A10** — A gallery containing a video that has since been deleted on YouTube still renders every photograph, and the video's slot says it is unavailable.
- **A11** — Adding an eleventh media item is refused with a message saying the limit is ten.
- **A12** — Deleting the cover photograph is refused, with a message saying another cover must be chosen first. Choosing a different cover then deleting the old one succeeds.
- **A13** — Saving a product with no cover chosen is refused. A video offers no option to become the cover.
- **A14** — Buy a product, then change its cover to a different photograph. The order in the buyer's order history still shows the picture from when they bought it, while the product page and its card show the new one.

## Out of scope (this feature)

- Silent autoplaying hero loops. A different affordance with a different cost profile; revisit once R1–R10 are real.
- Video anywhere but a product page — no category, home hero, or offers-strip video.
- Buyer-submitted video, and video attached to reviews.
- Live or shoppable video, and any in-video hotspot or overlay.
- Our own transcoding, thumbnailing, or captioning pipeline.
- Automatic captions and subtitles. R7 covers text describing the item, not a transcript of it.
- Guaranteeing a past order's picture survives forever. R17 preserves which picture was chosen, not a private copy of the file — see [trd.md](trd.md) D19a for what that does and does not promise.
- Reclaiming storage for media nobody references any more.
