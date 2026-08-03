# Spec — shipping fulfilment

- **Status:** Draft — **blocked on a product decision (see Open decision)**
- **Domain:** shipping
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-03
- **References:** [trd.md](trd.md), [product-weight-and-rates](../product-weight-and-rates/), [INTEGRATIONS.md](../../INTEGRATIONS.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is
A paid order results in a real parcel, booked with a real courier, that the customer can actually track.

## Why
The store quotes live courier rates and charges the customer for shipping, but the booking step is served by a placeholder implementation: it returns a generated tracking number and a placeholder tracking URL, and the order is marked confirmed. Nothing is booked and no courier is told.

So the customer pays a real shipping fee, receives a tracking reference that leads nowhere, and waits for a parcel that has not been requested. This is the one item in the backlog that is visible to customers as a broken promise rather than a latent risk.

## Open decision

**This spec cannot be finalised until one question is answered, because it determines whether the feature exists at all:**

> Should the store book real shipments, or stop quoting live rates until it can?

- **Book for real** — the store keeps its current customer-facing behaviour and makes it true. Larger scope: booking, cancellation, label handling, and courier failure modes.
- **Stop quoting live** — quote a flat or table-based shipping fee and fulfil manually outside the system. Much smaller, and honest. Real booking becomes a later feature.

Everything below assumes *book for real*. If the answer is *stop quoting live*, this spec is replaced by a much smaller one and the requirements here move to a future phase.

## Requirements
- **R1** — A confirmed, paid order produces a shipment booked with the courier.
- **R2** — The tracking reference shown to a customer is the courier's own and resolves on the courier's tracking page.
- **R3** — A booking that fails does not leave the order appearing fulfilled. The failure is visible to an admin and retryable.
- **R4** — The weight and dimensions sent to the courier are the ones the customer's shipping charge was based on.
- **R5** — Shipment status reflects the courier's status, updating as the parcel moves.
- **R6** — A cancelled order's booking is cancelled with the courier.
- **R7** — An admin can see, for any order, whether a real booking exists and what the courier said.

## Product acceptance
- **A1** — Paying for an order results in a shipment that appears in the courier's own dashboard.
- **A2** — The tracking link in the confirmation email opens a working courier tracking page.
- **A3** — A courier rejection produces an order an admin can see and retry, not a silently confirmed one.
- **A4** — The weight on the courier's booking matches the weight the shipping charge was computed from.
- **A5** — Marking an order delivered at the courier updates it in the store without manual entry.
- **A6** — No customer receives a tracking reference that does not resolve.

## Out of scope (this feature)
- Getting weights right — [product-weight-and-rates](../product-weight-and-rates/), a hard prerequisite. Booking real parcels at fictional weights produces courier invoices that do not match what customers paid.
- Choosing between couriers on price or speed. The existing provider abstraction supports it; automatic selection is separate.
- Returns and reverse pickup.
- Multi-parcel splitting of a single order.
- Additional courier integrations.
