# TRD — payment confirmation

- **Status:** ✅ Implemented — PR-39
- **Domain:** payments, checkout
- **Phase:** 2 — Transaction integrity
- **Verified:** 2026-08-09
- **References:** [spec.md](spec.md), [ADR-0005](../../adr/0005-payment-state-server-only.md), [ADR-0002](../../adr/0002-server-holds-pricing-authority.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
One server-side confirmation routine, reachable by two independent triggers: the gateway webhook, and the browser's post-payment return. Both perform the identical three checks — verify signature, load the persisted order, match the amount — and both call the same idempotent state transition. Neither is trusted more than the other, because neither is trusted at all: the checks are what confer trust, not the caller.

Two triggers rather than one because they fail differently. The browser return is fast but unreliable (the customer may leave); the webhook is reliable but may be delayed. Together they satisfy R3; separately neither does.

## Technical decisions
- **D1** — A single `confirmPayment(gatewayPaymentId, gatewayOrderId, signature)` service function is the only writer of `paymentStatus: "paid"`. Both routes delegate to it. This is the structural form of the single-writer rule.
- **D2** — Idempotency keys on the gateway payment id, stored on the order. A confirmation whose payment id already matches the stored one returns success without re-running side effects. Chosen over a "was it already paid?" check because it distinguishes a retry of *the same* payment from a *different* payment against the same order.
- **D3** — The confirmation email is dispatched by the transition, not by the route, so it inherits idempotency (R4). Currently email is triggered on order update; that coupling moves.
- **D4** — `paymentStatus` is removed from both the create and update request schemas ([Invariant 4](../../../CLAUDE.md)). Orders are created `pending`, server-side.
- **D5** — An unmatched webhook logs at error level and returns a non-2xx status so the gateway retries and its dashboard records the failure (R5). Returning 200 on an unrecognised payload is forbidden — a silently-swallowed webhook is what made this class of problem invisible before.
- **D6** — The `notes` round-trip between order creation and webhook handling is asserted by a test, since it is a string-keyed contract with an external service that the compiler cannot check. See [INTEGRATIONS.md](../../INTEGRATIONS.md).
- **D7** — R6 is a scheduled reconciliation sweep over orders `pending` past a threshold, querying the gateway for their true state. Deliberately *not* the primary path (latency, rate limits) but the only real backstop for a missed webhook.
- **D8** — Signature comparison uses `crypto.timingSafeEqual`. `server/payments/providers/razorpay/razorpay.repository.ts` currently compares with `===`.

## Packages
None. R6's sweep can start as a Vercel Cron invocation of an existing route; no job runner is introduced.

## Data model
`Order` gains a field for the confirmed gateway payment id if one is not already suitable for D2's idempotency check, plus an index if the reconciliation sweep in D7 queries by status and age. `[MIGRATION]`.

## API / contract changes
Yes — `[CONTRACT]`. `paymentStatus` leaves the create and update request shapes (D4). `POST /api/payments/verify` changes from returning `{ verified }` to performing the confirmation and returning the resulting order state. The checkout client stops issuing its own state update.

## Test plan
Per [TESTING.md](../../TESTING.md), payment state transitions are a 100% target — and these tests are the deliverable, not the fix.
- An unauthenticated attempt to set payment state is refused.
- The order's owner also cannot set payment state directly.
- `paymentStatus` in a create body is ignored.
- A valid signature with a mismatched amount does not confirm.
- An invalid signature does not confirm.
- The same payment confirmed twice yields one email and one state change.
- Webhook-first and browser-first arrival orders both converge on the same final state.
- An unmatched webhook returns non-2xx.
- The `notes` key written at creation is the key the webhook reads (D6).

## Delivery (PRs)
1. The `confirmPayment` service with the three checks and idempotency, plus its tests. Not yet wired to any route — verifiable entirely through tests.
2. Point the webhook at it; fix the `notes` key; make failures loud. Server-authoritative confirmation now works end to end.
3. Make `/api/payments/verify` a writer; remove the client-side state update. `[CONTRACT]`.
4. Remove `paymentStatus` from the schemas.
5. The reconciliation sweep (R6).

PR 2 is the one that changes behaviour in production; 1 is inert, and 3–5 depend on 2 being correct.

## Questions closed (2026-08-09)
- **Q1** — 30 minutes, as suggested; the sweep runs every 15 (`vercel.json`), so a missed webhook confirms within ~45 minutes worst case.
- **Q2** — The existing admin orders list already filters by payment status, which is the stuck-and-failed view at current volume; the sweep also logs every recovery. An alert earns its keep when volume does.
- **Q3** — Closed by [inventory-reservation](../inventory-reservation/) Q1: a failed payment keeps its reservation until the 60-minute hold expires, so the same order is retriable within the hold; after expiry a new order is needed.
