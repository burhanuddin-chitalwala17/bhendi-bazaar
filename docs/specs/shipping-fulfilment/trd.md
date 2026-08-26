# TRD — shipping fulfilment

- **Status:** Delivery 1 landed 2026-08-25 (below); Delivery 2–5 not started.
- **Domain:** shipping
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-25
- **References:** [spec.md](spec.md), [product-weight-and-rates](../product-weight-and-rates/), [ADR-0005](../../adr/0005-payment-state-server-only.md), [INTEGRATIONS.md](../../INTEGRATIONS.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
The real provider integration already exists and already satisfies the provider interface — it is what produces the rate quotes. Fulfilment calls a separate placeholder module instead. So this is largely a matter of routing booking through the same provider that quoted, then handling the failure modes a real network call has and a placeholder does not.

The interesting work is not the call; it is everything around it. A placeholder cannot fail, so nothing downstream currently handles a booking that is rejected, times out, or succeeds twice.

## Technical decisions
- **D1** — Booking goes through the existing provider interface, so the placeholder is **deleted** rather than left in place behind a flag. A module named `mock…` that is reachable in production is how this situation arose; keeping it as a fallback would preserve the failure mode.
- **D2** — A test double replaces it for testing, living under `tests/` where it cannot be imported by application code. This is the distinction that matters: a test double in the test tree is fine, a mock in the source tree is not.
- **D3** — Booking happens **after** payment confirmation, triggered by the state transition owned by [payment-confirmation](../payment-confirmation/) — not inside the order transaction. A courier API call must not hold a database transaction open, and a courier failure must not roll back a successful payment.
- **D4** — Booking is therefore a separate, retryable step with its own state on the shipment: awaiting booking, booked, failed. R3 depends on this state being distinct from the order's payment state.
- **D5** — Retries are bounded and idempotent, keyed so a retry cannot produce a second parcel. `server/shared/retry.ts` exists but retrying a placeholder proved nothing; a real booking needs idempotency, not just repetition.
- **D6** — Courier status updates arrive by webhook. The handler verifies the request before trusting it, and fails loudly on an unrecognised payload, per the reasoning in [ADR-0005](../../adr/0005-payment-state-server-only.md) — a silently-swallowed webhook is the failure mode this project has already been bitten by once.
- **D7** — The weight sent is the one the quote used, read from the persisted shipment rather than recomputed at booking time, so R4/A4 hold even if a product's weight changes in between.
- **D8** — Sequenced strictly after [product-weight-and-rates](../product-weight-and-rates/). Booking at default weights turns a pricing error into a reconciliation problem with real invoices.

## Packages
None — the provider integration uses `fetch` directly.

## Data model
`Shipment` gains booking state and a place for the courier's error response (D4, R7). Existing tracking fields are reused for the real reference. `[MIGRATION]`

## API / contract changes
Customer-visible tracking data becomes real, and its shape may change to include a courier-provided URL rather than a constructed one. The courier's webhook payload is their contract — recorded in [INTEGRATIONS.md](../../INTEGRATIONS.md), not here.

## Test plan
Never call the live courier API from a test ([TESTING.md](../../TESTING.md)). Test our request construction and response handling against the D2 double.
- A confirmed order produces a booking request with the expected weight, addresses, and courier code.
- A courier rejection leaves the shipment `failed` and the order not appearing fulfilled.
- A timeout is retried, and the retry does not create a second parcel (D5).
- A status webhook updates the shipment; an unrecognised one fails loudly.
- Cancellation propagates.
- The weight sent equals the weight the quote used, even after the product's weight changes.

## Delivery (PRs)
1. ~~Booking state on `Shipment`, plus the test double. Inert.~~ **Skipped as its own step** — Delivery 2 reused the existing `status`/`shippingMeta` fields instead of adding dedicated booking-state columns, to land the customer-visible fix without a migration. Revisit if `shippingMeta.fulfillmentError` proves too informal for R7's admin visibility.
2. **Landed 2026-08-25.** Booking routed through the real provider (`IShippingProvider.createShipment()`, `ShiprocketProvider`), triggered from `onPaymentConfirmed` (D3), with failure handling: a shipment stays `pending` until booked, becomes `confirmed` or `failed`, and only `pending` shipments are attempted — the idempotency guard in place of a per-attempt API idempotency key.
3. **Landed 2026-08-25.** `providers/_placeholder/mock.booking.ts` is deleted.
4. Status webhook handling. **Not started** — R5/A5 remain open.
5. Cancellation. **Not started** — R6 remains open.

## Open questions
- **Q1** — Resolved 2026-08-10: book for real (see spec.md).
- **Q2** — Who pays when a courier's actual charge exceeds what the customer was quoted? **Still unresolved** — Delivery 2 records no variance; if Shiprocket's charge differs from the quote, nothing notices.
- **Q3** — Is a pickup scheduled automatically at booking, or requested separately by an admin? **Resolved for Delivery 2: not automatic.** Booking creates the order and AWB only; `SCHEDULE_PICKUP` (`shiprocket.config.ts`) is defined but unused. Revisit if manual pickup requests prove to be the actual bottleneck.
- **Q4** — What happens to an order whose booking keeps failing — does it stay open indefinitely, or reach a state that prompts a refund? **Still unresolved** — a failed shipment stays `failed` with `requiresManualIntervention: true` in `shippingMeta`, visible only to someone reading the database directly.
