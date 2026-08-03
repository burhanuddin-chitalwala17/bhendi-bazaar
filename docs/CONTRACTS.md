# CONTRACTS.md — client ↔ server DTO contracts

- **Verified:** 2026-08-03
- **Scope:** shapes that cross the browser/server boundary via `src/app/api/**` route handlers.

## Purpose
In a monorepo the client and server share a type system but **not** a runtime. A shape TypeScript believes is shared still travels as JSON, so anything the compiler cannot see — a `Date` arriving as a string, a field the server never sends, a cast that silences a mismatch — becomes a runtime problem that compiles cleanly.

This file records the shapes that cross that boundary and is where a breaking change is negotiated. When a DTO here changes, the PR is flagged `[CONTRACT]` in [CHANGELOG.md](CHANGELOG.md).

## Rules

1. **One shape per concept, declared once.** A DTO is defined in exactly one module imported by both sides. Two declarations of the same concept drift, and the compiler will not catch it — separately declared string enums with matching values are mutually assignable.
2. **No casts across the boundary.** `as SomeType` on a value that arrived over the wire asserts a shape rather than checking it; parse with Zod ([Invariant 4](../CLAUDE.md)). `as unknown as T` is a hard block — it is a deliberate defeat of the type system.
3. **Timestamps cross as ISO strings.** JSON has no date type. A wire DTO types them `string`; conversion to `Date` is explicit and at the point of use.
4. **Money crosses as integer paise** ([ADR-0004](adr/0004-money-as-integer-paise.md)). Formatting happens in the component.
5. **The server sends a projection, not a row.** Responses use an explicit `select`. A Prisma model is never returned wholesale — `User` carries `passwordHash` and reset tokens; `ShippingProvider` carries `authToken` and `accountInfo`.
6. **Additive changes preferred.** Add optional fields; never silently change a field's meaning. Removal goes through a deprecation note in the CHANGELOG.
7. **Server-owned fields are never accepted inbound**, even as optional: `paymentStatus`, computed totals, `rating`, `reviewsCount`, `createdAt`.

---

## Current shapes

### Cart
Two `CartItem` declarations exist: `src/domain/cart.ts` (carrying `weight`, `shippingFromPincode`, and a nested `seller` block) and `server/domain/cart.ts` (without them). `CartTotals` likewise differs — `shipping` is present only on the client shape. The boundary is bridged by casts in `src/app/api/cart/route.ts` and `server/services/cartService.ts`, so the round trip is not type-checked in practice, and the seller and weight fields are constructed at the boundary rather than carried from `Product`.

Consolidating to one declaration is a precondition for [product-weight-and-rates](specs/product-weight-and-rates/), which needs `weight` to travel from the catalogue to the rate quote.

### Orders
`Shipment` is declared in three places across `src/domain/order.ts` and `server/domain/order.ts`. Timestamp fields (`estimatedDelivery`, `createdAt`, `updatedAt`) are typed `Date` on the client side and `string` on the server side; JSON delivers strings, so Rule 3 is not currently met.

`paymentStatus` is accepted inbound on both create and update. [payment-confirmation](specs/payment-confirmation/) removes it.

### Payments
- `POST /api/payments/create-order` accepts an `amount` from the client. [server-side-pricing-authority](specs/server-side-pricing-authority/) changes it to accept an order id and derive the amount server-side. **This is a contract change** and will carry `[CONTRACT]`.
- `POST /api/payments/verify` returns `{ verified: boolean }` and performs no write. [payment-confirmation](specs/payment-confirmation/) makes it a writer returning the resulting order state.
- Gateway webhook payloads are Razorpay's contract, not ours. See [INTEGRATIONS.md](INTEGRATIONS.md) for the `notes` round-trip.

### Admin
`GET /api/admin/shipping/providers` returns `ShippingProvider` rows without a `select`, so credential and auth-error fields reach the browser. Rule 5 requires an explicit projection exposing only connection state.

### Products
`ProductFormInput` is declared on both sides with different fields — `weight` is required by the client form type and absent from the server type the repository uses, so it is collected and not persisted. Reconciling the two is part of [product-weight-and-rates](specs/product-weight-and-rates/).

---

## Adding a DTO to this file
Record a shape when it crosses the boundary and either more than one route uses it, or getting it wrong would fail silently. A one-off response shape used by a single route does not need an entry — its Zod schema is its documentation.
