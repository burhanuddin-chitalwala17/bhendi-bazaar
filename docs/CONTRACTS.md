# CONTRACTS.md — client ↔ server DTO contracts

- **Verified:** 2026-08-08
- **Scope:** shapes that cross the browser/server boundary via `src/app/api/**` route handlers.

## Purpose
In a monorepo the client and server share a type system but **not** a runtime. A shape TypeScript believes is shared still travels as JSON, so anything the compiler cannot see — a `Date` arriving as a string, a field the server never sends, a cast that silences a mismatch — becomes a runtime problem that compiles cleanly.

This file records the shapes that cross that boundary and is where a breaking change is negotiated. When a DTO here changes, the PR is flagged `[CONTRACT]` in [CHANGELOG.md](CHANGELOG.md).

## Rules

1. **One shape per concept, declared once.** A DTO is defined in exactly one module imported by both sides. Two declarations of the same concept drift, and the compiler will not catch it — separately declared string enums with matching values are mutually assignable.
2. **No casts across the boundary.** `as SomeType` on a value that arrived over the wire asserts a shape rather than checking it; parse with Zod ([Invariant 4](../CLAUDE.md)). `as unknown as T` is a hard block — it is a deliberate defeat of the type system.
3. **Timestamps cross as ISO strings.** JSON has no date type. A wire DTO types them `string`; conversion to `Date` is explicit and at the point of use.
4. **Money crosses as integer paise** ([ADR-0004](adr/0004-money-as-integer-paise.md)) — true since PR-37: every monetary column is `Int` paise and wire money validates as `paiseAmount`. Formatting happens once, in `src/lib/format.ts`. The one asymmetry: **admin product prices arrive as rupees** (`rupeeAmount`, ≤2 decimals — humans type rupees) and convert at the catalog service; a Zod transform could not do it because the same schema validates on both sides (ADR-0013) and would run twice.
5. **The server sends a projection, not a row.** Responses use an explicit `select`. A Prisma model is never returned wholesale — `User` carries `passwordHash` and reset tokens; `ShippingProvider` carries `authToken` and `accountInfo`.
6. **Additive changes preferred.** Add optional fields; never silently change a field's meaning. Removal goes through a deprecation note in the CHANGELOG.
7. **Server-owned fields are never accepted inbound**, even as optional: `paymentStatus`, computed totals, `rating`, `reviewsCount`, `createdAt`.

---

## The error envelope

Every route handler returns this shape on failure, and every client reads it through
`readApiError`. Defined in `src/lib/api-error.ts`; produced by `toErrorResponse`.

```json
{
  "error": "This SKU is already in use",
  "details": [{ "path": "sku", "message": "This SKU is already in use" }]
}
```

`error` is always present and always safe to show. `details` appears when the failure
can be blamed on specific input, and **one envelope carries both sources** — a Zod
failure and a database constraint violation are indistinguishable to the client, which
is the point: a form maps `details` onto its fields without knowing which produced it.

`path` matches the form field name. `useServerForm` routes each detail to its field via
`setError`, and surfaces anything it could not place rather than dropping it.

Statuses: 400 invalid input · 403 forbidden · 404 missing · 409 conflict (duplicate,
stale foreign key, exhausted stock) · 500 internal.

**Only the 500 branch discards its message.** Domain code opts into being shown by
throwing `DomainError` (or `NotFoundError` / `ConflictError` / `ForbiddenError`);
anything else is treated as an internal fault and logged, because a raw Prisma message
can name columns.

Neither key is compiler-checked, which is why both sides go through the shared helpers
rather than reaching into the body. A handler that hand-rolls `NextResponse.json({ ... })`
on an error path is a defect.

---

## Current shapes

### Cart
Two `CartItem` declarations exist: `src/domain/cart.ts` (carrying `weight`, `shippingFromPincode`, and a nested `org` block) and `server/cart/cart.types.ts` (without them). `CartTotals` likewise differs — `shipping` is present only on the client shape. The boundary is bridged by casts in `src/app/api/cart/route.ts` and `server/cart/cart.service.ts`, so the round trip is not type-checked in practice, and the org and weight fields are constructed at the boundary rather than carried from `Product`.

Consolidating to one declaration is a precondition for [product-weight-and-rates](specs/product-weight-and-rates/), which needs `weight` to travel from the catalogue to the rate quote.

### Orders
`Shipment` is declared in three places across `src/domain/order.ts` and `server/checkout/order.types.ts`. Timestamp fields (`estimatedDelivery`, `createdAt`, `updatedAt`) are typed `Date` on the client side and `string` on the server side; JSON delivers strings, so Rule 3 is not currently met.

`paymentStatus` is accepted inbound on both create and update. [payment-confirmation](specs/payment-confirmation/) removes it.

### Payments
- `POST /api/payments/create-order` accepts an `amount` from the client. [server-side-pricing-authority](specs/server-side-pricing-authority/) changes it to accept an order id and derive the amount server-side. **This is a contract change** and will carry `[CONTRACT]`.
- `POST /api/payments/verify` returns `{ verified: boolean }` and performs no write. [payment-confirmation](specs/payment-confirmation/) makes it a writer returning the resulting order state.
- Gateway webhook payloads are Razorpay's contract, not ours. See [INTEGRATIONS.md](INTEGRATIONS.md) for the `notes` round-trip.

### Admin
`GET /api/admin/shipping/providers` returns `ShippingProvider` rows without a `select`, so credential and auth-error fields reach the browser. Rule 5 requires an explicit projection exposing only connection state.

### Products
`ProductFormInput` is still declared on both sides — `src/admin/products/types.ts` and `server/catalog/admin.product.types.ts` — so the two can drift again. `weight` is the field that already did: required by the client type, absent from the server type, therefore collected and never written. Both now carry it and the repository persists it ([PR-22](CHANGELOG.md)), but the duplicate declaration is the underlying defect and remains. Consolidating it is PR 1 of [stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/), which cannot proceed cleanly until it is done — see that feature's [consumer-inventory.md](specs/multi-vendor-marketplace/consumer-inventory.md) for every affected site, including six files that repeat the same inline org prop type.

The three shipping-origin fields — `shippingFromPincode`, `shippingFromCity`, `shippingFromLocation` — are an all-or-none group: either all three are present or all three are absent. Enforced in `productFormSchema`, so both the form and the route apply it. Absent is spelled `NULL`, never `''`; readers treat absence as "fall back to the org's default address". That fallback is evaluated on four separate read paths, and one of them mixes a product's pincode with its org's city; [stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) replaces all three fields with a foreign key and removes the fallback.

---

## Adding a DTO to this file
Record a shape when it crosses the boundary and either more than one route uses it, or getting it wrong would fail silently. A one-off response shape used by a single route does not need an entry — its Zod schema is its documentation.
