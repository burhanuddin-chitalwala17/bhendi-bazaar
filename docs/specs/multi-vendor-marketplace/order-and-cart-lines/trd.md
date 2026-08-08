# TRD — order and cart lines

- **Status:** Draft
- **Domain:** checkout, cart, catalog
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-10
- **References:** [spec.md](spec.md), [../data-model.md](../data-model.md), [ADR-0004](../../../adr/0004-money-as-integer-paise.md), [ADR-0007](../../../adr/0007-conditional-stock-decrement.md), [CONTRACTS.md](../../../CONTRACTS.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach
Three tables replace two JSON columns: `OrderItem` (the missing order→product relation,
`unitPrice` integer paise from birth), `ShipmentItem` (what one parcel packs, pointing at
an order line), `CartItem` (quantity + chosen size/colour). Wire shapes stay put — every
client-facing items array is rebuilt from rows joined to `Product`, so the storefront,
org portal, admin console and email templates do not change. The blobs survive one
release as `@map`ped `legacy*` columns read by nothing (the addresses-as-entities
precedent).

## Technical decisions
- **D1 — One `OrderItem` per priced line; `ShipmentItem` 1:1 with it at creation.** A split (R5 — 3 from the shop, 10 from the warehouse) becomes *expressible* without being exercised: nothing today splits a line, and stock-locations is the feature that will.
- **D2 — `unitPrice` is the only monetary snapshot**, computed by the same pure rule checkout charges (`effectiveUnitPrice`, `server/checkout/pricing.ts`). Names, slugs and thumbnails come from the product join — `onDelete: Restrict` guarantees the row exists (R2). Consequence, accepted: order history shows what was *paid* (`price := unitPrice` on the wire, no strike-through), and a later product rename shows the new name.
- **D3 — The lift disambiguates rupees from paise per order, against `Order.itemsTotal`.** money-as-paise multiplied the total columns ×100 but left the JSON blobs alone, so old blobs hold rupee floats and post-PR-38 blobs hold paise. Wall-clock cutoffs are unknowable in SQL; what is self-consistent is arithmetic: if an order's JSON lines sum ×100 to its (already-paise) `itemsTotal`, the blob is rupees — multiply; otherwise it is taken as paise.
- **D4 — A line whose product has been deleted cannot get a row** under `Restrict`. The lift skips it with a loud `RAISE NOTICE` count instead of silently dropping or blocking the migration; the legacy blob remains as the audit copy for one release.
- **D5 — The chosen size and colour survive to the order line.** The cart records them (R4) and checkout currently *drops* them — the wire sends `{productId, quantity}` and nothing else, so no order today says which size to pack. `shipmentItemSchema` gains optional `size`/`color`, validated server-side against the product's declared options in `priceGroupItems`. **[CONTRACT]** — `create-with-shipments` payload widens.
- **D6 — Cart merge becomes set logic on rows.** Same wire (`ServerCart.items` with product display fields, now from the join), same optimistic `version` guard on the `Cart` row (the where clause is still the check). `CartItem.productId` is `Cascade` — a cart line is not history; `syncCart`'s direct `prisma.cart` access moves behind the repository while it is being rewritten anyway (Invariant 5 on contact).
- **D7 — No uniqueness constraint on `(cartId, productId, size, color)`**: Postgres treats NULLs as distinct there, so the constraint would not hold for the very rows it matters for. The merge dedupes in code, as it does today.

## Packages
None.

## Data model
**[MIGRATION]** ×2 — `OrderItem` + `ShipmentItem` with the JSON lift (PR 1); `CartItem`
with its lift (PR 2). `Shipment.items` / `Cart.items` become nullable `legacyItems`
(`@map`). Referential actions per [../data-model.md](../data-model.md): `OrderItem.productId`
`Restrict`; `ShipmentItem` cascades with its shipment; `CartItem` cascades both ways.

## API / contract changes
`create-with-shipments` items gain optional `size`/`color` (D5) — **[CONTRACT]**.
Everything outbound is shape-identical, rebuilt from rows.

## Test plan
- Pure: line assembly (order items ↔ shipment items correspondence), variant validation branches in `priceGroupItems`, merge set-logic.
- Pins: both migrations' coalescing/disambiguation expressions (`itemsTotal` comparison, `RAISE NOTICE`, `Restrict` clauses), per TESTING.md's migration-pin pattern.
- Schema: `size`/`color` optional and trimmed; absent stays absent on the wire.

## Delivery (PRs)
1. **PR-43 — order lines**: `OrderItem`/`ShipmentItem`, creation transaction writes rows, all order reads (buyer, org, admin, email, `expireAndRestock`) rebuilt from rows, variant carried through checkout. Behaviour change: variants recorded; restock reads rows.
2. **PR-44 — cart lines**: `CartItem`, repository/service rewrite, merge on rows. Behaviour change: none visible.

## Open questions
None — shapes and actions were decided in [../data-model.md](../data-model.md) (2026-08-08).
