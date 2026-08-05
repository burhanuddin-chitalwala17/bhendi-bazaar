# CLAUDE.md — checkout domain

> **Read the project-wide rules first:** [`/CLAUDE.md`](../../CLAUDE.md) covers the SDLC and the seven Project Invariants. This file covers **checkout** only.

## Purpose
Checkout owns an order's existence and lifecycle — placement, state transitions, and lookup. It is the orchestrating domain: it reads prices from `catalog`, reserves stock there, asks `payments` to collect money, and hands `shipping` something to send. It calls no external service itself.

## Boundaries

**Owns:** `server/checkout/**` — `order.service.ts`, `order.repository.ts`, `order.types.ts`, and the `admin.order.*` reads that power the admin console.

**Does not own:** what an item costs (`catalog`), whether money arrived (`payments`), or whether a parcel exists (`shipping`). It composes them.

## Rules

- **The server computes every monetary field** from persisted catalogue data. A price or total arriving in a request body is discarded, not validated ([ADR-0002](../../docs/adr/0002-server-holds-pricing-authority.md), [server-side-pricing-authority](../../docs/specs/server-side-pricing-authority/)).
- **Never write `paymentStatus`.** That belongs to `payments`, which has exactly one writer ([ADR-0005](../../docs/adr/0005-payment-state-server-only.md)).
- **Order creation, stock reservation, and cart clearing are one transaction.** An order must not exist without its stock movement ([inventory-reservation](../../docs/specs/inventory-reservation/)).
- **An ownership check is not `if (userId && ...)`.** A guard that skips when the identity is absent is not a guard — an anonymous caller passes it. Check identity presence and ownership as separate conditions, and decide explicitly what a guest order permits.
- **Order lookup returns a projection.** An order carries a customer's name, phone, email, and full address; a lookup reachable without authentication must not return them.
- **One creation path.** Two paths with different behaviour is how one of them silently becomes the weaker one.
- **A check and a write that must be atomic are one statement.** Read-then-write is not a check, even inside `$transaction` ([ADR-0007](../../docs/adr/0007-conditional-stock-decrement.md)).
- **Side effects belong to the transition that earns them.** A confirmation email fires from the state change, not from whichever route happened to trigger it.
- **Throw `DomainError` for anything a user should see**, `NotFoundError` / `ConflictError` as appropriate. A bare `throw new Error(...)` is treated as an internal fault and reported generically — correct for a config or code failure, wrong for "insufficient stock" ([ADR-0013](../../docs/adr/0013-one-error-envelope-and-useserverform.md)).
- **No `any` in this tree** — it sits on the money path ([`/CLAUDE.md`](../../CLAUDE.md) Invariant 4).

## Structure

`order.service.ts` holds the logic and owns transactions. `order.repository.ts` is the only place `prisma.order` is touched ([ADR-0003](../../docs/adr/0003-one-repository-per-aggregate.md)). `admin.order.*` are additional reads on the same aggregate — **not a separate admin domain**; an admin order list is a query on checkout.
