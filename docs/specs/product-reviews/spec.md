# Spec — product-reviews

- **Status:** 📝 Draft
- **Domain:** catalog, reading from checkout for the verified badge
- **Phase:** —
- **Verified:** 2026-09-21
- **References:** [seamless-sign-in](../seamless-sign-in/), [rate-limiting](../rate-limiting/), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

The product page shows what buyers have written about a piece, and a signed-in shopper
can add their own. The star rating carried by every listing, tile and search result is
the average of the published reviews, kept true as reviews arrive and as the platform
moderates them.

## Why

A buyer deciding on a piece has had nothing to go on but the seller's own photographs
and description. Reviews were stored and moderated from the day the catalogue existed,
but no storefront surface ever showed one, and the rating every tile and search result
carried was a number no buyer had contributed to — so the whole catalogue read as
unrated however many reviews it held.

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

### Writing one

- R7 — A signed-in shopper can review any product on sale: a star rating, which is
  required, and a title and a comment, which are not.
- R8 — A shopper may review the same product more than once, and each of those reviews
  is published in its own right. Someone who buys a piece again, or who comes back after
  six months of wear, has something new to say; an edit would overwrite the earlier
  experience instead of adding to it, and how a fabric lasts is exactly what the next
  buyer wants to know.
- R9 — Each review stands on its own. Its author can edit or delete that one review
  without touching their others, and what everyone sees updates with it.
- R10 — However many reviews one shopper writes about a product, they move its average
  as one voice: all are shown, and the average counts that shopper's most recent.
  Without this, repeat reviewing is a way to set a product's rating rather than to
  describe it.
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

## Open decisions

- **Whether reviewing requires a purchase.** Assumed not: anyone signed in may review,
  and buying earns the badge rather than the right. Requiring a purchase is more
  trustworthy, but leaves a young catalogue with nothing to show.
- **Whether reviews publish immediately.** Assumed yes, per R15. Holding every review
  for approval is safer, and is the fallback if review spam becomes real, but then no
  review appears until someone looks.

## Out of scope (this feature)

- Photographs or video inside a review.
- Helpful/unhelpful voting, sorting by rating, and seller replies.
- Emailing a buyer after delivery to ask for a review.
- Reviewing a seller rather than a product.
- Throttling: the write route is unthrottled until [rate-limiting](../rate-limiting/)
  lands. R10 is what limits the damage meanwhile, and it caps influence, not volume.
