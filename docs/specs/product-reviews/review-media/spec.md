# Spec — review-media

- **Status:** ✅ Implemented — PR-117
- **Domain:** catalog
- **Phase:** —
- **Verified:** 2026-09-22
- **References:** [../spec.md](../spec.md) (parent) R18, [../trd.md](../trd.md), [product-video](../../product-video/), [ADR-0015](../../../adr/0015-mobile-first-design.md), [ADR-0017](../../../adr/0017-video-is-embedded-not-hosted.md), [ADR-0026](../../../adr/0026-images-are-delivered-through-the-optimizer.md), [ADR-0028](../../../adr/0028-images-live-in-cloudflare-r2.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

A review can show the piece as it arrived: a few photographs taken by the buyer, and
optionally a link to a video they have already published elsewhere.

## Why

The seller's photographs are styled, lit and shot on the person the garment was made to
suit. They are also the only pictures on the page, so the questions that actually stop a
purchase — how a colour reads in daylight, how a fabric sits on a body that is not a
model's, whether the stonework is as dense as it looks — have no second source.

A buyer's own photograph answers all three at once, and it is the one thing a review can
supply that the seller structurally cannot. It is also the thing buyers already do
unprompted on every marketplace they use, which is why arriving at a review form with
nowhere to put a photo reads as the store not wanting to hear it.

Video is included because [ADR-0017](../../../adr/0017-video-is-embedded-not-hosted.md)
decision 4 already settled the terms — a reference to somebody else's host, never a file
of ours — so allowing it costs a link field, and refusing it would be a rule with no
reason behind it. Photographs are the part that will actually be used.

## Requirements

- R1 — A review can carry up to four photographs. Nothing about a review without one
  changes: the rating stays the only required field, and no empty slot or prompt appears
  where photographs would be.
- R2 — Photographs are taken or chosen on a phone, from camera or gallery, appear as
  thumbnails while they upload, and can be removed before the review is submitted.
- R3 — An upload that fails says so, leaves the other photographs alone, and costs the
  reviewer nothing they typed (parent R14).
- R4 — A photograph arrives from a phone camera at a size the store reduces before
  storing it, so a reviewer on a slow connection can finish, and one reviewer cannot
  spend the catalogue's image budget ([ADR-0026](../../../adr/0026-images-are-delivered-through-the-optimizer.md),
  [ADR-0028](../../../adr/0028-images-live-in-cloudflare-r2.md)). Four per review is a
  page-weight and storage limit before it is an editorial one.
- R5 — A review's video is a link to one the reviewer has already published on a host the
  store supports. No video file is ever uploaded to us. It renders as a still, plays on
  tap, and says it is unavailable in place if the video has since been deleted or made
  private ([product-video](../../product-video/) R13).
- R6 — A review carries at most one video.
- R7 — Media is plainly the reviewer's, not the seller's: it sits inside that review,
  attributed to its author, and opens full-size on tap.
- R8 — A review's media never becomes the product's: not in its gallery, not its cover,
  not its listing tile, not a search result, not a link preview. What represents a
  product stays the selling organisation's choice ([product-video](../../product-video/)
  R3, R12).
- R9 — The reviewer writes no separate description for a photograph. Their review is the
  description, and a photograph is announced as theirs — asking a buyer for alt text is a
  field they will skip or fill with a word that helps nobody.
- R10 — Withdrawing a review withdraws its media with it: the photographs leave the
  product page as the words do, and both stay readable in the admin portal (parent R16).
- R11 — Withdrawing the whole review is the only lever. The platform never edits someone
  else's review down to the parts it liked, and there is no removing one photograph from
  a review that is otherwise fine.
- R12 — A review's photographs live exactly as long as the review does. Deleting the
  review, by its author or the platform, deletes them.
- R13 — An admin moderating reviews sees the photographs at a size they can be judged at,
  without opening each review in turn. A moderation queue that shows only text cannot
  moderate pictures.

## Product acceptance

- A1 — A reviewer attaches two photographs from a phone, submits, and both appear inside
  their review on the product page. A fifth is refused with a message saying the limit
  is four.
- A2 — The same product's gallery, cover, listing tile and link preview are unchanged
  before and after those photographs exist.
- A3 — On a ~360px phone the thumbnails, their progress and the remove control are all
  reachable in one column without a hover, and tapping one opens it full-size.
- A4 — A photograph straight off a phone camera uploads on a throttled connection, and
  what is stored is the reduced version, not the original.
- A5 — An upload cancelled or failed mid-way leaves the typed review and the other
  photographs intact.
- A6 — A review's video link renders as a still that plays on tap; one since made
  private says it is unavailable rather than showing a broken frame, and the photographs
  around it still render.
- A7 — An admin withdraws a review carrying photographs: they leave the product page with
  the words, and both remain readable in the admin portal.
- A8 — A reviewer deletes one of their two reviews; its photographs go with it and the
  other review keeps its own.
- A9 — An admin scanning the review queue can see every attached photograph without
  opening each review.

## Hazards this feature must answer

- H1 — **A stranger's picture publishes onto a seller's product page unseen.** Reviews
  publish immediately and reviewing needs no purchase (parent, Decisions taken), so
  nothing stands between an arbitrary signed-in account and an image on a product page
  but withdrawal after the fact. R10 and R13 are the whole answer, and they are a manual
  one; if it proves insufficient the fallback is holding reviews with media for approval,
  which is narrower than holding all of them.
- H2 — **A withdrawn photograph is still a file.** Images are public and read directly
  from the object store, so withdrawal removes a photograph from every surface without
  making its URL stop working. R12's delete is what actually removes it; anything short
  of that leaves the bytes reachable by whoever already had the link.
- H3 — **Buyer photographs grow a bucket nobody is watching.** Catalogue images are
  bounded by how much stock exists; review images are bounded by how many people write
  reviews. R4's per-review cap bounds the worst case per review, not in total.

## Out of scope (this feature)

- Automated image screening, nudity or duplicate detection on the way in.
- Removing or cropping one photograph inside someone else's review (R11).
- Reordering a review's photographs, or choosing one of them as its cover.
- A buyer's photograph appearing anywhere but the review it belongs to — no "customer
  photos" strip, no gallery merge, no use in marketing.
- Uploading a video file, on any plan. Settled by
  [ADR-0017](../../../adr/0017-video-is-embedded-not-hosted.md).
- Reclaiming storage for files nothing references any more, which is the catalogue's
  open problem too ([product-video](../../product-video/) out of scope).
