# Spec — shipment-lifecycle

- **Summary:** One status vocabulary every courier maps into, and what each state means for stock, refunds and settlement
- **Status:** Implemented — PR-135 (vocabulary, adapter, transition guard, migration), PR-137 (restock and ledger reversal). Refund execution stays manual by decision; the customer-return direction is unbuilt until that flow is specified
- **Domain:** shipping (consequences in checkout, catalog, payments)
- **Phase:** 3 — Fulfilment & marketplace
- **Verified:** 2026-09-24
- **References:** `431ed6e7:docs/specs/shipment-lifecycle/trd.md`, [ADR-0007](../../adr/0007-conditional-stock-decrement.md), [ADR-0020](../../adr/0020-money-bearing-records-never-cascade.md), shipping-fulfilment (`planning-archive-2026-11-25:docs/specs/shipping-fulfilment/`), CHANGELOG PR-132

> Requirements and product approach only. The technical approach was trd.md, removed once shipped (ADR-0073): `git show 431ed6e7:docs/specs/shipment-lifecycle/trd.md`.

## What this feature is

One vocabulary for where a parcel is, that every courier's own vocabulary maps into — and a
definition of what each state means for the buyer's money and the org's stock.

## Why

`Shipment.status` currently has **three vocabularies and no owner**. The `ShipmentStatus` type
declares nine values; the schema comment names four different ones; and the code writes a third
mix — `api/admin/shipments/[id]/tracking` writes `"shipped"`, which the type does not contain.
Live data already holds `pending`, `shipped` and `delivered`.

The cost is already visible: the Shiprocket webhook writes whatever `normalizeShipmentStatus`
returns, so a courier reporting *in transit* stores `in_transit`, which no admin badge matches —
the row renders unstyled. Nothing is wrong with the adapter; the set it maps *into* was never
designed.

It gets more expensive with the second courier. Delhivery and Maruti are planned, and a
vocabulary that already disagrees with itself across one integration cannot absorb three.

## The problem this has to solve

**A parcel has two journeys, not one.** It goes out; and when that fails, it comes back. Most
status lists model only the first and then bolt the second on as extra forward states, which is
why they end up with `rto`, `rto_ofd`, `rto_ndr`, `rto_delivered` as peers of `delivered`.

**Cancelling and returning are not the same thing, and neither is one state.**

- Before the courier collects it, a parcel can be *cancelled* — nothing has moved.
- After collection, it cannot be cancelled. The only way back is a **return to origin (RTO)**,
  which is itself a journey with its own stages and can also fail.
- After it is delivered, neither applies. A buyer sending goods back is a **customer return**,
  a new movement in the other direction, not a late state of the original parcel.

Conflating these is the trap: it makes "cancelled" mean four different things and leaves nobody
able to answer *where is my stock* or *who owes whom*.

**A failed delivery attempt is normal, not terminal.** In India a courier typically attempts
three times and raises a non-delivery report (NDR) between attempts. A model with no state for
"attempted and failed, will retry" either loses that or misreports it as a return.

## Hazards this must name, so the TRD cannot skip them

- **Stock.** Every route back — cancelled, RTO delivered, customer return received — must return
  units to the location they were reserved from ([ADR-0007](../../adr/0007-conditional-stock-decrement.md)).
  *Lost* must **not**: those units are gone, and crediting them invents inventory. Restocking must
  be idempotent, because a courier may report the same terminal state more than once.
- **Money.** Refund is owed on cancellation, on RTO completion and on an accepted customer return,
  and *not* on a delivery that merely failed once. Nothing here may write `paymentStatus`
  directly ([ADR-0005](../../adr/0005-payment-state-server-only.md)).
- **Settlement.** An org is credited for a sale that was delivered. A parcel that comes back must
  reverse that credit, and the ledger never cascades ([ADR-0020](../../adr/0020-money-bearing-records-never-cascade.md)).
- **A partial order.** An order can be several parcels. One coming back does not cancel the order,
  so order status must be derivable from its parcels rather than set alongside them.
- **Out-of-order and duplicate webhooks.** Couriers retry and occasionally deliver events late. A
  parcel already `delivered` must not go back to `in_transit` because a stale event arrived.
- **An unmapped courier status.** A new code from any of the three must be visible, not silently
  dropped or coerced to the nearest guess.

## Requirements

- **R1** One canonical set, declared once, that every courier status maps into.
- **R2** The forward journey is `packing → picked_up → in_transit → out_for_delivery → delivered`.
- **R3** A failed delivery attempt is its own non-terminal state; the parcel returns to
  `out_for_delivery` on the next attempt.
- **R4** `cancelled` is reachable only before `picked_up`. After that the only way back is RTO.
- **R5** The return leg has its own states through to "back with the shop", and can itself fail.
- **R6** A customer return after delivery is a separate movement against the order, not a status
  on the original parcel.
- **R7** Each state declares what it means for stock, for the buyer's money, and for settlement.
- **R8** A courier status nobody has mapped is recorded and surfaced, never guessed.
- **R9** A parcel never moves backwards through the forward journey.
- **R10** Order status is derived from its parcels, never written in parallel with them.
- **R11** Existing rows (`pending`, `shipped`, `delivered`) migrate to the new set with no
  shipment losing its meaning.

## Out of scope

Refund execution with the gateway, the buyer-facing returns request flow, NDR
action-taking (reschedule, change address), and courier selection. This defines the vocabulary
and its consequences; those are features built on it.
