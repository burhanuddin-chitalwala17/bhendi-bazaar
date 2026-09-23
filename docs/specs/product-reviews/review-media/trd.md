# TRD — review-media

- **Status:** ✅ Implemented — PR-124, revised PR-125
- **Domain:** catalog
- **Phase:** —
- **Verified:** 2026-09-23
- **References:** [spec.md](spec.md), [../trd.md](../trd.md) (parent), [ADR-0017](../../../adr/0017-video-is-embedded-not-hosted.md), [ADR-0020](../../../adr/0020-money-bearing-records-never-cascade.md), [ADR-0026](../../../adr/0026-images-are-delivered-through-the-optimizer.md), [ADR-0028](../../../adr/0028-images-live-in-cloudflare-r2.md), [ADR-0032](../../../adr/0032-records-people-authored-are-retired-not-deleted.md), [bulk-catalog-upload](../../bulk-catalog-upload/) D10

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

Nothing here is a new mechanism. A buyer's photograph takes the path an org's photograph already takes — downscale in the browser, ask for a presigned PUT, write straight to R2 — and a buyer's video — allowed in PR-124 on ADR-0017's terms — was withdrawn in PR-125 as a moderation cost rather than a storage one (spec R5a). What the feature adds is one child table, one presign route with a different prefix and a different gate, and the rule that none of it may leak into the product's own gallery.

The interesting decisions are therefore about ownership and lifetime, not about uploading: who may ask for a signature, what happens to the objects when a review goes, and why the bytes survive a withdrawal even though the pictures do not.

## Technical decisions

