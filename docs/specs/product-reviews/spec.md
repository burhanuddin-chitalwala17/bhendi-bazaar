# Spec — product-reviews

- **Status:** ✅ Implemented — PR-124, revised PR-125
- **Domain:** catalog, reading from checkout for the verified badge
- **Phase:** —
- **Verified:** 2026-09-23
- **References:** [trd.md](trd.md), [review-media](review-media/), [seamless-sign-in](../seamless-sign-in/), [rate-limiting](../rate-limiting/), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md), [ADR-0032](../../adr/0032-records-people-authored-are-retired-not-deleted.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is

The product page shows what buyers have written about a piece, and a signed-in shopper
can add their own — a rating, words, and photographs of what arrived. The star rating on
every listing, tile and search result is the average of the published reviews.

## Why

A buyer had nothing to go on but the org's own photographs and description. Reviews were
stored and moderated from the day the catalogue existed, but no storefront surface showed
one, and every tile advertised a rating no buyer had contributed to.

For clothing this is the most expensive gap on the page: fit, fabric weight and how true
a colour is to the photograph are the questions that stop a purchase, and only another
buyer can answer them.

## Requirements

### Reading a product's reviews

- R1 — The product page lists published reviews, newest first, each with the reviewer's
  name, star rating, optional title, optional comment, and when it was written.
- R2 — Above the list sits a summary: the average rating, how many reviews there are,
  and how many gave each star count.
- R3 — A long list starts partial and extends in place. Reading more reviews never
  leaves the product page.
- R4 — A review by someone who bought that product is marked **Verified purchase**. The
  store awards the mark from its own order history; a reviewer can neither claim it nor
  decline it.
- R5 — A product with no published reviews says so and invites the first one, rather
  than showing an empty panel.
- R6 — The rating and count agree everywhere they appear — product page, tile, search
  result, lane, admin and org portals — and count visible reviews only. A withdrawn or
  retracted review stops counting the moment it is hidden.
- R6a — Both numbers are read from the reviews themselves. A product carries no rating of
  its own that a surface could show while the reviews say otherwise.

### Writing one

- R7 — A signed-in shopper can review any product on sale: a star rating, which is
  required, and a title and a comment, which are not.
- R8 — A shopper may review the same product more than once, each published in its own
  right. Someone returning after six months of wear has something new to say, and an edit
  would overwrite the earlier experience rather than add to it.
- R9 — Each review stands on its own. Its author can edit or delete that one review
  without touching their others. Deleting does what the word promises the person who
  pressed it: the review leaves the product page, the count, the average and the org
  portal at once. The platform keeps the record (R16a).
- R10 — However many reviews one shopper writes about a product, they move its average as
  one voice: all are shown, the average counts their most recent. Without this, repeat
  reviewing sets a rating rather than describing it.
- R11 — The reviewer's displayed name comes from their account rather than the form, and
  renaming an account does not rewrite reviews already published. No surface reads the
  name from the account instead of from the review.
- R11a — Every review has an author, and always will: an account is deactivated, never
  deleted, so no review is ever anonymous.
- R12 — A guest who starts a review is offered the sign-in panel over the page
  ([seamless-sign-in](../seamless-sign-in/)) and returns to the form with what they had
  typed still in it.
- R13 — Submitting confirms in place: the review appears, the summary updates, and
  nothing navigates.
- R14 — A submission that fails says why and keeps what was typed.

### Moderating

- R15 — A review is published when it is written, and the platform can withdraw it
  afterwards. Withdrawing removes it from the product page and from the average;
  restoring returns it to both.
- R16 — Withdrawing is not deleting. A withdrawn review stays readable in the admin
  portal, because why it was withdrawn usually matters later.
- R16a — Nothing is destroyed, and the two ways a review can be hidden stay
  distinguishable: the admin portal shows whether the platform withdrew it or its author
  retracted it, and restoring a withdrawal never republishes what an author took back
  ([ADR-0032](../../adr/0032-records-people-authored-are-retired-not-deleted.md)).
- R16b — The moderation queue can show a review in full, photographs included. Clipped
  previews with no way to open one are not a queue anyone can moderate from.
- R17 — A selling organisation sees the reviews on its own products, withdrawn ones
  included, and cannot moderate them. Reviews their authors retracted are **not** shown —
  a retraction is not a moderation outcome, and showing it anyway would defeat it.

### Photographs and video in a review

- R18 — A review can carry photographs of the piece as it arrived. They are optional;
  the rating stays the only required field. A review carries **no video** — see
  [review-media](review-media/) R5a. The rest is [review-media](review-media/).
- R18a — A photograph on a review is one its own author uploaded — not merely a file on
  our storage, which would let a reviewer put a product's own photograph on their review
  and then delete it from storage by editing it back out.

## Subfeatures

| Subfeature | Requirement | Depends on |
| --- | --- | --- |
| [review-media](review-media/) | A review can show the piece as it arrived, in the buyer's own photographs | R7–R17 |

`review-media` shipped second: words and a rating are already the feature, while
photographs carry an upload path, a storage budget and a stranger's picture landing on an
org's page.

## Product acceptance

- A1 — A product carrying reviews shows a rating other than 0.0 on its page, on its
  listing tile and in search results, and all three agree.
- A2 — On a ~360px phone the summary, breakdown and reviews read in one column, and the
  control to write one is reachable without a hover.
- A3 — A shopper reviews a product twice: both appear, the count rises by two, and the
  average moves once.
- A4 — A shopper who bought the product sees **Verified purchase** on their review; one
  who did not, does not.
- A5 — A guest taps write, signs in through the panel, and lands back on the form with
  their draft intact.
- A6 — An admin withdraws a review: it leaves the product page, the average falls to
  match, and it is still visible in the admin portal.
- A7 — A shopper deletes one of their two reviews: the other is untouched, the count and
  average move, the org portal drops it, and an admin still reads it as **Deleted by
  author**.
- A7a — A photograph URL belonging to a product or another shopper is refused, and
  editing one out of a review never deletes the object it names.
- A8 — With a review withdrawn and nothing else done — no recount, no job — the product
  page, tile, lane and search result all read the new average.

## Decisions taken

- **Decided 2026-09-23 (product owner): nothing a person authored is hard-deleted, and
  the two ways a review is hidden get their own columns** (R9, R11a, R16a). Generalised
  to the whole project in
  [ADR-0032](../../adr/0032-records-people-authored-are-retired-not-deleted.md), which
  also settles the vocabulary and records the accepted cost: no reaping job, so reviews
  and their photographs accumulate for ever.
- **Decided 2026-09-23 (product owner): a review carries no video** (R18). A moderation
  decision, not a storage one — [ADR-0017](../../adr/0017-video-is-embedded-not-hosted.md)
  meant a video was never hosted anyway. A link to somebody else's host is content the
  platform cannot see, cannot take down, and which can change after it has been looked
  at: acceptable from an org on its own page, not from a stranger on someone else's.

- **Decided 2026-09-22 (product owner): reviewing does not require a purchase.** Anyone
  signed in may review any product on sale (R7); buying earns the **Verified purchase**
  mark (R4) rather than the right to write. A gate would leave a young catalogue with
  nothing to show. R10 and withdrawal are the only brakes until
  [rate-limiting](../rate-limiting/) lands.
- **Decided 2026-09-22 (product owner): reviews publish immediately.** R15 stands.
  Hold-for-approval remains the fallback if spam becomes real — a switch on one path, not
  a redesign — but then no review appears until someone looks.
- **Decided 2026-09-22 (product owner): a review can carry photographs** (R18),
  previously out of scope and left to [product-video](../product-video/). What a garment
  looks like on someone who is not a model is the one thing a review can add that the
  org's own photographs structurally cannot.
- **Decided 2026-09-22 (product owner): the product's stored rating and review count are
  dropped, not repaired** (R6a). Nothing has written them since the catalogue existed,
  and the first instinct — recompute on every write and every moderation — buys a second
  place the truth can be wrong, plus a backfill for the rows already wrong. How many
  people liked a product is a question about its reviews, not a fact about the product.
  [trd.md](trd.md) D9 carries the migration and its cost, and D4 the query that replaces
  the columns.

## Out of scope (this feature)

- A report-this-review control; helpful/unhelpful voting; sorting by rating; org replies.
- Emailing a buyer after delivery to ask for a review; reviewing an org, not a product.
- Purging retired reviews or their photographs on a schedule ([ADR-0032](../../adr/0032-records-people-authored-are-retired-not-deleted.md)).
- Throttling: the write route is unthrottled until [rate-limiting](../rate-limiting/)
  lands. R10 caps influence meanwhile, not volume.
