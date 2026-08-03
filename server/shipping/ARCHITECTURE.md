# ARCHITECTURE.md — shipping domain, current state

- **Verified:** 2026-08-03
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

## Selection strategies

The orchestrator supports cheapest, fastest, balanced (weighted cost/speed), priority (provider order), specific, and custom. Strategy shapes are in `domain/strategy.types.ts`. Selection is a pure decision over quotes — it performs no I/O, which is why it is the most testable part of the domain.

## Credentials

Connected through the admin console at `/admin/shipping/providers`, encrypted with `ENCRYPTION_KEY`, stored on the provider record. Only configured providers can be enabled. Credentials must never appear in a response — see [CLAUDE.md](CLAUDE.md).

## Rate caching

`ShippingRateCache` keys quotes by provider, origin, destination, weight, and mode. It exists because rate lookups are the hot path in checkout and carrier APIs are slow and rate-limited.

## Current state of quoting vs booking

**Quoting is real; booking is not.** Rate quotes come from the Shiprocket provider through the orchestrator. Shipment booking is called from `server/services/orderService.ts` and routed to `server/services/shipping/mockShippingIntegration.ts` — outside this domain — which returns generated tracking data rather than contacting a carrier.

Unifying them is [shipping-fulfilment](../../docs/specs/shipping-fulfilment/), which is gated on a product decision and on [product-weight-and-rates](../../docs/specs/product-weight-and-rates/).

## Weight

`weightCalculator.ts` sums item weights and falls back to a default when an item has none. Because `Product.weight` is not currently persisted, the fallback is the normal path rather than the exception — [product-weight-and-rates](../../docs/specs/product-weight-and-rates/) addresses this, and it is a prerequisite for real booking.

## Intentionally absent

No automatic carrier selection on live performance data — strategies are configured, not learned. No multi-parcel splitting. No returns or reverse pickup. No label rendering or manifest generation. No dimension-based volumetric weight.
