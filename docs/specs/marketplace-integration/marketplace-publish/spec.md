# Spec — marketplace-publish

- **Summary:** The shop publishes listing changes and new listings to Amazon and Flipkart from here, after seeing every change, and sees each one's result on the field it concerns
- **Status:** Implemented
- **Domain:** channels, with listing (readiness, Amazon's facts) and catalog (photos)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-02
- **References:** [decisions.md](decisions.md), parent [marketplace-integration](../spec.md) (Q1, Q4, Q33, Q39), [channel-listings](../channel-listings/spec.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md) "Editing and creating a listing", [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)

> Requirements and product approach only. The technical approach was trd.md, removed once shipped (ADR-0073): `git show 431ed6e7:docs/specs/marketplace-integration/marketplace-publish/trd.md`. Subfeature 8, the
> last of marketplace-integration.

## What this feature is
"Publish" on a listing, or on a marketplace's Listings page, sends the changes waiting to that
marketplace and follows each until the marketplace has taken it or said what is wrong. "Put on
Amazon" makes a product, or a whole family, an Amazon listing: on a page already there or a new one.

## Why
channel-listings lets the shop prepare each listing; until it can be sent, every change is still
made twice. Publishing from here is what makes one entry the shop's whole job (parent Q1), and the
time saved against 5–10 minutes per Amazon listing is measured here.

## Requirements
- R1 — Nothing reaches a marketplace until the shop taps Publish after a review of every change,
  old against new, each undoable (Q2, Q3). Stock is not part of this (inventory-sync).
- R2 — A listing or every listing with changes on one marketplace can be published at once (Q3).
- R3 — Each listing shows where it stands (Q4); progress and result never share a word.
- R4 — The marketplace's answer comes back without the shop asking, within hours (Q5), and any
  complaint shows on the field it concerns, or at the top when it names none (Q6).
- R5 — A product, or a family with all its members, can be put on Amazon: on its existing page or
  on a new one (Q7, Q11), with or without a barcode (Q8).
- R6 — A new page is checked by Amazon before it is created; its answers show first (Q9).
- R7 — Facts Amazon needs for the product's type show as readiness on the product (Q10).
- R8 — On Flipkart, price and on sale or paused publish; new products and content say Seller Hub (Q12).
- R9 — A big price change is marked on the review, never refused (Q13).
- R10 — A listing can be paused and resumed without being deleted (Q17).
- R11 — When Amazon shows something other than what was sent, the listing says so (Q14).
- R12 — A busy marketplace is retried; a refusal waits for the shop with the reason (Q15).

## Hazards the TRD must answer
- **Sending what was not reviewed:** a change made between the review and the tap must not be sent. *Answered by D3.*
- **Two publishes of one listing at once** (two tabs, a retry) must not interleave. *Answered by D3.*
- **Overwriting by omission:** Amazon's full replace drops every attribute not sent. *Answered by D2.*
- **A duplicate page:** creating a new Amazon page for a product already sold there. *Answered by D6.*
- **A partial family:** the family page made and some members refused. *Answered by D7.*
- **Rate limits:** fifty listings published at once must stay within five requests a second. *Answered by D4.*
- **Prices in the wrong unit:** paise to Amazon's decimals and Flipkart's whole rupees. *Answered by D2.*
- **Waiting forever:** a listing stuck in "Pending" (Q25) when Amazon never answers. *Answered by D5.*

## Product acceptance
- A1 — From a listing with two changes, Review shows both old → new; undoing one and publishing sends
  one; the listing reads "Pending" (Q25), then "Live" within the hour.
- A2 — A change Amazon refuses shows "Needs attention" and "Amazon says: …" on that field; fixing it
  and publishing again clears it.
- A3 — Publishing all on the Amazon Listings page ends in "10 sent · 2 need attention", each tappable.
- A4 — A product with no Amazon listing, found on Amazon by name, is put on that page; its listing
  shows live with our price.
- A5 — A family of three colours with no barcode is created on Amazon as one page with three; if
  Amazon wants a barcode exemption, the listing says so and how to get it.
- A6 — A Flipkart price change publishes and shows live; its title says "Change it in Seller Hub".
- A7 — Pausing an Amazon listing takes it off sale there and keeps it; resuming puts it back.
- A8 — Changing a price from ₹1,299 to ₹299 is marked "Big change" on the review.

## Scope
- **Outcome:** listing changes and new listings reach the marketplace from here, with their result.
- **In:** R1–R12, Amazon end to end and Flipkart's price and status.
- **Later:** instant results by notification (Q20); a business price (Q21); a family's own photos
  (family-merge Q15).

## Open questions
None. Q19 needs the owner's OK for one read-only production call before its unit.
