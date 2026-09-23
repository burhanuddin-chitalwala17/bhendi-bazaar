# Spec — product-reviews

- **Status:** ✅ Implemented — PR-124
- **Domain:** catalog, reading from checkout for the verified badge
- **Phase:** —
- **Verified:** 2026-09-22
- **References:** [trd.md](trd.md), [review-media](review-media/), [seamless-sign-in](../seamless-sign-in/), [rate-limiting](../rate-limiting/), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is

The product page shows what buyers have written about a piece, and a signed-in shopper
can add their own — a rating, words, and photographs of what arrived. The star rating on
every listing, tile and search result is the average of the published reviews.

## Why

A buyer deciding on a piece has had nothing to go on but the seller's own photographs
and description. Reviews were stored and moderated from the day the catalogue existed,
but no storefront surface ever showed one, and the rating every tile carried was a number
no buyer had contributed to — so the catalogue read as unrated however many it held.

For clothing this is the most expensive gap on the page. Fit, fabric weight and how true
a colour is to the photograph are the questions that stop a purchase, and they are
precisely the questions only another buyer can answer.

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
- R6 — The rating and count agree everywhere they appear — product page, listing tile,
  search result, category lane, admin and org portals — and count published reviews
  only. A withdrawn review stops counting the moment it is withdrawn.
- R6a — Both numbers are read from the published reviews themselves. A product carries no
  rating of its own that a surface could show while the reviews say otherwise.

### Writing one

- R7 — A signed-in shopper can review any product on sale: a star rating, which is
  required, and a title and a comment, which are not.
- R8 — A shopper may review the same product more than once, and each of those reviews
  is published in its own right. Someone who buys a piece again, or who comes back after
  six months of wear, has something new to say; an edit would overwrite the earlier
  experience instead of adding to it, and how a fabric lasts is what the next buyer
  wants to know.
- R9 — Each review stands on its own. Its author can edit or delete that one review
  without touching their others, and what everyone sees updates with it.
- R10 — However many reviews one shopper writes about a product, they move its average
  as one voice: all are shown, and the average counts that shopper's most recent.
  Without this, repeat reviewing sets a product's rating rather than describing it.
- R11 — The reviewer's displayed name comes from their account rather than the form, and
  renaming an account does not rewrite reviews already published.
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
- R17 — A selling organisation sees the reviews on its own products, withdrawn ones
  included, and cannot moderate them. Moderation stays with the platform.

### Photographs and video in a review

- R18 — A review can carry photographs of the piece as it arrived, and a link to a video
  the reviewer has already published elsewhere. Both are optional; the rating stays the
  only required field. The rest is [review-media](review-media/).

## Subfeatures

| Subfeature | Requirement | Depends on |
| --- | --- | --- |
| [review-media](review-media/) | A review can show the piece as it arrived, in the buyer's own photographs | R7–R17 |

`review-media` ships second. Words and a rating are already the feature; photographs carry
an upload path, a storage budget and a stranger's picture landing on a seller's page.

## Product acceptance

- A1 — A product carrying reviews shows a rating other than 0.0 on its page, on its
  listing tile and in search results, and all three agree.
- A2 — On a ~360px phone the summary, the star breakdown and each review read in one
  column, and the control to write one is reachable without a hover.
- A3 — A shopper reviews a product twice: both appear, the count rises by two, and the
  average moves once.
- A4 — A shopper who bought the product sees **Verified purchase** on their review; one
  who did not, does not.
- A5 — A guest taps write, signs in through the panel, and lands back on the form with
  their draft intact.
- A6 — An admin withdraws a review: it leaves the product page, the average falls to
  match, and it is still visible in the admin portal.
- A7 — A shopper deletes one of their two reviews; the other is untouched.
- A8 — With a review withdrawn and nothing else done — no recount, no refresh, no job —
  the product page, the tile, the lane and the search result all read the new average.

## Decisions taken

- **Decided 2026-09-22 (product owner): reviewing does not require a purchase.** Anyone
  signed in may review any product on sale (R7); buying earns the **Verified purchase**
  mark (R4) rather than the right to write. A gate is more trustworthy and would leave a
  young catalogue with nothing to show. Accepted with it: the badge carries the trust the
  gate would have, and R10 plus withdrawal (R15) are the only brakes until
  [rate-limiting](../rate-limiting/) lands.
- **Decided 2026-09-22 (product owner): reviews publish immediately.** R15 stands — live
  when written, withdrawn afterwards. Holding every review for approval is safer and stays
  the fallback if spam becomes real — a switch on one path, not a redesign — but then no
  review appears until someone looks.
- **Decided 2026-09-22 (product owner): a review can carry photographs and a video
  link** (R18), previously out of scope here and left to reviews by
  [product-video](../product-video/). What a garment looks like on someone who is not a
  model is the most useful thing a review can add, and the one thing the seller's
  photographs cannot supply. [review-media](review-media/) holds the cost.
- **Decided 2026-09-22 (product owner): the product's stored rating and review count are
  dropped, not repaired** (R6a). Nothing has written them since the catalogue existed,
  and the first instinct — recompute on every write and every moderation — buys a second
  place the truth can be wrong, plus a backfill for the rows already wrong. How many
  people liked a product is a question about its reviews, not a fact about the product.
  [trd.md](trd.md) D9 carries the migration and its cost, and D4 the query that replaces
  the columns.

## Out of scope (this feature)

- A report-this-review control for buyers or organisations. R17 stands.
- Helpful/unhelpful voting, sorting by rating, and seller replies.
- Emailing a buyer after delivery to ask for a review.
- Reviewing a seller rather than a product.
- Throttling: the write route is unthrottled until [rate-limiting](../rate-limiting/)
  lands. R10 is what limits the damage meanwhile, and it caps influence, not volume.
