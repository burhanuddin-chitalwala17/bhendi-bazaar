# Spec — promotions

- **Status:** 🔨 In progress — engine, checkout, offers API and salePrice retirement landed (PR-67); admin/org screens outstanding
- **Domain:** promotions *(new)*, catalog, checkout
- **Phase:** 7 — Promotions & settlement
- **Verified:** 2026-08-16
- **References:** [trd.md](trd.md), [org-payouts](../org-payouts/), [ADR-0002](../../adr/0002-server-holds-pricing-authority.md), [ADR-0004](../../adr/0004-money-as-integer-paise.md), [ADR-0007](../../adr/0007-conditional-stock-decrement.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is
The platform and each selling organisation can run time-boxed offers — either applied automatically to the price a buyer sees, or unlocked by a coupon code entered at checkout.

## Why
Today the only way to reduce a price is to edit a single product's sale price by hand, with no end date, no reason recorded, and no way to say who paid for it. That cannot express a campaign — "20% off Electronics this weekend", "₹500 off your first order" — and it cannot answer the question that follows every campaign, which is what it cost and who bore it.

It also cannot express the marketplace's actual shape. An org discounting its own goods and the platform discounting everything are different acts funded by different parties, and a store that cannot tell them apart cannot pay its organisations correctly.

The buyer's side matters just as much: an offer nobody can see does not sell anything, and a coupon that covers half a basket without saying so is worse than no coupon at all.

## Requirements

### What an offer is
- **R1** — Both the platform and an organisation can create offers. An organisation's offer only ever touches that organisation's products.
- **R2** — An offer applies to everything in its scope, to a category, or to a single product. A category offer includes that category's descendants.
- **R3** — The way an offer chooses its products accepts new kinds of target later without redesigning existing offers.
- **R4** — Every offer has a start and an end. No offer runs indefinitely.
- **R5** — An offer can be stopped immediately, independently of its end date.
- **R6** — An offer either applies by itself, or requires a coupon code. Both kinds are otherwise the same thing.
- **R7** — An organisation's markdown on a single product is an offer like any other, not a separate mechanism.

### What the buyer gets
- **R8** — When more than one offer could apply to an item, the buyer gets the best one. Offers never stack.
- **R9** — An automatically applied offer is visible as the item's price wherever that item appears — listings, product page, cart, checkout.
- **R10** — An item's final charged price is never higher than the price the buyer was shown for it.
- **R11** — A coupon code is entered at checkout. The cart tells the buyer that a code can be applied there.
- **R12** — When a coupon covers only part of a basket, the buyer is told which items it covered and which it did not, before paying.
- **R13** — A coupon that would take nothing off the current basket is refused with a reason that names what it applies to.
- **R14** — Entering a code that is worth less than an offer already running never reduces what the buyer already had, and the buyer is told why it was not applied.
- **R15** — At most one coupon code applies to an order.

### What the store guarantees
- **R16** — A discount amount is never accepted from the browser. A coupon code is the only promotional input a request may carry.
- **R17** — An offer that expires, is stopped, or is exhausted between the buyer reviewing the total and paying does not result in a different amount being charged silently.
- **R18** — A coupon's usage limit is honoured exactly, including when several buyers redeem it at the same moment.
- **R19** — Every discount applied to an order records which offer produced it and how its cost was divided between the platform and the organisation.
- **R20** — An organisation cannot create an offer scoped to another organisation, and cannot discount deeper than a limit the platform sets for it.
- **R21** — Deleting a category or a product never silently changes what an offer covers, and never removes the record of a discount already applied to an order. Where that would happen, the deletion is refused instead.

## Product acceptance
- **A1** — A platform offer created for a category reduces the shown price of every product in that category and its sub-categories, on a phone, without the buyer taking any action.
- **A2** — The same product's price returns to normal on its own once the offer's end time passes.
- **A3** — A basket containing one covered and one uncovered item shows the coupon applied to the first, plainly marked, and the total reflects only that item.
- **A4** — A code for goods absent from the basket is refused with a message naming what it applies to, and no total changes.
- **A5** — With a 20% platform offer running, a 10% code changes nothing and says so.
- **A6** — A coupon limited to 100 uses is redeemed exactly 100 times under concurrent load.
- **A7** — A coupon that expires while the buyer is on the payment screen produces a clear message, not a different charge.
- **A8** — An order's record shows, for each discount, the offer that caused it and the split between platform and organisation.
- **A9** — An organisation user cannot create or edit an offer belonging to another organisation.
- **A10** — Deleting a category that an offer targets is refused; the offer does not quietly widen to the whole store.

## Out of scope (this feature)
- Paying organisations what they are owed — [org-payouts](../org-payouts/), which consumes R19's funding split.
- Refunds and cancellations. The funding split is recorded so a refund can be computed later; the flow itself is Phase 5.
- Buyer-specific targeting — first-order-only, segments, referral codes.
- Free-shipping offers. Shipping is quoted per parcel from separate origins, which makes it a different problem.
- Automatically surfacing available codes to buyers, beyond telling them codes exist.
