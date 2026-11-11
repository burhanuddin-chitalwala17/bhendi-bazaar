# Spec — own-store/offers-hardening

- **Summary:** No offer costs the platform more than it chose to spend: every discount is exact, bounded, counted under concurrency and reversed only for the goods that came back
- **Status:** Implemented — 2026-10-29, units 1–6 (55292be…02c9e5e) on branch offers-hardening
- **Domain:** promotions, payouts, with checkout and catalog
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-10-29
- **References:** `431ed6e7:docs/specs/own-store/offers-hardening/trd.md`, [decisions.md](decisions.md), `431ed6e7:docs/specs/own-store/offers-hardening/ux.md`, [../decisions.md](../decisions.md) Q2–Q7, Q20, Q21, [promotions](../../promotions/), [org-payouts](../../org-payouts/), [ADR-0018](../../../adr/0018-one-effective-price-function.md), [ADR-0019](../../../adr/0019-discount-is-one-winning-offer.md), [ADR-0020](../../../adr/0020-money-bearing-records-never-cascade.md)

> Requirements and product approach only. The technical approach was trd.md, removed once shipped (ADR-0073): `git show 431ed6e7:docs/specs/own-store/offers-hardening/trd.md`.

## What this feature is
The offer engine and the earnings ledger, made safe to hand to self-serve shops and to run
platform campaigns on. An audit on 2026-10-29 found the money rules mostly sound and eight places
where they could be beaten or misapplied; this feature closes each with a test that proves it.

## Why
An offer is the one place where a typo, a race or a clever seller turns directly into money the
platform pays out. The platform funds part of every campaign it runs and credits shops before
delivery, so each gap below is a real loss, not a display glitch.

## Requirements
- **R1** — When one parcel is cancelled, lost or returned, only that parcel's goods are reversed in
  its own shop's earnings. Other shops on the order, and that shop's other parcels, are untouched.
  When every parcel has come back, the reversals sum to the sale exactly, to the paise.
- **R2** — A "use N times per customer" limit holds when the same buyer checks out several times at
  the same moment.
- **R3** — A shop's own share of the discount on a line never exceeds its discount ceiling, whatever
  produced it: a percentage, a flat amount, a fixed sale price or a coupon (own-store Q4).
- **R4** — A platform offer that could cost more than the platform's commission exists only after
  an admin confirms the loss in words and sets a budget. Spending never passes the budget; the offer
  stops applying when the budget is spent (own-store Q20).
- **R5** — The platform's share of a discount is worked out on the product's lowest price in the
  previous 30 days. The buyer still gets the advertised discount on the price shown; the shop funds
  any difference its own price rise created (own-store Q21).
- **R6** — The checkout preview and the charge agree when the same item is added twice.
- **R7** — A coupon that is no longer the best deal by payment time is quietly set aside, never an
  error and never counted as used; the order is charged the better price.
- **R8** — The database itself refuses an impossible offer or line discount: a percentage outside
  0–100, a non-positive amount, a negative count, a line discount above the line's value.

## Product acceptance
- **A1** — Shop A ₹1,000 and shop B ₹5,000 in one order; A's parcel is cancelled → only A's earnings
  are reversed; B's entry and the platform's commission on B are unchanged.
- **A2** — One shop, two parcels of the same line (3 + 2 units); both returned → reversal totals equal
  the sale entry exactly, including when the line's discount does not divide evenly.
- **A3** — Two simultaneous checkouts by one buyer with a once-per-customer code → one succeeds, the
  other is refused with "You have already used CODE."
- **A4** — A shop capped at 50% sets ₹9,999 off a ₹10,000 item, or a ₹1 sale price → the form says
  the cap; any older offer that now breaches it takes off at most 50% on the product page and at
  checkout alike.
- **A5** — An admin creating a 30% platform offer where commission is 15% sees the loss warning, must
  type CONFIRM LOSS and a budget; with a ₹1,000 budget, the order that would pass it is refused with
  "That offer has just ended", and the offer then disappears from product pages.
- **A6** — Price ₹1,000 for 30 days, raised to ₹1,500, then a 20% platform offer → buyer pays ₹1,200;
  the platform funds ₹200 and the shop ₹100.
- **A7** — Same item added as quantity 1 and quantity 5 → preview discount equals the charged one.
- **A8** — A coupon applied at review, overtaken by a better automatic offer before payment → no
  coupon error; the coupon is not counted as used. If the total the buyer saw is now out of date, the
  usual "prices changed, please review" check asks them to confirm the lower total (ADR-0018).
- **A9** — Inserting a 150% offer or a line discount above its line's value directly in the
  database fails.

## Scope
- **Outcome:** an offer can no longer cost the platform money it did not choose to spend.
- **In:** R1–R8; the loss confirmation and budget on the admin offer form, and budget use on the
  offers list (R4); the ceiling message on the shop's offer form and sale price (R3).
- **Later:** Q8 (a shop ending its own markdown before a campaign), Q9 (rate-limiting coupon
  guesses, in [rate-limiting](../../rate-limiting/)), Q10 (coupon use given back on cancellation,
  with order-fulfilment).

## Open questions
None.
