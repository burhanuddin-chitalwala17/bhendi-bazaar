# ARCHITECTURE.md — shipping domain, current state

- **Verified:** 2026-11-01
- **Covers:** `server/shipping/**`. Product-wide architecture is [`/docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

Describes what exists now. Update after a structural change, never before.

## Shape

```
        rate request                          ┌── providers/shiprocket/ ──▶ Shiprocket API
              │                               │
       services/orchestrator.service.ts ──────┤   (one impl of domain/provider.interface.ts)
              │        │                      │
   strategy selection  └── ShippingRateCache   └── (future carriers register here)
              │
        selected rate ──▶ checkout, as a signed quote (an input to pricing, never a write)
```

Status updates arrive independently, by webhook, and are normalised before they touch the database. A webhook is trusted only with the carrier's token (`webhook-auth.ts`); without it the route answers 401 before reading the body.

## Pieces

| Piece | Role |
|---|---|
| `domain/provider.interface.ts` | The carrier contract. Everything a provider must implement, and the only thing the orchestrator depends on. |
| `domain/shipping.types.ts`, `strategy.types.ts` | Rate requests and quotes; the selection-strategy shapes. |
| `services/orchestrator.service.ts` | Requests rates from connected providers, applies a strategy, returns quotes. |
| `providers/base.provider.ts` | Shared provider behaviour — auth handling and common request plumbing. |
| `providers/shiprocket/` | The one live carrier: `config`, `mapper` (their shape ↔ ours), `provider`, `types`. |
| `repositories/provider.repository.ts` | Provider records. Credentials are encrypted at rest and read only by the connection path; every read that leaves the server is a projection without them. |
| `repositories/event.repository.ts` | Shipping events, appended as status changes arrive. |
| `repositories/shipment.repository.ts` | The one module that reaches the `Shipment` table ([ADR-0003](../../docs/adr/0003-one-repository-per-aggregate.md)). |
| `shipment-status.service.ts` | The single writer of `Shipment.status`, through a transition table, on the caller's transaction: checkout's `fulfilment.service.ts` holds the order's lock and calls it. The write is conditional on the status it read, and each move appends a `ParcelEvent` (the timeline). A booking's facts land with the move into `pickup_booked`; a later date change is a compare-and-set on the pickup date seen, with its own `pickup_moved` row (order-fulfilment D11). A terminal event that returns goods asks catalog's stock commands to restock, once. |
| `courier-token.ts` | Checks the courier webhook's shared token in constant time, before its body is read (order-fulfilment D9). |
| `courier-conflict.service.ts` | Records a courier update that could not apply — an AWB no parcel carries, or a move on a cancelled parcel — and serves the admin's Conflicts tab, one row per AWB (D10). `repositories/courier-conflict.repository.ts` is the table's one repository. |
| `label.ts` | The allowlist a pasted Shiprocket label link must match, and the 10 s fetch the shop's label route streams through, so the raw link never reaches the shop (order-fulfilment D7). |
| `tracking.service.ts` | What the carrier webhooks read and record. The order's status is checkout's, derived from the parcels in the move's own transaction; checkout's `courier-update.ts` drives a webhook's update through it. A courier ETD that differs replaces the ETA by compare-and-set, with an `eta_changed` timeline row (`shipment-status.service.ts`). |
| `rate-quote.service.ts` | Signs each quoted rate with its origin, destination, billable weight and a 30-minute expiry; checkout charges only what a valid signature vouches for, for the parcel it allocated itself (Invariant 1). Stateless: no quote table, no carrier call inside the order transaction. |
| `billable-weight.ts` | What a parcel is billed as: real weights summed, settled to grams, rounded up to the next kilogram, floor 1 kg ([product-weight-and-rates](../../docs/specs/product-weight-and-rates/)). |
| `services/connection.types.ts` | The shapes the connection flow exchanges. |
| `utils/statusNormalizer.ts` | Carrier status vocabulary → ours. |
| `utils/weightCalculator.ts` | Shipment weight from its contents, with a fallback when a weight is absent. |
| `init.ts` | Registers providers. Imported for side effects via `index.ts`. |
| `services/admin.shipping.service.ts`, `connection.service.ts`, `provider-auth.ts` | Provider connection and admin-console reads. Moved into this domain from the old layer tree on 2026-08-04 ([ADR-0012](../../docs/adr/0012-modules-are-vertical-slices-by-domain.md)). |

## Selection strategies

The orchestrator supports cheapest, fastest, balanced (weighted cost/speed), priority (provider order), specific, and custom. Strategy shapes are in `domain/strategy.types.ts`. Selection is a pure decision over quotes — it performs no I/O, which is why it is the most testable part of the domain.

## Credentials

Connected through the admin console at `/admin/shipping/providers`, encrypted with `ENCRYPTION_KEY`, stored on the provider record. Only configured providers can be enabled. Credentials must never appear in a response — see [CLAUDE.md](CLAUDE.md).

## Rate caching

`ShippingRateCache` exists in the schema and nothing reads or writes it. It was built for the day rate lookups became the hot path; quotes are requested live today. Dropping the table or starting to use it is a decision for [shipping-fulfilment](../../docs/specs/shipping-fulfilment/), not an accident to leave standing.

## Current state of quoting vs booking

**Quoting is real; booking is by hand.** Rate quotes come from the Shiprocket provider through the orchestrator. There is no booking call: a parcel is born `packing`, and an admin books the courier on Shiprocket and records it (own-store Q18). The mock booking that used to sit in `providers/_placeholder/` is deleted ([order-fulfilment](../../docs/specs/own-store/order-fulfilment/) D3).

Automatic booking is [shipping-fulfilment](../../docs/specs/shipping-fulfilment/), which is gated on a product decision. Its other prerequisite, [product-weight-and-rates](../../docs/specs/product-weight-and-rates/), is done.

## Weight

`Product.weight` is persisted in kilograms with gram precision, and `billable-weight.ts` turns a parcel's contents into what a courier bills: the sum, settled to grams, rounded up to the next whole kilogram, floor 1 kg — so a quote never undercharges. `utils/weightCalculator.ts` is the older helper and is reached only through `index.ts`'s re-export, which nothing imports; it is a deletion waiting for its PR.

## Intentionally absent

No automatic carrier selection on live performance data — strategies are configured, not learned. No multi-parcel splitting. No returns or reverse pickup. No label rendering or manifest generation. No dimension-based volumetric weight.
