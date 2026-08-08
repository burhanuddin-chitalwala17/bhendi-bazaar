# TRD — server-side pricing authority

- **Status:** ✅ Implemented — PR-38
- **Domain:** checkout, payments
- **Phase:** 2 — Transaction integrity
- **Verified:** 2026-08-09
- **References:** [spec.md](spec.md), [ADR-0002](../../adr/0002-server-holds-pricing-authority.md), [Invariant 4](../../../CLAUDE.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Order creation re-reads prices inside the transaction that writes the order, and computes every monetary field itself. The request body keeps its line items — the store needs to know *what* is being bought — but contributes no prices. The gateway amount is then read back from the persisted order rather than passed through from the caller.

The sequencing matters: prices must be loaded in the same transaction that writes the order, or the price used for the total and the price checked against the catalogue can differ.

## Technical decisions
- **D1** — Prices are loaded with a single `findMany` over the line-item product ids inside the order transaction, not per-item lookups. One indexed query, and it avoids the N+1 shape already present in the older create path.
- **D2** — Client-supplied `price`, `salePrice`, `subtotal`, and `total` are **removed from the request schemas** rather than accepted-and-ignored. A field that is present but ignored will eventually be read by someone; removing it makes the mistake unavailable. This is a contract change ([CONTRACTS.md](../../CONTRACTS.md)).
- **D3** — The existing schema `.refine()` that checks internal total consistency is deleted, not tightened. Once the server computes the totals there is nothing for it to check, and leaving it implies client numbers still matter.
- **D4** — The client still sends the total it displayed, in a distinctly named field (e.g. `displayedTotal`), used **only** for the R5 mismatch comparison and never persisted. This is what makes "prices changed" detectable rather than silent.
- **D5** — `POST /api/payments/create-order` takes an order id and no amount. It loads the order and derives the gateway amount from it. `server/payments/payment.service.ts` currently range-checks a client amount; that check is replaced, not supplemented.
- **D6** — Sale-price selection (whether `salePrice` applies) is a server decision made during recomputation, so the rule lives in one place.

## Packages
None.

## Data model
No schema change. `Order` already stores `itemsTotal`, `shippingTotal`, `discount`, and `grandTotal`; this feature changes only who computes them. Field *types* change under [money-as-paise](../money-as-paise/), which should land first if both are in flight — recomputation logic written against `Float` would need rewriting.

## API / contract changes
Yes — `[CONTRACT]`. Create-order and payment-create-order request shapes change (D2, D5). The checkout client must be updated in the same PR. `CONTRACTS.md` is updated in lockstep.

## Test plan
Per [TESTING.md](../../TESTING.md), pricing computation is a 100%-branch target.
- An altered line-item price is ignored; the order persists at catalogue price.
- An altered total is ignored.
- A genuine mid-session price change produces the R5 rejection, not a silent adjustment.
- The gateway amount equals `grandTotal` for orders with and without shipping and discount.
- A line item referencing a nonexistent product fails the whole transaction.
- Sale price is applied when active and ignored when not.

## Delivery (PRs)
1. Server-side recomputation in the order transaction, with client prices still accepted but unused. Tests land here. No client change, so it is independently verifiable.
2. Remove the price fields from the schemas and add `displayedTotal`; update the checkout client. `[CONTRACT]`.
3. Derive the gateway amount from the persisted order.

## Questions closed (2026-08-09)
- **Q1** — Neither silent repricing nor per-line confirmation: the order is refused with a 409 ("Prices changed while you were checking out…") and the customer reviews and retries. The cart is not mutated behind their back; re-quoting happens by the page reloading its data. Per-line re-confirmation can be layered on later without contract changes.
- **Q2** — A decrease is a mismatch too, as recommended: the displayed total always equals the charge, in both directions.

## Recorded limitation
The **shipping rate** is still the client's selection, bounds-checked but not re-derived — the server cannot recompute a courier quote without calling the courier, and an external call inside the order transaction is worse than the exposure. Structural validation (provider id, non-negative integer paise) applies; verifying the rate against a fresh quote belongs to [shipping-fulfilment](../shipping-fulfilment/), which owns the courier conversation. The items side — the overwhelming share of any total — is fully server-priced.
