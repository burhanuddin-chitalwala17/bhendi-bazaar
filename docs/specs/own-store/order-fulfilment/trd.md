# TRD — own-store/order-fulfilment

- **Status:** Accepted — 2026-10-30 (UX signed off; owner asked to build). Building: U1 done 2026-10-30
- **Domain:** cross-domain — checkout (orchestrates), shipping, payments, promotions, payouts, notifications
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-10-31
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), [shipment-lifecycle](../../shipment-lifecycle/trd.md), [offers-hardening](../offers-hardening/trd.md), [rate-limiting](../../rate-limiting/trd.md), [ADR-0003](../../../adr/0003-one-repository-per-aggregate.md), [ADR-0005](../../../adr/0005-payment-state-server-only.md), [ADR-0007](../../../adr/0007-conditional-stock-decrement.md), [ADR-0020](../../../adr/0020-money-bearing-records-never-cascade.md), [ADR-0021](../../../adr/0021-audit-trail-never-fails-the-action.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0046](../../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0055](../../../adr/0055-an-admin-surface-reads-through-projections-and-writes-through-the-aggregates-one-repository.md), [ADR-0060](../../../adr/0060-mutations-stay-on-route-handlers-and-a-mutating-request-must-come-from-our-origin.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach
Each parcel move is a command in a new fulfilment service in server/checkout. It runs one transaction:
lock the order, move the parcel with shipping's `applyStatus` (the only writer, which restocks and
reverses), then call a new parcel-moved module in server/checkout (the summary, budget, coupon, refund owed, fee and
notices). Only the winner of the move runs the effects, and each effect has a unique key as backstop.
Emails are rows sent by the worker; nudges come from one hourly sweep.

## Prior art
- Flipkart, Meesho and Amazon Easy Ship: the seller marks ready, the platform owns the courier, the
  buyer's phone stays hidden, and a seller who cancels pays for it. We follow all of it except booking,
  which is by hand (own-store Q18).
- Shopify refunds per line plus shipping, capped at what remains. Gateways take a client key so a retry
  is safe. Amazon and Stripe Connect carry seller debt forward and never pay out below zero. We follow
  both.
- The norm for webhooks is an HMAC. Shiprocket offers only a static token (D9). A replayed update is
  harmless here, since every move and notice is idempotent. An append-only checkpoint log and an outbox
  with a unique key are standard; we adopt both. `ShippingEvent` logs API calls, not moves.

## Technical decisions
- **D1 — Vocabulary (R1, R2; Q2, Q4, Q9).** Adds `READY_FOR_PICKUP` and `PICKUP_BOOKED`: packing → ready →
  booked → picked_up/in_transit, with cancel from the first three. `packing → picked_up` goes. Beside it,
  `CANCELLABLE_FROM` per actor: buyer and shop from `packing`, admin from all three.
- **D2 — Conditional move under the order lock (Q28).** `recordTransition` becomes `updateMany {id, status:
  from}`, taking the caller's `tx`; count 0 re-reads only to raise `ConflictError` with the current state.
  Locks run Order (`FOR UPDATE`), Shipment, Promotion, stock, ledger, which keeps `expireAndRestock`'s order.
- **D3 — Born `packing`; placeholder gone (Q3).** Deleted: `fulfillOrder`, `mock.booking.ts`, `markBooked`,
  `markBookingFailed`, `recordBooking*`. Migration: `pending`/`confirmed`/`failed` become `picked_up` with
  an AWB and a courier event, else `packing`.
- **D4 — Order status derived (Q5, Q30).** Pure `summariseParcels`; `ORDER_STATUS.CANCELLED` added;
  `orderRepository.syncSummary` (conditional) runs in every move and replaces `markDelivered`. Deleted
  (Q36: with U2 and U3, whose contracts replace them): `ORDER_TRANSITIONS`, `transitionForOrg`, the org
  transition route and the admin status `PATCH`. The migration recomputes paid orders; paid counts and
  revenue exclude `CANCELLED`.
- **D5 — Timeline (R7; A14).** `ParcelEvent` (shipping), one row per move, booking, date or ETA change, with
  actor, reason and courier wording; seeded. Shown via a new India-time helper in server/shared; dates are `@db.Date`.
- **D6 — Ready (R3; A1).** `POST /api/org/[orgId]/shipments/[id]/ready` (`withOrg`) moves only a paid
  parcel of the scoped org; any other parcel is not-found.
