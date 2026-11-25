# Spec — own-store/order-fulfilment

- **Summary:** A paid parcel reaches the buyer through one hand-booked pickup, with the shop, the buyer and the admin reading the same timeline, and a parcel cancelled before it is ready gives everything back
- **Status:** Implemented — 2026-11-01 (units 1–6)
- **Domain:** cross-domain — shipping, checkout, payments, promotions, payouts, notifications
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-11-01
- **References:** [decisions.md](decisions.md), `431ed6e7:docs/specs/own-store/order-fulfilment/ux.md`, [own-store](../spec.md) (Q5, Q8, Q9, Q18, Q19), [offers-hardening](../offers-hardening/) (Q10, Q13, unit 1), [shipment-lifecycle](../../shipment-lifecycle/), shipping-fulfilment (`planning-archive-2026-11-25:docs/specs/shipping-fulfilment/`), [ADR-0005](../../../adr/0005-payment-state-server-only.md), [ADR-0007](../../../adr/0007-conditional-stock-decrement.md), [ADR-0020](../../../adr/0020-money-bearing-records-never-cascade.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. The technical approach was trd.md, removed once shipped (ADR-0073): `git show 431ed6e7:docs/specs/own-store/order-fulfilment/trd.md`.

## What this feature is
Vertical 2 of own-store. Each shop marks its own parcel ready, the admin books the courier by
hand (own-store Q18) and enters the pickup date, ETA and AWB, and from then on the shop, the buyer
and the admin see one timeline to the doorstep. Until a parcel is marked ready, the buyer or the
shop can cancel it (own-store Q19).

## Why
A low-tech seller needs one next step per parcel; a buyer who paid needs a date, not "N/A"; the
admin needs a queue; a cancellation must undo the whole sale, or the platform pays twice.

## Hazards this feature must close
Problems in today's code or in the design; the TRD answers each one.
- **Off-list parcel state.** New parcels are written as `pending`, which the transition table
  has no row for, so no tracking move on them ever applies.
- **Order-wide "packed".** In a two-shop order, one shop packing marks the other's goods packed (own-store Q8).
- **False pickup.** Entering an AWB marks the parcel "Picked up" before any courier came.
- **No ETA.** `estimatedDelivery` is never written; the confirmation email shows "N/A".
- **Unsigned webhook.** The courier webhook accepts any caller, and returns 200 on failure.
- **Unchecked delivery.** "Delivered" is written on the order without the transition check.
- **Buyer data exposed.** The shop's order page shows the buyer's full address and phone today
  (`src/app/(org)/org/[orgId]/orders/[orderId]/page.tsx`), against Q22.
- **Partial undo.** A cancellation that forgets restock, budget, coupon or the shop's earnings
  leaks money or stock (own-store Q5, offers-hardening Q10).
- **Cancel before payment.** An unpaid order has no sale to reverse (offers-hardening Q13).
- **Fee or reversal on a settled shop.** The fee and a parcel's reversal can land after its sale
  was paid out, or on a negative balance; settlement sums payable amounts with no floor
  (`server/payouts/settlement.service.ts`), so a payout could go negative (Q27).
- **Budget released twice, coupon too early.** The budget charge is recorded per order and offer,
  not per parcel; without a per-parcel release record a second cancel, or a later expiry,
  gives it back again (Q10).
- **Cancel races pickup.** On a booked parcel, the admin's cancel and the courier's "picked up"
  can arrive together; and the Shiprocket booking stays live after our cancel (Q28).
- **Over-refund.** Parcel refunds, each including shipping, must never sum past what the gateway
  captured for the order (Q11).
- **Ambiguous refund timeout.** A gateway timeout may have refunded; a retry must not refund twice (Q12).

## Requirements
- **R1** — Every parcel is in a named state from creation; every move, delivery included,
  passes the same check. Old parcels keep their meaning.
- **R2** — *Ready for pickup* and *pickup booked* join the journey. "Picked up" comes only from the
  courier or the admin's confirmation.
- **R3** — Each shop marks each of its own parcels ready; one shop never moves another's. The shop
  sees the buyer's name, city and pincode only — never phone or full address, except as printed
  on the label, which opens only for a signed-in member of that shop (Q22, Q26).
- **R3a** — A paid parcel still not ready is nudged to the shop at 12 h and 24 h, and flagged in the
  admin's queue at 36 h (Q24).
- **R4** — Marking ready emails the admin at once, and again if unbooked after 24 h (own-store Q9).
- **R5** — The admin books from one queue, oldest first: pickup date, ETA, courier, AWB, tracking
  link and label link (Q23). The admin can change the pickup date or mark it picked up.
- **R6** — Booking emails the buyer (date, ETA, tracking) and the shop (date, label).
- **R7** — Shop, buyer and admin each see the parcel's timeline from the same events, worded per
  reader, in India time.
- **R8** — Courier updates are accepted only with proof they came from the courier. An update for
  an unknown or cancelled parcel lands on the admin's conflict list, never dropped.
- **R9** — Courier moves update all three timelines; the emails are own-store Q9's list plus
  Q24's two nudges, each sent once.
- **R10** — Buyer and shop may cancel a paid parcel until it is ready (the shop picks a reason);
  the admin until it is picked up. Later, the action explains why and whom to contact.
- **R11** — Only a paid parcel can be cancelled; an unpaid order only expires.
- **R12** — Cancelling, exactly once however often pressed: restocks the parcel's origin, releases
  its share of offer budget once, reverses that parcel in the shop's earnings, and records the
  refund owed. The coupon use comes back only when every parcel of the order is cancelled.
- **R12a** — A shop cancellation charges a fee (₹50 today) once per parcel; the admin changes the
  amount without a deploy, and the charged amount is recorded. Buyer and admin cancellations
  charge nothing. The admin sees each shop's cancellation count (Q20, Q29).
- **R12b** — A fee or reversal on a shop whose balance cannot cover it carries forward as a
  negative balance against future payouts; no payout is ever below zero (Q27).
- **R13** — The refund owed is the parcel's charged amount, its shipping included, computed by the
  server and capped so an order's refunds never exceed what was captured. A parcel that is lost,
  damaged or returned to the shop also records a refund owed (Q25).
- **R14** — The admin sees every refund owed and starts it with one button; the buyer is emailed
  when it starts and sees it on the order.
- **R15** — No button is ever disabled; an action that cannot run says why, on tap.

## Product acceptance
Judged on a phone (~360px) first.
- **A1** — Two-shop order: shop A marks ready; shop B's parcel is still "To pack".
- **A2** — The admin is emailed within a minute of "ready", and again at 24 h.
- **A3** — Booking puts the pickup date and ETA on the buyer's and shop's timelines and emails; the
  confirmation email no longer says "N/A".
- **A4** — A courier update without the secret is refused; one with it moves the parcel.
- **A5** — "Delivered" arriving twice moves the parcel once and emails once.
- **A6** — Cancelling a ₹1,240 paid parcel returns stock and budget, writes one reversal to that
  shop only, and lists "₹1,240 owed". Pressing twice changes nothing. A shop cancel adds one ₹50
  fee; a buyer cancel none. In a two-parcel coupon order the coupon returns only after both.
- **A7** — Tapping "Cancel" on a ready parcel opens an explanation, not a dead button.
- **A8** — An unpaid order shows no cancel action anywhere; it expires as today.
- **A9** — "Refund ₹1,240" starts exactly one gateway refund, even after a timeout and a retry.
- **A10** — No shop screen, email or API response carries the buyer's phone or full address.
- **A11** — A parcel paid and not ready gets shop emails at 12 h and 24 h, and an admin flag at 36 h.
- **A12** — The admin changes the fee to ₹75; the next shop cancel charges ₹75, with no deploy.
- **A13** — An update for an unknown AWB, or for a cancelled parcel, shows on the conflict list.
- **A14** — A move at 23:30 UTC shows as the next day in India time on all three screens.

## Scope
- **Outcome:** a paid parcel goes from "to pack" to "delivered" or "cancelled and refunded", and
  all three people can see where it is.
- **In:**
  1. One parcel vocabulary; order status derived from parcels — R1, R2, A5.
  2. Shop marks ready; buyer details trimmed; nudges and the 36 h flag; admin emails — R3, R3a, R4, A1, A2, A10, A11.
  3. Booking with label link, date change, mark picked up; one timeline in India time — R5–R7, A3, A14.
  4. Signed courier updates, the conflict list, delivery emails — R8, R9, A4, A5, A13.
  5. Cancellation with every give-back, the fee and its setting, cancellation count — R10–R12b, A6–A8, A12.
  6. Refund owed (cancel, lost, damaged, returned), cap, refund button — R13, R14, A9.
- **Later:** automatic booking (Q14) · returns and RTO flows (Q15) · SMS/WhatsApp (Q16) · one-item
  cancel (Q17) · refund completed (Q18) · cancel request after ready (Q19).

## Open questions
None. Q20–Q24 decided 2026-10-30; Q25–Q29 are Claude · reversible.
