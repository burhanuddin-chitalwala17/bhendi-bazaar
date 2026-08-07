# TRD — warehouses and stock allocation

- **Status:** Draft
- **Domain:** catalog, shipping, checkout
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-08
- **References:** [spec.md](spec.md), [data-model.md](../data-model.md), [consumer-inventory.md](../consumer-inventory.md), [ADR-0002](../../../adr/0002-server-holds-pricing-authority.md), [ADR-0003](../../../adr/0003-one-repository-per-aggregate.md), [ADR-0007](../../../adr/0007-conditional-stock-decrement.md), [CONTRACTS.md](../../../CONTRACTS.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
One home for an origin, one home for a quantity. An `ORG_ADDRESS` row is the origin; a `PRODUCT_STOCK` join row carries the quantity. That deletes both parallel origin representations and the four read-time fallbacks that currently reconcile them, listed in [consumer-inventory.md](../consumer-inventory.md) §2.

The shape is not imposed on the code so much as recognised in it. `groupItemsByOrigin` already builds a composite key from seller plus origin pincode (`src/utils/shipping.ts:85`), and `Shipment` already carries one origin and its own rate, cost and tracking. A shipment is therefore already "the parcel from one location" — allocation just names the location instead of inferring it. Splitting an order across warehouses needs no new container.

The same file also shows why inference fails: a group takes its pincode from the product but its city and state from the seller (`src/utils/shipping.ts:94-96`), so an overridden origin produces one location's pincode beside another's city. That pair is what a courier receives. Reading a whole origin from one row makes the mismatch unexpressible rather than fixed.

## Technical decisions
- **D1 — Pickup locations belong to a selling organisation, one-to-many**, and `Seller.default{Pincode,City,State,Address}` is dropped. The shop becomes an ordinary location row rather than a set of columns on its owner; keeping both would leave one fact with two homes, which is the reasoning behind Invariant 5.
- **D2 — Product-to-location is many-to-many, with `stock` on the join row.** A join without a quantity is a list of places a product *might* ship from, which the store cannot honour and must not quote from. Stock and location are one question.
- **D3 — `Product.stock` is dropped and the total derived by aggregation.** No cached column until there is a measured problem: a maintained copy is a second authority, and the only demanding reader is admin sort-by-stock (`server/catalog/admin.product.repository.ts:97`). The **outbound DTO keeps a `stock` total**, which is what confines the change — most of [consumer-inventory.md](../consumer-inventory.md) §3 is display code that never learns where the number came from.
- **D4 — There is no default location at all** (product decision, 2026-08-08, superseding an earlier write-time-default design). Whoever adds a product names the location and the quantity; an unnamed location fails validation. This removes the fallback more completely than a default flag would: today's `product.shippingFromPincode || seller.defaultPincode` is evaluated on four read paths and one has already diverged, and there is now no second place for an origin to come from.
- **D5 — `Shipment` keeps its `from*` snapshot and gains a nullable `orgAddressId`.** A shipment is a historical record: editing a warehouse's address must not rewrite where a delivered parcel came from. Same reasoning as recording price on the order rather than joining to `Product.price` ([ADR-0002](../../../adr/0002-server-holds-pricing-authority.md)). Pre-existing shipments keep `NULL` rather than a guessed attribution.
- **D6 — The allocation is persisted, never recomputed.** The warehouse a line was decremented from is written on the shipment in the same transaction. Recomputing a decision instead of recording it is the failure behind both the Razorpay `notes` key and the percent-encoded slug; here it would decrement one location and book pickup from another.
- **D7 — [inventory-reservation](../../inventory-reservation/) lands first, against `Product.stock`; this feature then re-points its guard at the join row.** The guard does not exist yet — `server/checkout/order.repository.ts:99-110` reads and compares, then `:133-143` decrements unguarded, exactly the race [ADR-0007](../../../adr/0007-conditional-stock-decrement.md) forbids. Overselling is a live risk today, so it must not queue behind a Phase 3 feature. The cost is editing the same block twice; the guard's *shape* is unchanged by the move, only its target row and the added `orgAddressId` predicate, and it will have tests by then.
- **D8 — Allocation prefers the fewest parcels, then the nearest origin to the buyer.** Splits are allowed (product decision, 2026-08-06). Forbidding them while displaying a summed quantity would oversell: a total of 13 that no single location can cover would fail at checkout after the page promised it.
- **D9 — `onDelete: Restrict` on the org link and on the join's location side**, satisfying R8 in the database rather than in a service check. `Product.categoryId` is the counter-example: it cascades, and only an application-level count stops a category delete from taking its products with it.
- **D10 — A pickup address is columns, not JSON.** Customer and order addresses are `Json` blobs, but a warehouse address is joined, indexed and queried — rate lookups key on origin pincode (`ShippingRateCache`). Reuse belongs at the validation layer: the Zod address rules are shared, the storage is not. A single address table with a polymorphic owner would trade referential integrity for the appearance of reuse.
- **D11 — Courier pickup registration is designed for, not built.** Aggregators require pickup locations pre-registered and referenced by their own identifier; `prisma/schema.prisma:347` already carries a commented-out `warehousePincode` anticipating this. Whether it is needed at all depends on the open decision in [shipping-fulfilment](../../shipping-fulfilment/), so the warehouse carries a nullable provider reference and nothing reads it yet.
- **D12 — Multi-parcel checkout is a relabel plus one addition, not new UI** (product decision, 2026-08-07). `MultiShippingSection.tsx` already renders one card per origin group with its own courier choices, cost, serviceability and `formatDeliveryEstimate(rate.estimatedDays)`, fed per group by `useMultiShippingRates`. Three things are missing. A group is currently *labelled* by its origin — "Ships from {fromCity}, {fromState}" — which works only because origin equals seller today; two warehouses in the same city would produce two identical headings, so parcels must be numbered and the city demoted to secondary detail. There is no order-level completion date, which is the figure a customer actually wants; it is the latest of the selected rates' estimates. And `formatDeliveryEstimate` returns a relative string ("3 days"), which is harder to reconcile across parcels than two dates — `getEstimatedDeliveryDate` already exists and is unused (`src/utils/shipping.ts:33-45`).
- **D13 — Availability is one total to the customer; the breakdown is admin-only** (product decision, 2026-08-07). `check-stock` and the product DTO return a sum and nothing else, which is what D3 already assumed — so this closes the question rather than changing the shape. The constraint is on responses, not just rendering: a per-location breakdown that reaches the browser has been disclosed whether or not it is displayed.
- **D14 — `Seller` becomes `Org`, with `USER`↔`ORG` many-to-many through `ORG_MEMBER`** (product decision, 2026-08-08). A vendor is an organisation with people in it, so a user can operate several orgs and an org can have several operators. **This is a rename across 566 references in 57 files** and it is the largest mechanical cost in the feature — it must be its own PR, ahead of the schema work, or it will be tangled with behaviour changes and unreviewable. `role` on the membership makes authorization expressible; deciding what each role may do is not part of this feature. Full shape in [data-model.md](../data-model.md).

## Packages
None.

## Data model
**[MIGRATION]** — two migrations, additive then destructive, so every step before the cutover is reversible.

| Migration | Change |
|---|---|
| Additive | `ORG_ADDRESS` (org FK, address FK, pickup nickname, contact name and phone, line1, line2, city, state, pincode, country, nullable provider ref); `PRODUCT_STOCK` (composite PK of product and location, `quantity`); `Shipment.orgAddressId` nullable |
| Backfill | one location per org from `Seller.default*`; one more per distinct `(sellerId, shippingFromPincode)` override; one join row per product at its resolved warehouse carrying its current `Product.stock` |
| Destructive | drop `Product.shippingFrom{Pincode,City,Location}`, `Product.stock`, `Seller.default{Pincode,City,State,Address}` and their indexes |

The backfill cannot be fully automatic. An overridden origin has only a pincode, a city and a label like `"Warehouse 3"` — no street line, no contact, no phone — so each backfilled warehouse needs those typed in before it is valid. At the current catalogue size that is a handful of rows, which is the argument for doing this now rather than later.

## API / contract changes
**[CONTRACT]** — `CartItem`, `ProductDetails`, `ProductFormInput`, `ShippingGroup` and both `Seller` shapes change. [CONTRACTS.md](../../../CONTRACTS.md) moves in the same PR.

Several of these are declared twice, and six files repeat the same inline seller prop type ([consumer-inventory.md](../consumer-inventory.md) §1). Consolidating them first is what makes the rest an edit in one place rather than a hunt, so it leads the delivery order.

## Test plan
Per [TESTING.md](../../../TESTING.md); allocation is pure logic and should be tested as such, not through a route.

- **Allocation** — the interesting cases as unit tests: one location covers it; no single location covers it but the total does; the total is short; equal candidates broken by distance; a location holding zero is not chosen.
- **The guard, under concurrency** — two overlapping orders for the last unit at one location produce one order and one refusal. Owned by [inventory-reservation](../../inventory-reservation/); this feature re-runs it against the join row.
- **Snapshot immutability** — editing a warehouse address leaves a shipped parcel's recorded origin unchanged (A5).
- **Restrict** — deleting a warehouse holding stock, or named by a shipment, fails at the database.
- **Aggregate** — the displayed total equals the sum across locations, including when a location holds zero.
- **Origin coherence** — a parcel's pincode, city and state all come from one warehouse. This is the regression test for the `src/utils/shipping.ts:94-96` mismatch.
- **Parcel presentation** — an allocation across two locations yields two labelled parcels and a completion date equal to the later estimate, and a single-location order still presents as one parcel with no parcel numbering.
- **No leak** — the serviceability, rate and product responses carry a stock total and no per-location figure (R11). Asserted on the response body, since rendering is not where disclosure happens.

## Delivery (PRs)
| PR | Scope | Behaviour |
|---|---|---|
| 0 | `Seller` → `Org` rename plus `ORG_MEMBER` (566 references, 57 files) | none — mechanical |
| 1 | Consolidate the duplicate DTO and prop-type declarations | none |
| 2 | [inventory-reservation](../../inventory-reservation/) guard on `Product.stock` | yes — closes the oversell race (separate spec, prerequisite) |
| 3 | Additive migration, location repository and admin CRUD, backfill script | none — nothing reads the new tables |
| 4 | Product form: location selector and per-location stock; writes join rows while `Product.stock` is still authoritative | none — dual write |
| 5 | Reads flip to the aggregate; allocation, split shipments, guard re-pointed to the join | **yes — the cutover** |
| 6 | Destructive migration | none |

PR 5 is the only one that changes what a customer sees, and it is reversible only by redeploying PR 4 — which is why the columns it stops reading are dropped a PR later rather than in the same one.

## Open questions
Must be closed before Draft → Accepted.

- Does location management live on an org detail page, or as its own admin section? The sellers table currently shows a city and pincode per seller (`SellersTable.tsx:65-67`) and needs something in their place.
- Is admin sort-by-stock acceptable on an aggregate, or does it force the cached total D3 rejects? Measure on real row counts before deciding.
- Does [shipping-fulfilment](../../shipping-fulfilment/) answer "book for real"? If yes, the pickup contact fields become required and D11 turns into work.

Closed: multi-parcel visibility and per-parcel estimates (D12) and customer-facing availability (D13), both decided 2026-08-07.
