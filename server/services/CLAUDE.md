# CLAUDE.md — server services (checkout, payments, and neighbours)

> **Read the project-wide rules first:** [`/CLAUDE.md`](../../CLAUDE.md) covers the SDLC and the seven Project Invariants. This file covers the **service layer**, and in particular the two domains whose code lives here: **checkout** and **payments**.

> **Why one file for two domains:** the code in this tree is organised by *layer*, not by domain — `orderService.ts` and `paymentService.ts` are siblings rather than living in `checkout/` and `payments/` directories. This file is therefore co-located with both. When [ADR-0003](../../docs/adr/0003-one-repository-per-aggregate.md) consolidation gives each domain its own directory, split this into per-domain files.

## What a service is here

A service holds business logic and owns transactions. It sits between route handlers (which parse and authorize) and repositories (which talk to Prisma). A service:

- **Never** reads `request`, `headers`, or cookies. If it needs the caller's identity, it is passed an id.
- **Never** returns a `NextResponse`. It returns data or throws.
- **Owns the transaction boundary.** A rule spanning two writes belongs in one `$transaction` here, not split across two repository calls.
- Is where an invariant is enforced, because it is the narrowest place that sees the whole operation.

## Rules for this layer

- **An ownership check is not `if (userId && ...)`.** A guard that skips when the identity is absent is not a guard — an anonymous caller passes it. Check identity presence and ownership as separate conditions, and decide explicitly what an unowned (guest) record permits.
- **A check and a write that must be atomic are one statement.** Read-then-write is not a check, even inside `$transaction` ([ADR-0007](../../docs/adr/0007-conditional-stock-decrement.md)).
- **Side effects go inside the transition that earns them.** A confirmation email belongs to the state change that makes an order paid, not to whatever route happened to trigger it — otherwise it fires more than once, or on the wrong event.
- **No `any` in this tree.** These modules sit on the money path; an untyped value here is a defect ([Invariant 4](../../CLAUDE.md)).
- **One service per concept.** If a name here also exists as a client-side `fetch` wrapper under `src/services/`, rename the client one for what it is. Two live symbols with one name is how callers end up importing the wrong thing.

## checkout — `orderService.ts`, `orderRepository.ts`

Owns an order's existence and lifecycle: placement, state transitions, and lookup.

- **The server computes every monetary field** from persisted catalogue data. A price or total from a request body is discarded, not validated ([ADR-0002](../../docs/adr/0002-server-holds-pricing-authority.md), [server-side-pricing-authority](../../docs/specs/server-side-pricing-authority/)).
- **Order creation, stock reservation, and cart clearing are one transaction.** An order must not exist without its stock movement ([inventory-reservation](../../docs/specs/inventory-reservation/)).
- **Order lookup returns a projection.** An order carries a customer's name, phone, email, and full address; a lookup reachable without authentication must not return them.
- **One creation path.** There are currently two with different behaviour; the weaker one goes rather than being brought up to standard.
- Never sets payment state — see below.

## payments — `paymentService.ts`, `razorpayRepository.ts`

Owns the conversation with the gateway, and nothing else.

- **`paymentStatus: "paid"` has exactly one writer**, and only after verifying a gateway signature, loading the persisted order, and matching the gateway's amount to that order's total — all three, in that order ([ADR-0005](../../docs/adr/0005-payment-state-server-only.md)).
- **The gateway amount is derived from the persisted order.** Never accepted from a caller.
- **A signature proves a payment happened, not that it was for the right amount.** The amount check is separate and mandatory.
- **Compare signatures with `crypto.timingSafeEqual`**, never `===`.
- **The transition is idempotent**, keyed on the gateway payment id, so a retry does not resend a confirmation email.
- **Fail loudly.** A webhook whose payload cannot be matched to an order logs an error and returns non-2xx so the gateway retries and the failure is visible. A silent 2xx is how a dead payment path stayed hidden for months — this is the rule that exists because of that.
- **Gateway quirks belong in [INTEGRATIONS.md](../../docs/INTEGRATIONS.md)**, including the `notes` round-trip, whose keys are a string contract no compiler checks.

## Also in this tree

`cartService.ts` (cart persistence and the sign-in merge), `productService.ts`, `categoryService.ts`, `profileService.ts`, `adress.service.ts` *(name misspelled; the typo is load-bearing in two import paths — fix both together)*, `passwordService.ts`, `emailService.ts` and `email/`, `admin/`, and `shipping/mockShippingIntegration.ts` *(a placeholder reachable from production fulfilment — see [shipping-fulfilment](../../docs/specs/shipping-fulfilment/))*.

The shipping domain proper is [`server/shipping/`](../shipping/CLAUDE.md) and has its own rules.