- **D1 — `ReviewMedia` is its own table, not a `reviewId` on `ProductMedia`.** The two have different lifetimes and different owners, and — decisively — every gallery, cover and thumbnail query reads `ProductMedia`; a review row in that table would be one forgotten `where` away from appearing as the product's own picture, which R8 forbids. A separate table makes that mistake impossible rather than unlikely.
- **D2 — It reuses the `MediaKind` enum** (`IMAGE` | `YOUTUBE`, `server/catalog/media.ts:11` and the Prisma enum) rather than declaring a second closed set. `ProductFlag` was declared three times and drifted; one enum is the lesson applied.
- **D3 — `onDelete: Cascade` from `Review`, which is the case ADR-0020 leaves cascading.** A review's photograph carries no money and no attribution, so nothing is lost by a child row going when its parent does. Since PR-125 the cascade almost never fires: retiring a review keeps its row, so its media rows stay too ([ADR-0032](../../../adr/0032-records-people-authored-are-retired-not-deleted.md)). It remains correct for the one path that still destroys a `Review` — none in the product today, and a constraint is the wrong place to encode "this cannot happen".
- **D4 — The caps live in `server/catalog/media.ts` beside the product's.** `MAX_REVIEW_PHOTOS = 4` and one video, next to `MAX_MEDIA_PER_PRODUCT`, `MAX_IMAGE_EDGE` and `IMAGE_QUALITY`: media budgets in one module is what stops the browser path and the server path disagreeing (the reason that file exists).
- **D5 — A buyer's presign route is its own, prefixed by their user id.** `POST /api/reviews/upload-token` signs only under `reviews/<userId>/`, the way the org route signs only under `products/<orgCode>/` (`src/app/api/org/[orgId]/upload/token/route.ts:23-33`), and reuses `presignUploadSchema` and `presignUpload` unchanged. The prefix is the user's id rather than anything they send, so one shopper cannot write into another's folder, and an object's path says who put it there — which is what makes an abusive uploader findable after the fact (H1).
- **D5a — The signature is the limit, and it is bounded by authentication.** ADR-0028 records that `Content-Length` cannot be signed; a signed-in uploader who ignores our client can write a larger object. Unchanged here, and worth stating because reviewing needs no purchase, so the population that can ask for a signature is larger than it was.
- **D6 — ~~Objects are deleted by the service after the row~~ → narrowed in PR-125 to the edit path only.** Retiring a review no longer destroys anything, so its media rows survive and nothing is unreferenced — there is nothing to collect, and `remove` deletes no objects at all. What remains is an author *editing a photograph out*, which does leave an orphan, so `forgetImages` runs after that commit: best-effort, never throwing, because a failed object delete leaves an unreferenced file while a propagated failure would leave an author unable to edit their own review. Accepted and recorded in spec R12: a retired review's photographs stay reachable at their URLs for ever.
- **D7 — Withdrawal hides; only deletion removes the bytes (H2).** `isApproved: false` takes the photographs off every surface because the read filters on it, but the object stays public at its URL. Nothing here proxies reads to change that — ADR-0028 decision 3 forbids re-introducing a metered egress path, and a private bucket would mean signing every read of every review photograph. Recorded as the honest limit: a withdrawn photograph is unlisted, not unpublished.
- **D8 — The write accepts the *author's own* objects, and nothing else.** The submission schema takes `photos: string[]` (at most `MAX_REVIEW_PHOTOS`) and, since PR-125, no `video`. `isOwnObjectUrl` alone was the test until PR-125 and was not sufficient: it asks whether the bucket is ours, and every product image and every other shopper's photograph passes. `isOwnReviewPhoto` now requires the path to start with `reviews/<that author's id>/`, the prefix the presign route already signs — otherwise a reviewer could hotlink a product's cover onto their review and then delete it from R2 by editing it back out (spec R9a). The check sits in the service rather than the schema because it needs `R2_PUBLIC_BASE_URL`, which is server configuration, and the schema is also the form's client-side validation (ADR-0013). The same predicate also guards `forgetImages`, so the delete path does not trust its caller.
- **D9 — Position is the array index, as it is for a product's gallery.** A review's photographs have an order only because a list has an order; nothing outside the review reads it, and there is no reordering control (spec, out of scope).
- **D10 — Reduced in the browser, by the same function the bulk wizard uses.** `downscaleImage` (`src/lib/image/downscale.ts:25`) against `MAX_IMAGE_EDGE`, then `uploadDirect` (`src/lib/image/upload-direct.ts:14`). These bytes never pass through a function, so the server's `sharp` normalisation cannot reach them — the asymmetry ADR-0026 names, answered the same way here: one budget, two enforcers.
- **D11 — Rendered through `next/image` with an honest `sizes`.** A review thumbnail is a small square and a tapped photograph is a dialog, so neither is a zoom surface and neither may claim `ZOOMABLE_IMAGE_SIZES` (ADR-0027's one sanctioned overstatement is for the gallery and the lightbox). The video slot and its `YouTubeEmbed` are gone with R5a; `YouTubeEmbed` itself stays, used by the product gallery.
- **D12 — The admin queue shows the photographs inline (R13).** The moderation list already renders each review's text; media joins the same row as thumbnails, because a queue that shows only words cannot moderate pictures and the alternative — opening each review — is the friction that means nobody looks.
- **D13 — The buyer-facing DTO carries `media`, and still no `userId`.** One more array on `ReviewDto`: `{ kind, ref }` per item. `kind` stays on the wire although only `IMAGE` is produced now — the renderer already branches on it, and a one-value union that has to grow back is a contract change for nothing.

## Packages

None. `sharp` is not involved (the browser reduces), and no video is accepted.

## Data model

`ReviewMedia { id, reviewId, kind: MediaKind, ref, position }`, `@@index([reviewId])`, `onDelete: Cascade` (D3). `Review` and `Product` are untouched.

## API / contract changes

`[CONTRACT]`: `ReviewDto` gains `media: { kind, ref }[]`; the submission schema gains `photos: string[]` and `video: string | null`, accepted on create and edit symmetrically. New handler: `POST /api/reviews/upload-token`, answering `{ uploadUrl, publicUrl }` like the two that exist. [CONTRACTS.md](../../../CONTRACTS.md) records both.

## Test plan

The schema is where most of this is enforceable, so that is where it is tested: more than four photographs is refused, a URL on a host that is not ours is refused, a pasted watch/share/shorts link is stored as a bare id, and `photos`/`video` are accepted identically on create and edit. Beyond that: a review's media never appears in any `ProductMedia` read (asserted by the existing product-visibility-style census over `prisma.productMedia` call sites), deleting a review deletes its objects through the seam, and withdrawing one removes its photographs from the page while leaving the row readable in admin.

## Delivery (PRs)

One PR. The table, the presign route, the schema fields, the form control, the renderer and the admin thumbnails are the same feature; shipping the upload without the display, or the display without moderation, leaves the store in a state nobody wants to run.

## Open questions

- Whether an abusive uploader should be blocked from uploading at all, rather than having each review withdrawn. That is an account-level control the store does not have, and it needs its own spec.
- Whether to keep a note of who uploaded what after a review is deleted. Today the objects go and the path — which carried the user id — goes with them, so a repeat offender leaves no trail. Deliberate for now: keeping one means keeping deleted people's files.