- **D7 — Buyer details (R3; A10; Q22, Q26).** Org reads return `ShopParcelView`, where the buyer is `{name,
  city, pincode}`; `Order.address` is never selected. `GET …/shipments/[id]/label` (`withOrg`, `pickup_booked`
  only) streams the stored link (https, host allowlist, 10 s), so the raw link never reaches the shop.
- **D8 — Notices (R4, R9; A2, A5; Q8).** `Notice` (notifications), unique on (parcel or order, kind,
  recipient), inserted in the move's transaction; only a new row enqueues `notify.send`. The handler skips
  rows already sent and passes the notice id as Resend's idempotency key.
- **D9 — Webhook auth (R8; A4; Q7).** Shiprocket sends its webhook token as `x-api-key`. **Unconfirmed**
  (community sources, not its docs); U4 confirms it in the dashboard and records it in INTEGRATIONS.md.
  `timingSafeEqual` over SHA-256 digests against `SHIPPING_WEBHOOK_TOKEN`, before parsing; unset or wrong
  answers 401. If URLs naming "shiprocket" are refused (unconfirmed), the route becomes
  `/api/webhooks/shipping/tracking`.
- **D10 — Conflicts (R8; A13; Q32).** An unknown AWB, or an update for a cancelled parcel, writes a
  `CourierConflict` row and answers 200; an exception answers 500. A differing courier ETD replaces the
  ETA and emails the buyer (Q6); the field name comes from a captured payload.
- **D11 — Booking (R5, R6; A3).** `POST /api/admin/shipments/[id]/booking` moves the parcel to
  `pickup_booked`. `PATCH` changes the dates, compare-and-set on the date the admin saw. `POST …/picked-up`
  confirms pickup. The AWB has a partial unique index. Deleted: the tracking route and its form.
- **D12 — Cancel (R10–R12, R15; A6–A8; Q31).** One command behind three routes; the shop must give a reason.
  Restock and reversal stay in shipping; `parcel-moved` does the rest. Unpaid orders are refused in the
  service. A refusal is a `DomainError` with ux.md's copy. Guests cancel via Contact us.
- **D13 — Budget, coupon (Q10, Q33).** `PromotionBudgetRelease`, unique (shipmentId, promotionId). Each
  parcel takes its platform-funded share of `budgetChargedPaise` by cumulative floors. Expiry writes an
  order-level row. Coupon uses come back only when `syncSummary` moves the order to `cancelled`.
- **D14 — Fee (R12a; A12; Q20, Q29).** A `CANCELLATION_FEE` ledger entry, payable = −fee, copied at the
  time; one per parcel (partial unique). The amount sits in `FulfilmentSettings` (payouts), seeded at ₹50
  by a migration. `PUT /api/admin/settings/fulfilment` takes ₹0–1,000, compare-and-set, audited. Counts
  come from `ParcelEvent`.
- **D15 — Carry-forward (R12b; Q27, Q34).** `createSettlement` refuses a total ≤ 0, or one that omits the
  org's unsettled negative entries.
- **D16 — Refund owed (R13; Q11, Q25).** `Refund` (payments, never cascaded), one per parcel: OWED,
  REQUESTED, STARTED, UNCONFIRMED, FAILED. Written on any `refundOwed` move. The amount is the lines less
  their discount share, plus `shippingCost`, capped at `grandTotal` less existing rows. `paymentStatus` is
  never touched.
- **D17 — Refund button (R14; A9; Q12).** `POST /api/admin/refunds/[id]/start` moves OWED to REQUESTED
  conditionally, then calls Razorpay with `receipt` = row id. Its refund docs (read 2026-10-30) say
  "`receipt` is treated as an idempotency key" per payment; no `X-Refund-Idempotency` header is documented.
  Success → STARTED with the gateway id, and the buyer is emailed; a refusal → FAILED with the reason.
  A 10 s timeout, or REQUESTED older than 2 min, shows UNCONFIRMED; a retry first lists the payment's
  refunds and adopts the one with that receipt.
- **D18 — Nudges (R3a, R4; A11; Q24).** An hourly `fulfilment.sweep` (the 4th of 4 schedules,
  already in the idle budget) writes the 12 h and 24 h shop notices and the 24 h-unbooked admin
  notice. They are timed from a new `Order.paidAt` (stamped by `confirmPaid`) and the ready event,
  so each can be up to an hour late. The 36 h flag and "overdue" are read-time queries. The
  migration pre-fills notices for old parcels, so the deploy emails no one.

