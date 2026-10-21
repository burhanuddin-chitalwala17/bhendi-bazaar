# Spec — channel-import

- **Summary:** After a shop connects Amazon or Flipkart, every listing it has there appears in an inbox on Bhendi Bazaar, and listings whose SKU equals one of its products link to that product by themselves, undoably
- **Status:** Accepted
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-21
- **References:** [decisions.md](decisions.md), parent [marketplace-integration](../spec.md) and its [decisions](../decisions.md), [channel-connectors](../channel-connectors/), [INTEGRATIONS.md](../../../INTEGRATIONS.md#connecting-a-seller-what-the-two-apis-actually-do), TRACKER F-013, F-014

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 2 of
> marketplace-integration.

## What this feature is
The shop connects Amazon, and a moment later sees every listing it has there: title, SKU, price,
stock and status, in one list. The ones whose SKU is already a product here are linked to it and
marked so. The rest wait under "Not linked" for product-merge to settle.

## Why
Most shops that arrive already sell on Amazon or Flipkart. Before anything can be synced or
published, Bhendi Bazaar has to know which listing over there is which product here; without that
link a sale on Amazon has no stock to reduce. Reading the listings and linking the obvious ones by
the shop's own SKU is that first step, and it changes nothing on the marketplace.

## Requirements
- R1 — Connecting a marketplace starts a read of every listing the shop has there; the shop can
  leave the page while it runs and sees progress when it returns (Q7).
- R2 — "Read again" repeats the read at any time. A read changes nothing on the marketplace.
- R3 — Each listing appears once, with what the marketplace says about it: title, SKU, its id
  there (ASIN or FSN), status, price, stock, and an image when the marketplace gives one (Q8; Flipkart gives none to our app, Q20).
  Variants show as the marketplace groups them: an Amazon parent is a header over its sizes or
  colours, each still its own row and link; Flipkart says nothing about grouping (Q9, Q15).
- R4 — A listing whose SKU equals a product's SKU, ignoring case and surrounding spaces, links to
  that product by itself and is marked "linked by SKU" (Q3). A product archived here still links,
  and says so (Q4).
- R5 — The owner can undo any automatic link with one tap; the listing returns to "Not linked" and
  later reads never link it again on their own (Q5). "Link back" restores that same match (Q16);
  linking a listing to any other product is product-merge's (Q6).
- R6 — The same product may be linked to one listing on each marketplace; that is the same item
  sold in two places, not a conflict.
- R7 — A listing that is gone from the marketplace is marked so on the next read, keeping its link
  (Q12). Listing rows and links stay when the shop disconnects (Q11).
- R8 — A Flipkart account already connected in another shop is refused when its listings are
  read: the connection is ended, and the card says why (Q10; on Flipkart only once a call names the account, Q20).
- R10 — Tapping a listing opens its details beside the linked product's, differences marked, saying
  plainly that linking changes nothing on the product (Q17). Choosing what wins is product-merge's (Q18).
- R11 — A linked product's editor shows, read-only, where it is linked: per marketplace its id, status
  there, price and stock as reported, and a way to its listing; or "Not linked" (Q19).
- R9 — Import creates no product, family or photo (Q2); unlinked listings wait for product-merge,
  which also builds families from the marketplace's grouping.

## Hazards the TRD must answer
- **Big catalogues.** A shop with thousands of listings and marketplace rate limits must not time
  out, block the page, or leave a half-read inbox that looks complete.
  *Answered by D4, D5, D2.*

- **A read interrupted midway** (rate limit, network, token) must resume or retry without creating
  duplicate rows.
  *Answered by D8, D9.*

- **Two reads at once** (connect, then an impatient "Read again") must not double the rows.
  *Answered by D3.*

- **An undone link coming back** on the next read.
  *Answered by D7.*

- **Recognising a Flipkart account** by the `sellerId` its product search returns, and what to do if
  a shop's first read is the one that finds the clash.
  *Answered by D6.*

## Product acceptance
- A1 — On a phone, after connecting Amazon, the Listings page fills with the shop's listings, with a
  progress line while it reads.
- A2 — A listing whose SKU equals a product's SKU (different case, extra spaces) shows "Linked by
  SKU" with the product's name.
- A3 — Undo a link; "Read again"; the listing stays under "Not linked".
- A4 — Reading twice gives the same rows, never duplicates.
- A5 — A listing removed on Amazon shows "No longer on Amazon" after the next read.
- A6 — No product is created and nothing changes on the marketplace.
- A9 — An Amazon item in four sizes shows as one group of four rows, each linked by its own SKU.
- A7 — Every state in ux.md's matrix for the Listings page is reachable and reads as written.
- A8 — Verified on the owner's own Amazon and Flipkart catalogues.

## Scope
- **Outcome:** every listing is in the inbox; exact-SKU matches link themselves, undoably.
- **In:** R1–R9.
- **Later:** manual linking and name suggestions (Q6), creating products and copying photos — both
  product-merge; daily re-reads for new listings — inventory-sync's resync (parent Q31).

## Open questions
None. Q2 decided by the owner 2026-10-21.
