# CLAUDE.md — shipping domain

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
  - `providers/_placeholder/mock.booking.ts` was this instance; it is deleted. Booking now goes through `IShippingProvider.createShipment()` (currently `providers/shiprocket/`), per [shipping-fulfilment](../../docs/specs/shipping-fulfilment/) D1 — see that domain's [ARCHITECTURE.md](ARCHITECTURE.md) for what of the full spec has landed and what has not.
- **Carrier credentials are encrypted at rest** and never leave the server. A response that includes `authToken`, `accountInfo`, or an auth error violates the projection rule in [CONTRACTS.md](../../docs/CONTRACTS.md). Use an explicit `select`.
- **A carrier's status vocabulary is normalised on entry.** `utils/statusNormalizer.ts` maps a provider's strings to ours. Carrier status strings never reach the database or the client.
- **Weight comes from the persisted shipment**, not recomputed at call time, so what is booked matches what was quoted and charged.
- **Every external call has a timeout and a bounded, idempotent retry.** A retry that can produce a second parcel is worse than a failure. `server/shared/retry.ts` provides the mechanism; idempotency is the caller's responsibility.
- **Webhooks are verified before they are trusted, and fail loudly.** Returning 2xx on a payload you could not match is forbidden — see the reasoning in [ADR-0005](../../docs/adr/0005-payment-state-server-only.md), which exists because a silently-succeeding webhook hid a broken payment path for months.
- **Carrier quirks go in [INTEGRATIONS.md](../../docs/INTEGRATIONS.md)**, not in comments here. They are operational knowledge that outlives any one call site.

## Structure

| Path | Holds |
|---|---|
| `domain/` | The provider interface, shipping types, strategy types. No implementations. |
| `providers/<name>/` | One carrier: config, mapper, provider, types. `base.provider.ts` holds shared behaviour. |
| `services/orchestrator.service.ts` | Fans a rate request across providers and applies a selection strategy. |
| `repositories/` | Provider records and shipping events. |
| `utils/` | Encryption, status normalisation, weight calculation, validators. |
| `adr/` | Decisions internal to this domain. |

## Adding a carrier

1. `/bb-brainstorm` the carrier's API first — auth model, rate request shape, booking semantics, webhook format, and failure behaviour. The failure behaviour is usually what determines the design.
2. `/bb-sdlc adr-new` if it forces a change to the interface. If the interface needs to change to fit a second carrier, that is a finding about the interface.
3. Implement under `providers/<name>/`, register it, and record its quirks in [INTEGRATIONS.md](../../docs/INTEGRATIONS.md).
4. Never call the live API from a test.

## Docs

[ARCHITECTURE.md](ARCHITECTURE.md) — current state of this domain. [adr/](adr/) — its decisions. Cross-domain concerns stay in [`/docs/`](../../docs/).
