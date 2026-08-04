# CLAUDE.md — payments domain

> **Read the project-wide rules first:** [`/CLAUDE.md`](../../CLAUDE.md) covers the SDLC and the seven Project Invariants. This file covers **payments** only.

## Purpose
Payments owns the conversation with the gateway and the single fact that follows from it: whether an order has been paid. Nothing else.

## Boundaries

**Owns:** `server/payments/**` — `payment.service.ts`, `payment.types.ts`, and `providers/razorpay/` as the gateway adapter.

**Does not own:** what the amount should be. That is computed by `checkout` from catalogue prices ([ADR-0002](../../docs/adr/0002-server-holds-pricing-authority.md)); payments reads the persisted order and charges that.

## Rules

- **`paymentStatus: "paid"` has exactly one writer**, and only after three checks in order: verify the gateway signature, load the persisted order, confirm the gateway's amount equals that order's total ([ADR-0005](../../docs/adr/0005-payment-state-server-only.md)).
- **The gateway amount is derived from the persisted order.** Never accepted from a caller.
- **A signature proves a payment happened, not that it was for the right amount.** The amount check is separate and mandatory — the signature attests to the gateway's own order, which says nothing about ours.
- **Compare signatures with `crypto.timingSafeEqual`**, never `===`.
- **The transition is idempotent**, keyed on the gateway payment id, so a retry does not resend a confirmation email.
- **Fail loudly.** A webhook whose payload cannot be matched to an order logs an error and returns non-2xx, so the gateway retries and the failure is visible. **A silent 2xx is how a dead payment path stayed hidden for months** — this rule exists because of that, and it is the one most easily undone by someone "cleaning up" error handling.
- **Never accept `paymentStatus` from a request body**, at creation or update ([`/CLAUDE.md`](../../CLAUDE.md) Invariant 4).
- **No `any` in this tree.**

## The adapter boundary

`providers/razorpay/` is the only place gateway-specific shapes exist. Business logic — "is this order paid" — lives in `payment.service.ts` and must not reference the gateway's request or response types directly. A second gateway should be a sibling folder, not a conditional.

## Gateway behaviour

Razorpay quirks — integer paise, the two different signature computations, the `notes` round-trip whose keys no compiler checks — are recorded in [INTEGRATIONS.md](../../docs/INTEGRATIONS.md). Read it before changing anything that crosses the wire.
