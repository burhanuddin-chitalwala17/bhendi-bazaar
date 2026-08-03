# TRD — product weight and rates

- **Status:** Draft
- **Domain:** catalog, shipping
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-03
- **References:** [spec.md](spec.md), [Invariant 4](../../../CLAUDE.md), [CONTRACTS.md](../../CONTRACTS.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Weight is already a column on `Product` with a default, and already a field on the admin form's input type. The gap is in between: the server-side product input type omits it, so the repository's create and update never write it, and the value is discarded at the boundary without error. Closing that gap is mostly reconciling two declarations of one shape — the same duplicate-declaration problem recorded in [CONTRACTS.md](../../CONTRACTS.md).

Then weight has to travel: `Product` → cart item → shipment → rate request. It currently drops out at the cart boundary, where the client and server `CartItem` shapes disagree about whether weight exists.

## Technical decisions
- **D1** — Reconcile the product input type to one declaration used by form, route, and repository. Fixing only the repository would leave the same class of silent drop available to the next field added.
- **D2** — Whitelist explicitly in create *and* update, symmetrically ([Invariant 4](../../../CLAUDE.md)). This bug is precisely a whitelist that omitted a field, so the countermeasure is the same rule.
- **D3** — Weight becomes **required** in the product schema rather than optional-with-default. A default that silently substitutes for a missing value is what made this invisible; requiring it makes the omission a validation error at entry.
- **D4** — R6 is served by a one-off review: since all existing products carry the identical default, "weight equals the default" is a usable proxy for "never set". That proxy stops working once real weights are entered, so the audit list must be generated before or during rollout, not after.
- **D5** — The unit is **kilograms**, stated in the schema comment, the form label, and the DTO. The courier API expects kilograms, so converting anywhere else would add a conversion for no reason.
- **D6** — Weight is carried on the cart item so a quote can be produced before an order exists, which requires one `CartItem` shape ([CONTRACTS.md](../../CONTRACTS.md)). This is the dependency that makes cart DTO consolidation a precondition rather than a nice-to-have.
- **D7** — The rate calculator's fallback stays, but records that it was used so R5/A5 are satisfiable. Removing the fallback entirely would turn a missing weight into a failed checkout, which is worse than a flagged estimate.

## Packages
None.

## Data model
`Product.weight` exists. D3 changes it from optional to required, which needs a backfill decision for existing rows — they already hold the default, so the migration can mark them as-is and rely on D4's audit rather than blocking. `[MIGRATION]`

## API / contract changes
Yes — `[CONTRACT]`. The product create and update shapes gain a required `weight`; `CartItem` consolidates to one declaration carrying it. Admin client and checkout move in step.

## Test plan
Per [TESTING.md](../../TESTING.md), shipping rate calculation is a moderate target; the persistence path is high, because a silent drop is exactly what happened.
- Creating a product with a weight persists it — asserted by reading back from the database, not from the response.
- Updating a weight persists the new value.
- A product payload without a weight is rejected (D3).
- Shipment weight scales with quantity.
- Two different weights produce two different quotes.
- A fallback weight is flagged in the quote.
- Weight survives the cart round trip — the regression test for D6.

## Delivery (PRs)
1. Reconcile the product input type and whitelist weight in create and update, with the read-back test. This alone stops the loss.
2. Make weight required; migration; admin form validation.
3. Consolidate `CartItem` so weight reaches the rate request. `[CONTRACT]`
4. Fallback flagging (R5) and the missing-weight audit list (R6).

PR 1 is the highest-value slice and is independently shippable — new products stop losing their weight even before anything downstream consumes it.

## Open questions
- **Q1** — What weight do the existing products actually have? Answering this is a catalogue task, not an engineering one, and it gates A6. The audit list (D4) is the tool; someone has to do the weighing.
- **Q2** — Should a missing weight block a product from being published, or only flag it? Blocking is stricter but may obstruct drafting a product before it is physically in hand.
- **Q3** — Do any products ship in packaging heavy enough to matter, requiring a per-product packaging allowance rather than a single global one?
