# Spec — payment confirmation

- **Status:** ✅ Implemented — PR-39 (R7's refund flow remains Phase 5, as scoped)
- **Domain:** payments, checkout
- **Phase:** 2 — Transaction integrity
- **Verified:** 2026-08-03
- **References:** [trd.md](trd.md), [ADR-0005](../../adr/0005-payment-state-server-only.md), [INTEGRATIONS.md](../../INTEGRATIONS.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is
An order becomes paid when the payment gateway says it was paid, for the right amount, and never for any other reason.

## Why
Whether an order is paid decides whether goods ship. That decision has to rest on evidence from the party that actually moved the money, not on a report from the browser that initiated it — a browser can close, lie, retry, or be replaced by a script.

It also has to be *reliable in both directions*: a payment that succeeded must reach `paid` even if the customer closes the tab immediately, and a confirmation that fails to arrive must be visible rather than leaving an order silently stuck.

## Requirements
- **R1** — An order is marked paid only after the store has verified a gateway signature and matched the gateway's amount to the order's own total.
- **R2** — Payment state cannot be set by a request from a browser, at order creation or afterwards.
- **R3** — Confirmation is reliable if the customer leaves immediately after paying, and if the gateway's notification is delayed or retried.
- **R4** — Confirming the same payment more than once has the same effect as confirming it once: no duplicate confirmation emails, no double state change.
- **R5** — A confirmation the store cannot match to an order is recorded as a failure and surfaced, not discarded.
- **R6** — An order left unconfirmed beyond a defined window is detected without anyone watching for it.
- **R7** — A failed or abandoned payment leaves the order in a state that says so, and releases anything the order was holding.

## Product acceptance
- **A1** — Paying successfully then closing the tab immediately still results in a paid order and a confirmation email.
- **A2** — An attempt to mark an order paid without a gateway payment does not succeed, whether or not the caller is signed in as the order's owner.
- **A3** — Paying less than the order total does not result in a paid order.
- **A4** — A duplicate gateway notification produces exactly one confirmation email.
- **A5** — An order whose confirmation never arrives appears in an operational view rather than looking normal.
- **A6** — An abandoned payment leaves an order that the customer can retry or that expires cleanly.

## Out of scope (this feature)
- What the order total *is* — [server-side-pricing-authority](../server-side-pricing-authority/).
- Releasing reserved stock on failure — mechanism belongs to [inventory-reservation](../inventory-reservation/); R7 states the requirement it must satisfy.
- Refunds and partial refunds. Related but a distinct flow; Phase 5.
- Payment methods other than the current gateway.
