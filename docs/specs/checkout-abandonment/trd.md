# TRD — checkout abandonment

- **Status:** ✅ Implemented — PR-104
- **Domain:** checkout, payments
- **Phase:** 2 — Transaction integrity
- **Verified:** 2026-09-16
- **References:** [spec.md](spec.md), [ADR-0025](../../adr/0025-order-codes-are-random-not-sequential.md), [ADR-0005](../../adr/0005-payment-state-server-only.md), [ADR-0007](../../adr/0007-conditional-stock-decrement.md), [inventory-reservation/trd.md](../inventory-reservation/trd.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
The release mechanism already exists and is correct: `expireAndRestock` in `server/checkout/order.repository.ts:231` moves stock back to the location it came from, releases the coupon claim in the same transaction, and is conditional on the order still being unpaid. Nothing about it needs rewriting.

What is missing is *when it runs*. Its only caller is the reconciliation sweep (`server/payments/payment.service.ts:203`), whose only caller is a Vercel cron scheduled once a day, and which additionally waits an hour. So the work is to give the release more triggers and to make the buyer's own abandonment one of them — then to stop the orders it leaves behind from being counted as business.

The shape is one routine reached by several triggers, which is the shape `confirmPayment` already has for the opposite transition (`payment-confirmation` D1). Triggers are cheap and can be wrong; the routine is the thing that decides, so correctness lives in one place no matter which trigger fired.

## Technical decisions

- **D1 — One release routine, three triggers.** A `releaseIfUnpaid` on `PaymentService` asks the gateway what actually happened via `fetchCapturedPayment` (`server/payments/providers/razorpay/razorpay.repository.ts:184`), then either confirms through the existing `confirmPayment` or releases through `expireAndRestock`. The browser's dismissal, the contention sweep (D4) and the cron all call this and nothing else. It lives in `payments` rather than `checkout` because it must talk to the gateway, and because `payments` already depends on `checkout` — the reverse import would be a cycle.

- **D2 — The browser triggers; the gateway decides (spec R3).** Releasing on the browser's word alone would be a correctness bug, not merely a trust one: `confirmPaid` deliberately refuses an order already marked expired (`server/checkout/order.repository.ts:193`), so a real payment arriving after a browser-asserted release becomes a manual refund. Asking the gateway first costs one call on a path that only runs when someone gave up.

- **D3 — Possession of the order id is sufficient authority to *ask*.** Checkout is open to guests, so there is not always a session to check; where the order does carry a `userId`, a signed-in caller must match it. This is safe because the trigger cannot decide: the worst an attacker holding a stolen order id achieves is releasing stock on an order the gateway confirms nobody paid for, which is what the cron would do anyway.

- **D4 — Release when someone is actually blocked.** When the order transaction's guarded decrement finds insufficient stock (ADR-0007), the release runs for past-window holds on exactly those products, and the checkout retries once. This is what makes spec R1 hold independently of any schedule, and it spends the gateway call only when a real buyer is being turned away.

- **D5 — The cron stays the backstop, at one run a day.** Vercel's Hobby plan permits one cron invocation per day and the project is on Hobby, so daily is the schedule. This is settled rather than deferred: with D1 and D4 in place nothing depends on the cron — the buyer's own dismissal releases immediately and a blocked checkout releases what is in its way — so the backstop only has to catch the buyer who closed the laptop lid, and a day is an acceptable wait for a case nobody is waiting on. The hold window was shortened instead, which costs nothing and is what the other two triggers actually read.

- **D6 — Visibility is one predicate applied in the repositories, default-exclude.** There are nineteen order queries across `server/checkout/` and `server/analytics/`. Filtering at each call site means the next query someone writes leaks, so the predicate is applied where `prisma.order` is reached. `findStuckPendingOrders` is the deliberate exemption — the sweep exists to find exactly these rows.

- **D7 — `Order.status` becomes a declared union.** It is a bare `String` whose schema comment lists three values, none of which are the ten the code actually writes. Visibility now depends on one of them, so the set is declared once in `server/checkout/order.types.ts` and read from there — the project's no-magic-strings rule, applied at the moment it starts to matter.

- **D8 — Order codes become random (ADR-0025).** `generateOrderCode` in `server/checkout/order.service.ts:677` reads the highest code and adds one, which is a read-then-write race against a `@unique` column — the failure mode is a checkout dying on a constraint violation under concurrency, and it gets likelier as abandoned attempts multiply. A second, differently-shaped generator sits unused in `server/checkout/order.repository.ts:81` and goes.

- **D9 — The existing backlog was corrected through the same routine, not a hand-written query.** Stock already held when this landed was released by running `releaseIfUnpaid` over the stuck orders, so the correction asked the gateway about each one and could not release a paid order by a mistake the live path would not make. It was a one-time run and nothing was kept: the conditions that produced the backlog are what this feature removes, and a remediation left lying around outlives its reason.

## Packages
None.

## UI approach
Nothing new is rendered. The checkout hook's existing `onDismiss` and `onFailure` handlers (`src/containers/checkoutContainer/hooks/useCheckoutPayment.ts:186`) gain a fire-and-forget call, and a page-hide handler covers the closed tab. All three are invisible to the buyer: the release is the store's business, and a buyer who dismissed a payment window is told nothing they did not already know. No layout changes, so [ADR-0015](../../adr/0015-mobile-first-design.md) is unaffected.

## Data model
**None.** `Order.status` is already a free `String` and `"expired"` is already written by `expireAndRestock`, so hiding abandoned orders needs no column and no migration. `Order.code` keeps its type and its `@unique`; only what is generated into it changes, and old values stay valid (spec R9).

## API / contract changes
One new endpoint, `POST /api/payments/abandon`, taking an order id and returning what was decided. It is a browser-callable mutation, so it belongs in `docs/CONTRACTS.md` and the PR carries `[CONTRACT]`. No existing DTO changes shape.

## Test plan
Unit, against [TESTING.md](../../TESTING.md)'s repository and service targets: `releaseIfUnpaid` releases when the gateway reports nothing captured and confirms when it reports a capture; the ownership rule in D3; the contention sweep's retry-once behaviour; the visibility predicate excluding expired orders from each admin, org and analytics query while `findStuckPendingOrders` still returns them; the code generator's uniqueness and its alphabet; the widened lookup regex accepting both code shapes. The race in D8 is worth an explicit concurrent-creation test, since it is the one failure that only appears under load.

## Delivery (PRs)
1. Status union (D7) and the visibility predicate (D6). Behaviour-changing: abandoned orders disappear from the panels.
2. The release routine and its triggers (D1–D5). Behaviour-changing: this is the fix.
3. Order codes (D8, ADR-0025), with the lookup widened first so no code is ever unfindable.
4. The one-time correction of the existing backlog (D9), run by hand against production.

## Open questions
None. The one question this carried — how often the backstop may run — is answered in D5: the project is on Vercel Hobby, so daily, and nothing depends on it.
