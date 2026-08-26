# ARCHITECTURE.md — shipping domain, current state

- **Verified:** 2026-08-25
- **Scope:** `server/shipping/**`. Product-wide architecture is [`/docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

Describes what exists now. Update after a structural change, never before.

## Shape

```
        rate request                          ┌── providers/shiprocket/ ──▶ Shiprocket API
              │                               │
       services/orchestrator.service.ts ──────┤   (one impl of domain/provider.interface.ts)
              │        │                      │
   strategy selection  └── ShippingRateCache   └── (future carriers register here)
              │
        selected rate ──▶ checkout (as an input to pricing, never a write)
```

Status updates arrive independently, by webhook, and are normalised before they touch the database.

## Pieces

| Piece | Role |
|---|---|
| `domain/provider.interface.ts` | The carrier contract. Everything a provider must implement, and the only thing the orchestrator depends on. |
| `domain/shipping.types.ts`, `strategy.types.ts` | Rate requests and quotes; the selection-strategy shapes. |
| `services/orchestrator.service.ts` | Requests rates from connected providers, applies a strategy, returns quotes. |
| `providers/base.provider.ts` | Shared provider behaviour — auth handling and common request plumbing. |
| `providers/shiprocket/` | The one live carrier: `config`, `mapper` (their shape ↔ ours), `provider`, `types`. |
| `repositories/provider.repository.ts` | Provider records, including encrypted credentials. |
| `repositories/event.repository.ts` | Shipping events, appended as status changes arrive. |
| `utils/encryption.ts` | AES-256-GCM, random IV per message, PBKDF2 key derivation. |
| `utils/statusNormalizer.ts` | Carrier status vocabulary → ours. |
| `utils/weightCalculator.ts` | Shipment weight from its contents, with a fallback when a weight is absent. |
| `init.ts` | Registers providers. Imported for side effects via `index.ts`. |
| `services/admin.shipping.service.ts`, `connection.service.ts`, `provider-auth.ts` | Provider connection and admin-console reads. Moved into this domain from the old layer tree on 2026-08-04 ([ADR-0012](../../docs/adr/0012-modules-are-vertical-slices-by-domain.md)). |

## Selection strategies

The orchestrator supports cheapest, fastest, balanced (weighted cost/speed), priority (provider order), specific, and custom. Strategy shapes are in `domain/strategy.types.ts`. Selection is a pure decision over quotes — it performs no I/O, which is why it is the most testable part of the domain.

## Credentials

Connected through the admin console at `/admin/shipping/providers`, encrypted with `ENCRYPTION_KEY`, stored on the provider record. Only configured providers can be enabled. Credentials must never appear in a response — see [CLAUDE.md](CLAUDE.md).

## Rate caching

`ShippingRateCache` keys quotes by provider, origin, destination, weight, and mode. It exists because rate lookups are the hot path in checkout and carrier APIs are slow and rate-limited.

## Current state of quoting vs booking

**Both are real, but booking is the first, scoped slice of [shipping-fulfilment](../../docs/specs/shipping-fulfilment/), not the full spec.** `IShippingProvider.createShipment()` books through the same Shiprocket provider that quotes, called from `OrderService.fulfillOrder()` (`server/checkout/order.service.ts`), which runs automatically right after payment confirms (`onPaymentConfirmed`). `providers/_placeholder/mock.booking.ts` is deleted — nothing in application code returns a fake AWB any more.

What this slice does: books one real order + AWB per shipment, idempotently (the shipment's own code is sent as the provider's order id on every retry, so a repeated attempt cannot double-book), and marks a shipment `failed` with the courier's error recorded rather than silently appearing fulfilled. A customer gets a real, working tracking link.

What it deliberately does not do yet (the rest of the spec's 5-PR plan): no webhook-driven status sync (R5) — a shipment's status after booking is not updated as the parcel moves. No cancellation propagation (R6). No automatic pickup scheduling — Shiprocket's `SCHEDULE_PICKUP` endpoint is unused, so a booked shipment still needs a pickup requested through Shiprocket directly or a follow-up PR. No handling for the TRD's open questions Q2 (courier-charge variance) or Q4 (an order stuck on repeated booking failure) — a failed shipment surfaces only as `status: "failed"` with `shippingMeta.fulfillmentError`, read today by nothing in the admin UI.

The pickup location a shipment books against is `OrgAddress.name` (or `providerRef` if set) — this must match a pickup location nickname already registered in the connected Shiprocket account, and `OrgAddress.contactName`/`contactPhone` must be filled in, or booking fails fast with `NonRetryableError` rather than sending Shiprocket incomplete data.

## Weight

`weightCalculator.ts` sums item weights and falls back to a default when an item has none. Because `Product.weight` is not currently persisted, the fallback is the normal path rather than the exception — [product-weight-and-rates](../../docs/specs/product-weight-and-rates/) addresses this, and it is a prerequisite for real booking.

## Intentionally absent

No automatic carrier selection on live performance data — strategies are configured, not learned. No multi-parcel splitting. No returns or reverse pickup. No label rendering or manifest generation. No dimension-based volumetric weight.
