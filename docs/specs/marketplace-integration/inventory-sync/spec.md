# Spec — inventory-sync

- **Summary:** One stock figure per product: a sale, a cancellation or a stock edit anywhere moves it, and every connected marketplace shows it within minutes, so nothing is sold that the shop does not have
- **Status:** Implemented
- **Domain:** channels, with catalog and checkout
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-04
- **References:** [decisions.md](decisions.md), parent [marketplace-integration](../spec.md) (Q24, Q30–Q32, Q35, Q38–Q40), [INTEGRATIONS.md](../../../INTEGRATIONS.md) "Detecting a sale", [ADR-0007](../../../adr/0007-conditional-stock-decrement.md), [ADR-0044](../../../adr/0044-a-marketplace-orders-money-is-reported-not-computed.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 7 of
> marketplace-integration; it needs only linked listings, so it does not wait for family-merge or
> channel-listings.

## What this feature is
The shop has one count of each product. When it sells on Bhendi Bazaar, Amazon or Flipkart, or the
shop corrects a count, every connected marketplace shows the new number without the shop visiting it.

## Why
Today each marketplace keeps its own count, and the Settle page warns "Amazon and Flipkart keep
their own count until stock sync is on." An item sold on Amazon stays on sale on Flipkart; selling
it twice means a cancellation, a penalty and an unhappy buyer. One figure, sent everywhere, removes that.

## Requirements
- R1 — Bhendi Bazaar's stock is the one figure (parent Q24). Marketplaces show it; no per-marketplace
  count, cap or buffer (parent Q35).
- R2 — A sale on a connected marketplace is found within about ten minutes (Q26, superseding parent Q30's five) and lowers
  the product's stock once, however many times the marketplace reports it.
- R3 — A marketplace sale of stock already gone is recorded and flagged oversold, never refused
  (parent Q32); the shop sees which product and which order.
- R4 — A marketplace order cancelled before dispatch puts its stock back (parent Q38).
- R5 — Any change to a product's stock (a sale anywhere, a cancellation, the shop's own edit) is
  sent to every other marketplace listing linked to it at once, the moment it is known, each change
  on its own; a count that reaches 0 goes first (Q19). A marketplace sale is known when the order
  check finds it, every ten minutes (Q26).
- R6 — Once a day every linked listing's count is read and compared with ours; a different count is
  put right at once and the correction is recorded for the shop to see (parent Q31, Q40).
- R7 — A marketplace order is recorded with its amounts as the marketplace reports them (ADR-0044),
  and never enters what the shop is owed by the platform.
- R8 — Only linked listings are touched. A listing that is not linked, left off, or held in the
  marketplace's own warehouse is never changed (Q5, Q11).
- R9 — Sync is per marketplace, starts on connecting and can be paused; the shop sees, per marketplace,
  anything that failed or needs it (Q28).
- R11 — Each marketplace pickup location is matched once to one of the shop's own (Q15); a sale, a
  push and the daily read each act on that matched location's count. A location without a match
  holds sync for that account until the owner matches it or marks it not used (Q16).
- R10 — Every marketplace goes through the same path; a marketplace capability we cannot use yet
  (Flipkart's order and stock calls, if refused) stays off and says so, with no rework when allowed (parent Q4, Q12).

## Hazards the TRD must answer
- **Counting a sale twice:** a marketplace reports the same order on every poll; stock must move once. *Answered by D4.*
- **Racing sales:** a Bhendi Bazaar order and an Amazon order for the last item at the same moment
  must leave a true count and one oversold flag, never a negative stock hidden from the shop. *Answered by D4.*
- **Sending a stale number:** two quick changes must not end with the older figure on the marketplace. *Answered by D2, D3.*
- **A marketplace that is down or refuses** must not lose the change; it is sent when it comes back. *Answered by D3.*
- **Rate limits:** a shop with hundreds of listings must stay within each marketplace's limits. *Answered by D2, D3, D6.*
- **A sale with no location**, or from a location not matched, must still land on one count and
  say so (Q18). *Answered by D4.*
- **A wrong first push:** the first send puts our count over every linked listing's; a listing put out
  of stock must be named to the shop, and an unlinked one never touched (Q28, Q11). *Answered by D6.*

## Product acceptance
- A1 — An item sold on Amazon shows one less on Bhendi Bazaar and on Flipkart within about ten minutes (the order check, Q26).
- A2 — An item sold on Bhendi Bazaar shows one less on Amazon and Flipkart within a minute.
- A3 — The shop changes a count on its phone; both marketplaces show it within a minute.
- A4 — The last item sold on two marketplaces at once shows 0 stock and one sale flagged oversold.
- A5 — A cancelled Amazon order before dispatch puts the item back everywhere.
- A6 — A count changed by hand on Amazon is put back to ours the next day, and the shop sees it was.
- A7 — Turning sync on shows, before anything is sent, which listings will change and to what.

## Scope
- **Outcome:** one stock figure per product, kept on every connected marketplace.
- **In:** R1–R10 for Amazon (seller-fulfilled) and Flipkart where its API allows; the per-marketplace
  switch and status; the first-push preview; recording marketplace orders for stock.
- **Later:** instant sale notifications (parent Q34, Q13 here); returns (Q14); a full marketplace
  orders screen with fulfilment (Q10); stock for Amazon's warehouse (FBA) (Q5).

## Open questions
None. Q12 settled by the production check of 2026-10-29.
