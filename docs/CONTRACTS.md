# CONTRACTS.md — client ↔ server DTO contracts

- **Verified:** 2026-08-10
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
Since PR-44 the server stores only the buyer's choice per line (`CartLineInput`: product, quantity, size, colour) and **derives everything else from the product at read time** — prices, names, `weight`, `shippingFromPincode`, and the `org` block all come from the join, so a cart can no longer hold a stale or spoofed price and the boundary casts are gone. Since PR-45 there is **one `CartItem` declaration** (`server/cart/cart.types.ts`, re-exported by `src/domain/cart.ts`), satisfying Rule 1.

### Orders
`Shipment` is declared in three places across `src/domain/order.ts` and `server/checkout/order.types.ts`. Timestamp fields (`estimatedDelivery`, `createdAt`, `updatedAt`) are typed `Date` on the client side and `string` on the server side; JSON delivers strings, so Rule 3 is not currently met.

Order creation (`create-with-shipments`) accepts **unpriced lines** — `{ productId, quantity, size?, color? }` — plus a `displayedGrandTotal` used only for the changed-mid-session comparison and never persisted (PR-38). The optional variant (PR-43) is validated against the product's declared options server-side; on every outbound items array, `price` is the unit price actually paid and lines are rebuilt from `OrderItem`/`ShipmentItem` rows — the JSON blob is legacy. `paymentStatus` crosses the wire in **no direction** since PR-39: the update route is deleted, and the paid/failed transitions in `order.repository.ts` are the only writers (ADR-0005).

### Payments
- `POST /api/payments/create-order` takes `{ localOrderId, customer? }` and **derives the amount from the persisted order's `grandTotal`** (PR-38) — which was itself computed from the catalogue inside the creation transaction. An `amount` in the body is not read; the field no longer exists in the schema.
- `POST /api/payments/verify` **is the browser-return confirmation trigger** (PR-39): it takes `{ localOrderId, razorpay_* }`, verifies the signature against the persisted order, performs the paid transition, and returns `{ orderId, paymentStatus }`. `POST /api/payments/confirm-free` does the same for zero-total orders. `PATCH /api/orders/[id]` is **deleted** — nothing updates an order from the browser any more.
- Gateway webhook payloads are Razorpay's contract, not ours. See [INTEGRATIONS.md](INTEGRATIONS.md) for the `notes` round-trip.

### Admin
`GET /api/admin/shipping/providers` returns `ShippingProvider` rows without a `select`, so credential and auth-error fields reach the browser. Rule 5 requires an explicit projection exposing only connection state.

### Addresses
The address-book wire shape (`DeliveryAddress`) is flat and stable, but since PR-41 its `id` is the **UserAddress** relationship id (server-generated — clients no longer mint ids), `metadata` is gone (label and notes are top-level), and `fullName`, `mobile`, `state` are required. Storage is two tables: `Address` (postal fact, written only by `server/shared/address.repository.ts`) and `UserAddress` (the person's relationship). `Order.address` remains an embedded snapshot, deliberately.

### Products
`ProductFormInput` has **one declaration** since PR-45 — `server/catalog/admin.product.types.ts`, re-exported by `src/admin/products/types.ts`. It is the shape that already drifted once: `weight` was required by the client copy, absent from the server one, therefore collected and never written ([PR-22](CHANGELOG.md)). The same PR collapsed the ten copies of the org summary block (two domain files, two server types, six inline prop types — [consumer-inventory.md](specs/multi-vendor-marketplace/consumer-inventory.md) §1) into `OrgSummary` (`server/catalog/org.types.ts`), which is where PR-49 removed the `default*` fields in one edit when [stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) replaced them with pickup locations — `OrgSummary` is now `{ id, name, code }`, and `Product.shippingFromPincode` on the wire is the indicative origin (largest active holding), with allocation deciding the real one at checkout.

The three shipping-origin fields — `shippingFromPincode`, `shippingFromCity`, `shippingFromLocation` — are an all-or-none group: either all three are present or all three are absent. Enforced in `productFormSchema`, so both the form and the route apply it. Absent is spelled `NULL`, never `''`; readers treat absence as "fall back to the org's default address". That fallback is evaluated on four separate read paths, and one of them mixes a product's pincode with its org's city; [stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) replaces all three fields with a foreign key and removes the fallback.

---

## Adding a DTO to this file
Record a shape when it crosses the boundary and either more than one route uses it, or getting it wrong would fail silently. A one-off response shape used by a single route does not need an entry — its Zod schema is its documentation.