## Hazards
| Hazard | Answer |
|---|---|
| Off-list parcel state | Answered by D1, D3 |
| Order-wide "packed" | Answered by D4, D6 |
| False pickup | Answered by D1, D11 |
| No ETA | Answered by D10, D11 |
| Unsigned webhook | Answered by D9, D10 |
| Unchecked delivery | Answered by D2, D4 |
| Buyer data exposed | Answered by D7 |
| Partial undo | Answered by D12, D13, D14, D16 |
| Cancel before payment | Answered by D12 |
| Fee or reversal on a settled shop | Answered by D14, D15 |
| Budget released twice, coupon too early | Answered by D13 |
| Cancel races pickup | Answered by D2, D10 |
| Over-refund | Answered by D16 |
| Ambiguous refund timeout | Answered by D17 |

## Packages
None.

## UI approach
Screens, states and copy come from [ux.md](ux.md). Pages are server components. Each action is a leaf
hook (`useMutation`, or `useServerForm` for booking, dates and fee) calling `parcelApiClient.ts`,
`orderApiClient.ts` or `refundsApiClient.ts`. The DTOs are `ShopParcelView`, `ParcelTimelineDto`,
`PickupQueueRow` and `RefundRow`.
- **Phone:** cards; actions docked above the tab bar. Sheets use `FormDialog`; booking uses an adaptive
  side sheet (ADR-0040 §3); the date uses `ResponsivePicker`. **`md:`** two-column shop list and centred
  dialogs. **`lg:`** admin tables, a booking side panel, and the buyer's timeline beside the items.
- `ParcelTimeline` is one component, with wording keyed by `ShipmentStatus` for each reader.

## Gates touched
`route-reachability`/`portal-boundary` (eleven routes added, three deleted); `rate-limit-registry` (buyer
cancel under `ORDER`); `one-repository` (one repository per new table); `file-cohesion` `RECORDED` gains
`parcel-moved.ts`; `MAY_USE_SHEET` gains the booking panel; `jobs-config` (4 of 4 schedules used).

## Data model
| Unit | [MIGRATION] |
|---|---|
| U1 | `ParcelEvent` (seeded); parcel status data migration (D3); order summary recompute (D4) |
| U2 | `Order.paidAt` (backfilled); `Notice` (pre-filled, D18) |
| U3 | `Shipment.pickupDate`, `labelUrl`; `estimatedDelivery` to `@db.Date` (always null today); AWB partial unique, after a pre-check |
| U4 | `CourierConflict` |
| U5 | `PromotionBudgetRelease`, `Refund`, `FulfilmentSettings` + ₹50 seed, `CANCELLATION_FEE` + index |

## API / contract changes
[CONTRACT] U2: `ShopParcelView`; the org transition route goes. U3: `bookingSchema`, `ParcelTimelineDto`;
the tracking route and admin status `PATCH` go. U4: the webhook token. U5–U6: cancel input, fee, refund DTOs.

## Test plan
Per [TESTING.md](../../../TESTING.md); every new guard is mutation-tested. **Integration:** A1, the
cancel/pickup race, double cancel (A6), the coupon after both parcels, A5, A8, A11, A12, A13, the
settlement floor. **Unit:** the refund cap and budget shares over random splits, `summariseParcels`,
A4, A14, a scan for phone and address keys (A10), timeout-then-retry (A9). **Component:** A7.

## Delivery (PRs)
| Unit | Closes | Migrates | Contract |
|---|---|---|---|
| U1 Parcel states | R1, R2, A5 (move); D1–D5 | yes | no |
| U2 Ready, trimmed details, nudges, 36 h flag | R3, R3a, R4, A1, A2, A10, A11; D6–D8, D18 | yes | yes |
| U3 Booking, label, date change, India-time timeline | R5–R7, A3, A14; D11 | yes | yes |
| U4 Signed courier updates, conflicts, delivery emails | R8, R9, A4, A5, A13; D9, D10 | yes | yes |
| U5 Cancel, fee and setting, count, refund owed on cancel | R10–R12b, R13, R15, A6–A8, A12; D12–D16 | yes | yes |
| U6 Refund owed for lost/damaged/RTO, refund button | R13 (Q25), R14, A9; D16, D17 | no | yes |

Every unit changes behaviour. The `Refund` table ships in U5, because A6 shows "₹1,240 owed" (Q35).

## Open questions
None. Q30–Q35 are Claude · reversible. To verify at build: D9 (header and URL rule), D10 (ETD field),
D8 (Resend idempotency key), D7 (label hosts).
