# Contracts — payments

- **Verified:** 2026-11-24
- **Covers:** `server/payments/*.types.ts`

The payments shapes that cross the browser/server boundary. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## Payments
- `POST /api/payments/create-order` takes `{ localOrderId, customer? }` and **derives the amount from the persisted order's `grandTotal`** (PR-38) — which was itself computed from the catalogue inside the creation transaction. An `amount` in the body is not read; the field no longer exists in the schema.
- `POST /api/payments/verify` **is the browser-return confirmation trigger** (PR-39): it takes `{ localOrderId, razorpay_* }`, verifies the signature against the persisted order, performs the paid transition, and returns `{ orderId, paymentStatus }`. `POST /api/payments/confirm-free` does the same for zero-total orders. `PATCH /api/orders/[id]` is **deleted** — nothing updates an order from the browser any more.
- Gateway webhook payloads are Razorpay's contract, not ours. See [INTEGRATIONS.md](../INTEGRATIONS.md) for the `notes` round-trip.

`POST /api/payments/abandon` (PR-104) takes `{ localOrderId }` — an order reference and deliberately nothing else. It reports that the buyer left the payment window; it does **not** assert what happened to the money, which the server establishes by asking the gateway. Returns `{ orderId, outcome }`, where `outcome` is one of `released`, `confirmed`, `in-flight`, `already-paid`, `already-released`, `not-released`. Safe to call more than once, and safe never to call — the reconciliation sweep reaches the same answer later.
