# Spec — unmatched payments

- **Summary:** Money that arrives for an order the store already released is recorded and refunded, never lost
- **Status:** ✅ Implemented — PR #95
- **Domain:** payments, checkout
- **Phase:** 2 — Transaction integrity
- **Verified:** 2026-11-22
- **References:** trd.md, decisions.md, [payment-confirmation](../spec.md), [checkout-abandonment](../../checkout-abandonment/), [order-fulfilment](../../own-store/order-fulfilment/) refunds

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
When a buyer's payment is captured after the store has released their order, the store records the money as owed back and the admin refunds it with one press.

## Why
An unpaid order is released after its hold, and its stock goes back on sale. A payment can still be captured on it afterwards: the buyer approved late in a banking app, or retried after a failed attempt. The store rightly refuses to call that order paid, because it may no longer be able to fulfil it. But the refusal is all that happens. The money sits with the gateway, the buyer is owed it, and the platform has no record that it ever arrived.

Every rupee that reaches the store has to be either a paid order or a refund owed. Anything else is money nobody is looking after.

## Requirements
- **R1** — A payment captured for an order the store had already released is recorded as owed back the moment it is refused: which order, which payment, how much.
- **R2** — It is shown on the admin's refunds list as owed, with why, until it is refunded.
- **R3** — The admin refunds it with one press, for exactly the amount captured.
- **R4** — Pressing twice, or retrying after an unanswered request, never refunds twice.
- **R5** — The same capture reported more than once is recorded once.
- **R6** — Nothing refunds on its own.
- **R7** — The released order stays released: the payment does not make it paid, and does not count as revenue or as money the buyer spent.

## Product acceptance
- **A1** — An order expires; its payment is then captured. Within a minute the admin's refunds list shows it owed, with the order and amount, reason "paid after release".
- **A2** — The admin presses Refund; Razorpay shows a refund of the captured amount against that payment; the row reads Started.
- **A3** — The gateway reports the same capture three times: one row.
- **A4** — Two presses at once, or a press retried after a timeout: one refund at Razorpay.
- **A5** — The order is still expired, not in the buyer's orders, and the admin's revenue and the buyer's spend are unchanged.
- **A6** — A capture for an order that is not released still confirms it as paid, exactly as today.

The refunds list is an admin screen and is judged on a phone first, as the rest of it is ([ADR-0015](../../../adr/0015-mobile-first-design.md)).

## Scope
- **Outcome:** Money captured for a released order is recorded and refunded by the admin.
- **In:** recording on refusal (R1, R5, R7; A1, A3, A5, A6); the row on the refunds list (R2; A1); refunding it once (R3, R4, R6; A2, A4).
- **Later:** a buyer email (Q8); the buyer's checkout wording (Q9); a gateway sweep for a missed webhook (Q10); a capture of a different amount (Q11).

## Open questions
None.
