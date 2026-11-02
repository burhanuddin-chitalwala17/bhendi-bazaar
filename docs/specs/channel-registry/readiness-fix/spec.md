# Spec — readiness-fix

- **Summary:** The products page names what keeps products off each channel, and one page per missing fact lets the shop answer it for many products in one sitting
- **Status:** Implemented
- **Domain:** listing (readiness), with catalog (the answers)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-03
- **References:** [decisions.md](decisions.md), [channel-registry](../spec.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md), marketplace-integration [decisions](../../marketplace-integration/decisions.md) Q42, Q43

> Requirements and product approach only. A subfeature of channel-registry, whose readiness counts
> what is missing but offers no way to fix it except one product at a time.

## What this feature is
The "Ready to list elsewhere" card says, per channel, which fact is missing and on how many products,
with "Fix them". That opens a page listing only those products, each with its photo and a picker, so
the shop answers them one after another or several at once.

## Why
On 2026-11-03 Google would take 1 of the shop's 83 typed products, because 79 have no colour. The
card counted the gap and offered nothing but each product's own page. Nobody fixes 79 products that way.

## Requirements
- R1 — The card names each channel's missing compulsory facts with their counts, most common first,
  and a "Fix them" for each (Q2, Q8); gaps the shop cannot fix say why and offer "Ask the admin" (Q7).
- R2 — The fix page lists the products missing that fact for that channel, each with its main photo,
  name and SKU, and a picker of our answers (Q3).
- R3 — A pick saves at once and moves the row to Done, with Undo (Q4, parent Q43).
- R4 — Several rows can be ticked and answered with one pick; only empty answers are written (Q5).
- R5 — A marketplace's own word for the fact shows beside the picker as evidence, never pre-picked (Q6).
- R6 — The card's counts and the page agree; an answered product leaves both.
- R7 — Nothing here stops a product being saved or listed (ADR-0053).

## Hazards the TRD must answer
- **Overwriting:** a bulk pick must not replace an answer typed meanwhile on the product. *Answered by D2.*
- **A pick that is not one of the product's type's answers** must be refused, not stored. *Answered by D2.*

## Product acceptance
- A1 — On a phone, the card reads "Google Shopping · 79 need a colour · Fix them"; tapping opens the page with 79 rows.
- A2 — Picking Black on one row saves it; the row moves to Done; Undo empties it again.
- A3 — Ticking five rows and choosing Green sets all five; a sixth answered elsewhere meanwhile is left and named.
- A4 — A row whose Amazon listing said "Dark Green" shows "Amazon says: Dark Green", nothing pre-picked.
- A5 — Fragrance shows "3 have no Google category · Ask the admin".

## Scope
- **Outcome:** the shop clears a channel's missing facts in one sitting.
- **In:** R1–R7 for every channel the shop sells on.
- **Later:** a colour suggested from the photo (Q9).

## Open questions
None.
