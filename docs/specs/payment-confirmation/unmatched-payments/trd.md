# TRD — unmatched payments

- **Status:** ✅ Implemented — PR #95
- **Domain:** payments (records and refunds), checkout (the list, the start), with one call from payments' confirmation
- **Phase:** 2 — Transaction integrity
- **Verified:** 2026-11-22
- **References:** spec.md, ux.md, decisions.md; [ADR-0005](../../../adr/0005-payment-state-server-only.md), [ADR-0003](../../../adr/0003-one-repository-per-aggregate.md), [ADR-0020](../../../adr/0020-money-bearing-records-never-cascade.md); order-fulfilment D16, D17

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
The refusal already exists: `orderRepository.confirmPaid` will not mark an expired order paid, and `paymentService.confirmPayment` then throws. This feature makes that refusal leave a record. When the refused signal is a verified capture (the webhook, which carries the amount), payments writes a `Refund` row owed for that payment, and the webhook answers 2xx with what it recorded. From there the row is an ordinary refund: the admin's list shows it, `refundService.start` claims it, asks Razorpay once under the row's id as receipt, and adopts an earlier answer on a retry.

## Prior art
- **Unapplied cash.** Accounting holds money received that matches no invoice in a suspense account until it is applied or returned; it is never left unrecorded. The owed row is that account, and refunding is the only way out of it (Q1).
- **Razorpay refunds.** A refund names a payment and takes a `receipt`, which the gateway treats as idempotent per payment ([INTEGRATIONS.md](../../../INTEGRATIONS.md)). We already rely on it for parcel refunds (order-fulfilment D17) and follow it unchanged.
- **This repository.** Shipping records a courier update it cannot apply as a `CourierConflict` row and answers 2xx (shipping Q32). Payments' rule is that an *unmatched* webhook fails loudly with non-2xx (payment-confirmation D5). This payload is matched — to an order, by its notes and its gateway order — and the row is the loud part, so it follows shipping's shape (Q4). The webhook still answers non-2xx for anything it cannot match or record.

## Technical decisions
- **D1 — Record only a captured signal** (Q3). `confirmPayment` records when it was given an `amount` (the webhook's `payment.captured`). The browser return has no amount, cannot tell authorised from captured, and keeps throwing the conflict it throws today.
- **D2 — Decide after the conditional write, not before.** `confirmPaid` is attempted first; only when it loses and the re-read shows the order `EXPIRED` and unpaid is the payment recorded. Checking first would race the sweep that expires it.
- **D3 — The row is a `Refund` with no parcel** (Q2). `shipmentId` becomes nullable; a new `gatewayPaymentId` names the payment refunded and is unique, which makes recording idempotent (R5): an insert that conflicts on it does nothing. `cause` gains `paid_after_release` (Q6); the column is already a string.
- **D4 — Owed is what was captured** (Q5): the webhook's `amount` in paise, never the order's total and never a request body (Invariant 1).
- **D5 — `refundService.start` refunds the row's own payment when it has one**, else the order's confirmed payment, as today. Claim, receipt lookup and settle are unchanged, so R4 holds by the code that already proves it for parcels.
- **D6 — Parcel-only paths skip a parcel-less row.** `owedSoFar` (the cancel's cap on what a paid order has been refunded) and the buyer's refund view read parcel rows only; `onRefundStarted`'s parcel email is not sent for one (Q8).
- **D7 — The release stands** (R7). Nothing here writes `Order.status` or `paymentStatus`; revenue and spend already exclude an expired order (`REVENUE_ORDER_WHERE`).

## Packages
None.

## UI approach
See `ux.md`; no new screen. `listRefunds` (`server/checkout/refund-queue.ts`) reads the order code for a parcel-less row from the order, gives `parcelCode: null` and `paymentId` from the row. `RefundRow.parcelCode` becomes `string | null`; `refund-list.tsx` shows "—" for null, on the phone's meta line and the `md:` cell alike. `causeLabel` gains the new cause. The start keeps `useStartRefund` and `refundsApiClient` unchanged; its success toast drops "Buyer emailed" when the row has no parcel.

## Gates touched
- `one-repository`: the insert lives in `refund.repository.ts`, the table's one writer.
- `hardcoded-copy`: new words go in `refunds-copy.ts`.
- `module-boundaries`: payments already imports checkout's public order types; no new edge.
None added to an allowlist.

## Data model
[MIGRATION] `Refund.shipmentId` → nullable (its unique index stays: Postgres allows many NULLs); `Refund.gatewayPaymentId String? @unique`. No backfill: every existing row has a parcel and no payment id.

## API / contract changes
None. `POST /api/admin/refunds/[id]/start` and `RefundStartOutcome` are unchanged. The webhook's 2xx body gains `recordedUnmatched: true`, which only Razorpay reads.

## Test plan
- Unit, `payment.service`: a webhook capture for an expired order records once and resolves (A1); the browser return for one still throws (D1); a capture for a live order confirms as before (A6); a record for an order not expired is impossible (D2, mutation-checked).
- Integration, real database: the same capture recorded three times is one row (A3); the order stays expired and revenue and spend do not move (A5); two concurrent starts of a parcel-less row make one gateway call, with the gateway mocked (A4); `owedSoFar` ignores the row (D6).
- Unit, refund list: a parcel-less row renders "—" and "paid after release".

## Delivery (PRs)
1. **U1 — record.** Migration, `recordUnmatched`, the confirmation branch, the webhook's 2xx. Behaviour changes: a late capture is now recorded instead of retried into nothing.
2. **U2 — refund.** `start` with the row's payment, the list row, copy. Behaviour changes: the admin can refund it.

## Open questions
None.
