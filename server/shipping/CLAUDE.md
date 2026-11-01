# CLAUDE.md — shipping domain

- **Verified:** 2026-11-01
- **Covers:** `server/shipping/**`

> **Read the project-wide rules first:** [`/CLAUDE.md`](../../CLAUDE.md) covers the SDLC, the seven Project Invariants, and the conventions index. This file covers what applies only to the **shipping** domain.

## Purpose
Shipping owns everything between "a customer has an address" and "a parcel is moving": quoting rates from carriers, choosing among them, booking shipments, and tracking status. It is the only domain in the project with a real provider abstraction, because it is the only one expected to speak to more than one external system.

## Boundaries

**Owns:** `server/shipping/**` — the provider interface and its implementations, the orchestrator, rate caching, status normalisation, weight calculation, and provider credential storage.

**Consumes:** a shipment's contents, weights, origin and destination. It does not read the cart or the order directly — it is handed what it needs.

**Does not own:** what a customer is *charged* for shipping. A quote is an input to pricing, and pricing authority belongs to checkout ([ADR-0002](../../docs/adr/0002-server-holds-pricing-authority.md)). Never write an order total from this domain.

## Rules

- **Every carrier goes behind the provider interface.** `domain/provider.interface.ts` is the contract; a provider is an implementation of it and nothing else. No carrier-specific branching outside `providers/<name>/`. This is what makes a second carrier a new file rather than a refactor.
- **A placeholder must be unmistakable, and must have a spec to remove it.** The failure mode this guards against is not a stub existing — it is a stub that *reads as an implementation* and gets selected in production without anyone noticing. So: a test double lives under `tests/`, where application code cannot import it; and any stub that application code can reach lives in a folder named for what it is (`providers/_placeholder/`) with a spec that deletes it. A mock named as though it were a provider is forbidden.
  - No instance today: the mock booking was deleted by [order-fulfilment](../../docs/specs/own-store/order-fulfilment/) D3.
- **Carrier credentials are encrypted at rest** and never leave the server — every read that answers a request is `ShippingProviderSummary`, and `tests/unit/provider-dto.test.ts` fails a select that widens it. A response that includes `authToken`, `accountInfo`, or an auth error violates the projection rule in [CONTRACTS.md](../../docs/CONTRACTS.md). Use an explicit `select`.
- **A carrier's status vocabulary is normalised on entry, and an unmapped one is reported rather than guessed.** `utils/statusNormalizer.ts` maps a provider's strings into `SHIPMENT_STATUS` and returns `null` when it cannot — the caller then leaves the shipment where it is and keeps the raw wording, because a wrong status is worse than an unknown one: only the unknown one gets looked at. Adding a carrier is a table in that file ([shipment-lifecycle](../../docs/specs/shipment-lifecycle/)).
- **`Shipment.status` has exactly one writer**, `shipment-status.service.ts`, and the transition table is the guard — no exceptions since [order-fulfilment](../../docs/specs/own-store/order-fulfilment/) D3. It runs on the caller's transaction, and the caller is checkout's `fulfilment.service.ts`, which locks the order first; the write is conditional on the status read (D2). That is what gives "cancel only before pickup" and "never move backwards" from one mechanism, and makes a retried or late webhook a no-op instead of a parcel walking backwards. A literal written straight to the column is how that column came to hold three vocabularies at once.
- **A rate reaches checkout only as a signed quote** (`rate-quote.service.ts`). The rates route signs it for an origin, destination and billable weight; checkout verifies it against the parcel it allocated. A rate figure in a request is never charged.
- **Weight comes from the persisted shipment**, not recomputed at call time, so what is booked matches what was quoted and charged.
- **Every external call has a timeout and a bounded, idempotent retry.** A retry that can produce a second parcel is worse than a failure. `server/shared/retry.ts` provides the mechanism; idempotency is the caller's responsibility.
- **Webhooks are verified before they are trusted, and fail loudly.** The courier's token (`SHIPROCKET_WEBHOOK_TOKEN`) is checked by `courier-token.ts` before the body is read (order-fulfilment D9). An update we cannot apply — an unknown AWB, a move on a cancelled parcel — is a `CourierConflict` row the admin sees; that row is the loud part, so it is answered 2xx (Q32). Returning 2xx on a payload you neither applied nor recorded is forbidden — see the reasoning in [ADR-0005](../../docs/adr/0005-payment-state-server-only.md), which exists because a silently-succeeding webhook hid a broken payment path for months.
- **Carrier quirks go in [INTEGRATIONS.md](../../docs/INTEGRATIONS.md)**, not in comments here. They are operational knowledge that outlives any one call site.

## Structure

| Path | Holds |
|---|---|
| `domain/` | The provider interface, shipping types, strategy types. No implementations. |
| `providers/<name>/` | One carrier: config, mapper, provider, types. `base.provider.ts` holds shared behaviour. |
| `services/orchestrator.service.ts` | Fans a rate request across providers and applies a selection strategy. |
| `repositories/` | Provider records, shipping events, and shipments (`shipment.repository.ts`). |
| `shipment-status.service.ts` | The single writer of `Shipment.status`. |
| `tracking.service.ts` | What the carrier webhooks read and record; order state goes to checkout's service. The admin's hand booking replaced the tracking route (order-fulfilment D11). |
| `courier-token.ts` | The constant-time check of the courier webhook's `x-api-key` token (order-fulfilment D9). |
| `courier-conflict.service.ts` | Courier updates that could not apply, recorded, listed by AWB and dismissed (D10). Its table's one repository is `repositories/courier-conflict.repository.ts`. |
| `label.ts` | The label-link allowlist and fetch behind the shop's label route (order-fulfilment D7). |
| `utils/` | Status normalisation, weight calculation, validators. Secrets at rest use `server/shared/crypto.ts`. |
| `adr/` | Decisions internal to this domain. |

## Adding a carrier

1. `/bb-brainstorm` the carrier's API first — auth model, rate request shape, booking semantics, webhook format, and failure behaviour. The failure behaviour is usually what determines the design.
2. `/bb-sdlc adr-new` if it forces a change to the interface. If the interface needs to change to fit a second carrier, that is a finding about the interface.
3. Implement under `providers/<name>/`, register it, and record its quirks in [INTEGRATIONS.md](../../docs/INTEGRATIONS.md).
4. Never call the live API from a test.

## Docs

[ARCHITECTURE.md](ARCHITECTURE.md) — current state of this domain. [adr/](adr/) — its decisions. Cross-domain concerns stay in [`/docs/`](../../docs/).
