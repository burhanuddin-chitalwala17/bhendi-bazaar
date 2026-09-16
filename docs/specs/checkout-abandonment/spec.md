# Spec — checkout abandonment

- **Status:** ✅ Implemented — PR-104
- **Domain:** checkout, payments
- **Phase:** 2 — Transaction integrity
- **Verified:** 2026-09-16
- **References:** [trd.md](trd.md), [ADR-0025](../../adr/0025-order-codes-are-random-not-sequential.md), [inventory-reservation](../inventory-reservation/), [payment-confirmation](../payment-confirmation/)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is
A checkout that is started and not paid for leaves nothing behind that anyone can see: the goods go back on sale within minutes, and the half-finished order is kept for the store's own later use rather than shown as business that happened.

## Why
Most people who open a payment window do not pay in it. They compare, they hesitate, they lose signal, they close the tab. That is ordinary buyer behaviour, not a failure, and the store has to treat it as the common case rather than the exception.

Two things follow. The goods have to come back on sale quickly enough that the next buyer is never told a thing is unavailable when it is sitting there — on a catalogue of single items, one abandoned checkout is the difference between an item being for sale and not. And the abandonment must not be *presented as an order*: a seller looking at their panel should see what they have sold, not a list of people who thought about it, or their sales figures and their fulfilment queue both stop meaning what they say.

We do want to keep the record. Knowing who nearly bought something is worth more than the tidiness of deleting it, and it is the raw material for following those buyers up later. What we are choosing now is that the record is kept and not shown, which is different from the record not existing.

## Requirements
- **R1** — Goods held by an abandoned checkout return to sale within minutes, without anyone acting and without the buyer returning.
- **R2** — Nothing is released while the money is still in question. A buyer who pays outside the payment window — in a banking app, on a second device, after closing the tab — still gets their order.
- **R3** — Releasing is judged by the payment gateway, never by the browser. A browser may ask; it may not decide, and a browser that never asks changes nothing about the outcome.
- **R4** — An abandoned checkout is not visible to platform administrators or to selling organisations, in any listing, count, total, or operational queue.
- **R5** — It is not visible to the buyer either. Someone who closed a payment window and tried again sees one order, not two.
- **R6** — The record is kept in full — who, what, how much, when — so that abandoned checkouts can be acted on when we choose to.
- **R7** — Making a checkout visible again is a decision the store can take later without recovering anything, because nothing was destroyed.
- **R8** — An order's reference tells a customer nothing about how much the store sells, and cannot be used to reach another customer's order.
- **R9** — References already given to customers keep working. A code on an invoice or in an inbox stays valid and stays findable.
- **R10** — Two people checking out at the same moment both get an order. Neither is refused because their references collided.

## Product acceptance
- **A1** — Open the payment window on the last unit of an item, close it, and the item is buyable again within minutes — by someone else, and by the same person.
- **A2** — Pay in a banking app after closing the payment window, and the order confirms as normal.
- **A3** — Abandon several checkouts; the admin console and the org panel show no new orders, and their order counts and revenue totals are unchanged.
- **A4** — A buyer who abandoned two attempts and completed the third sees exactly one order in their account.
- **A5** — Two new orders placed in the same second both succeed.
- **A6** — An order code from before this change still finds its order in the lookup form.
- **A7** — Knowing one order code does not let a customer guess another, and a code placed weeks apart reveals no ordering between them.

## Out of scope (this feature)
- Contacting people who abandoned a checkout — reminder emails, recovery links, discounts. R6 exists so that becomes possible; the flow itself is its own feature.
- An operational view of abandoned checkouts. R7 keeps the option open; nothing is being built to look at them.
- Holding stock while a customer browses, before checkout — still out of scope, per [inventory-reservation](../inventory-reservation/).
- Refunding a payment captured against an order that was already released — [payment-confirmation](../payment-confirmation/) R7 owns it; Phase 5.
- Cancelling an order that has been paid for.
