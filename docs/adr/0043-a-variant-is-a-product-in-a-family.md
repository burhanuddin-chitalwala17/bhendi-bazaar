# ADR-0043: A variant is a product in a family

- **Date:** 2026-09-29
- **Status:** Accepted

## Context

A product today holds `sizes String[]` and `colors String[]`, and that is the whole of its
variation. `ProductStock` is keyed `@@id([productId, orgAddressId])`, with no size or colour
dimension. `CartItem.size` and `OrderItem.size` record what the buyer chose on the line, and
`BiddingEvent` says so outright in a comment: the fields are descriptive, because there is no
variant-level inventory to point at. Validation is membership only — the chosen size must appear
in the array. So one product is one price, one SKU and one stock number, whatever sizes it lists.

Every marketplace models this differently. A size is its own listing with its own identifier,
its own stock and often its own price. There is no mapping from "one product with five sizes" to
that, because the destination needs five stock numbers and we hold one.

The owner has confirmed the current model was built without market knowledge and carries no rich
data worth preserving, so this is a free choice rather than a migration constraint.

## Decision

1. **A variant is a product row.** It has its own SKU, its own price, its own stock and its own
   media, exactly as any product does, and every existing path — cart, order, stock, pricing,
   bidding — continues to key on it without change.
2. **A family groups variants and carries what they share.** Name, description, brand, category,
   material, care, tax code: the facts that are true of the garment rather than of the size.
3. **A variant carries only what differs**, plus overrides. Two axes to begin with, size and
   colour, declared as a closed set per family rather than free text.
4. **A family is not sellable.** It has no price and no stock, holds no orders and appears in no
   cart. It exists to be inherited from and to be published as a parent listing where a channel
   wants one.
5. **A product without variation is a family of one, implicitly.** A shop selling a single
   unsized thing never meets the concept, and nothing in the buying path changes for it.
6. **The resolver reads through the family**, which is the second step of the chain in
   [ADR-0044](0044-a-marketplace-orders-money-is-reported-not-computed.md)'s sibling work:
   product, then family, then brand, then the org's defaults.

## Alternatives considered

- **Keep `sizes String[]` and publish one listing per product.** The cheapest answer and the one
  that requires no migration. Rejected because it cannot express the thing being sold: stock
  cannot differ by size, so a shop with two mediums and nine smalls must either oversell the
  medium or under-list the small, and no marketplace will accept a single listing standing for
  five variants. It also makes the first real oversell a modelling failure rather than a race.
- **A `ProductVariant` table under the product**, which is what most catalogues do and what a
  textbook would say. Genuinely more correct as a model: it keeps one product identity and
  attaches the sellable units beneath it. Rejected on blast radius — `ProductStock`, `CartItem`,
  `OrderItem`, `pricing.ts`, the bidding lock and every query that joins them key on
  `productId`, and re-pointing all of them at a variant id is a rewrite of the buying path to
  gain a shape the family arrangement already expresses. The cost is real: a family's children
  are products, so a listing page must group them rather than being handed a product with
  variants.
- **A variant axis held as JSON on the product.** Rejected for the same reason
  [ADR-0042](0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md)
  rejects a bag: stock and price must be queryable and conditionally writable, and
  [Invariant 6](../../CLAUDE.md) is not enforceable against a value inside a JSON column.
- **Defer variants until a channel needs them.** Rejected because every marketplace channel needs
  them, so deferring means building the vocabulary twice.

## Consequences

- ✅ The marketplaces' model and ours agree, so publishing is a mapping rather than a fiction.
- ✅ Stock, cart, orders, pricing and bidding are untouched, and
  [Invariant 6](../../CLAUDE.md)'s conditional write already guards a variant correctly because
  a variant is a product.
- ✅ `copy-product` already exists, so making the second size of a garment is a feature that
  shipped months ago.
- ⚠️ A buyer-facing product page must now assemble a family from sibling rows rather than reading
  one product, and a listing grid must show a family once rather than five times. That is real
  work in the storefront, and it is the price of this choice.
- ⚠️ Product counts change meaning. A shop with twenty garments in five sizes has a hundred
  products, and every screen that says "products" has to decide which number it means.
