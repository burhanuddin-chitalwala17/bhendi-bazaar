# Spec — shipping fulfilment

- **Status:** In progress — a scoped first slice (R1, R2, R3 partial, R4) landed 2026-08-25; R5–R7 and A5 remain unbuilt. See Scoped delivery below.
- **Domain:** shipping
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-25
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

**Decided 2026-08-10 (product owner): keep the current flow.** Live rates stay quoted
and charged; booking stays the placeholder; parcels are fulfilled manually outside the
system. Real booking remains this spec's future scope, unblocked whenever it is picked
up — every parcel now carries a pickup location with a courier-collectable address
(stock-locations), so nothing further blocks it but the decision to build. Accepted
with the decision: the tracking reference shown to customers remains a placeholder
until then.

- **Book for real** — the store keeps its current customer-facing behaviour and makes it true. Larger scope: booking, cancellation, label handling, and courier failure modes.
- **Stop quoting live** — quote a flat or table-based shipping fee and fulfil manually outside the system. Much smaller, and honest. Real booking becomes a later feature.

Everything below assumes *book for real*. If the answer is *stop quoting live*, this spec is replaced by a much smaller one and the requirements here move to a future phase.

## Scoped delivery (2026-08-25)

**"Book for real" is picked back up, deliberately scoped to less than the full requirement list below**, because a customer receiving no working tracking reference at all was the most visible gap. What landed: booking a shipment through the real Shiprocket provider (R1), a courier-issued tracking reference the customer can actually follow (R2), a booking failure recorded on the shipment rather than silently appearing fulfilled (R3, though without the admin-visible retry UI A3 calls for), and the weight sent matching the weight the rate was quoted on (R4, since it's read from the same persisted `shipment.packageWeight` the quote used).

**Not delivered, and known gaps as of this slice:**
- **R5/A5 (status sync)** — no webhook handler updates a shipment after booking. Its status is whatever `fulfillOrder` set at booking time.
- **R6 (cancellation)** — not implemented.
- **R7 (admin visibility)** — a failed booking's error lives in `shippingMeta.fulfillmentError`; nothing in the admin UI surfaces it yet.
- **Pickup scheduling (TRD Q3)** — resolved *not automatic* for this slice: booking creates the order and AWB only. A pickup must still be requested through Shiprocket directly, or in a follow-up PR against `SCHEDULE_PICKUP`.
- **Q2 (courier-charge variance)** — unresolved; no variance is recorded if Shiprocket's actual charge differs from the quote.
- **Q4 (stuck failures)** — unresolved; a shipment that keeps failing to book stays `failed` indefinitely with no prompt to refund or retry.

Real, external dependency this slice does not remove: each org's pickup location (`OrgAddress.name`, or `providerRef` if set) must already exist as a registered pickup nickname in the connected Shiprocket account, and its `contactName`/`contactPhone` must be filled in — booking fails fast with a clear error otherwise, rather than sending Shiprocket incomplete data.

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
