# Contracts — checkout

- **Verified:** 2026-11-25
- **Covers:** `server/checkout/*.types.ts`

The checkout shapes that cross the browser/server boundary. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## Orders
`Shipment` is declared in three places across `src/domain/order.ts` and `server/checkout/order.types.ts`. Timestamp fields (`estimatedDelivery`, `createdAt`, `updatedAt`) are typed `Date` on the client side and `string` on the server side; JSON delivers strings, so Rule 3 is not currently met.

Order creation (`create-with-shipments`) accepts **unpriced lines** — `{ productId, quantity, size?, color?, fromLinkId? }` (`fromLinkId`: the checkout link that added the line, attribution only) — plus a `displayedGrandTotal` used only for the changed-mid-session comparison and never persisted (PR-38). The optional variant (PR-43) is validated against the product's declared options server-side; on every outbound items array, `price` is the unit price actually paid and lines are rebuilt from `OrderItem`/`ShipmentItem` rows — the JSON blob is legacy. `paymentStatus` crosses the wire in **no direction** since PR-39: the update route is deleted, and the paid/failed transitions in `order.repository.ts` are the only writers (ADR-0005).

Order creation answers **409** for a sold-out item since PR-104, where it previously answered 400 for every failure — a client could not tell an unavailable item from a malformed payload. Failures now travel in the one envelope (`toErrorResponse`, ADR-0013). Order **codes** returned in `code` are `BB-` plus eight characters since PR-104 ([ADR-0025](../adr/0025-order-codes-are-random-not-sequential.md)); the older `BB-1042` shape remains valid for ever, and `POST /api/orders/lookup` accepts both.
