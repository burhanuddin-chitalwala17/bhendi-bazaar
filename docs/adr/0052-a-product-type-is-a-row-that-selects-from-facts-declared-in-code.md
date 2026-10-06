# ADR-0052: A product type is a row that selects from facts declared in code

- **Date:** 2026-10-05
- **Status:** Accepted

## Context

Once facts existed ([ADR-0051](0051-a-products-facts-are-one-json-column-each-entry-carrying-its-origin.md)), something had to say which facts a given product is asked. Amazon calls that a `product_type`; Flipkart a vertical; Shopify a category with metafields. Each platform draws the line between "declared in code" and "held as data" somewhere different, and the line decides who can change what without a deploy.

The [product-types](../specs/listing-vocabulary/product-types/) and [categories](../specs/listing-vocabulary/categories/) TRDs drew ours (D1, D3, D5, D11) and it shipped on 2026-10-03 (`ProductType`, `ListingValue`, `server/catalog/product-type.ts`, `product-type.repository.ts`). The owner's call that a type belongs to the platform, never to a seller, is the kind of decision the first seller who wants "my own type" will ask to reverse.

## Decision

1. **A product type is a row** (`ProductType`, keyed by the string products already store), created and retired by a platform admin through the console. It is a question set, not a browse node: `Category` is what a buyer browses, and a category names the type its products use.
2. **The facts are declared in code; the permitted answers are data.** `FACT_DECLARATIONS` in `listing-facts.ts` says what a fact *is* — its key, kind, unit, whether it drives the variant axis. A type's row stores the fact keys it asks. `ListingValue` rows hold the permitted answers, keyed by list; **keys are stored, labels are shown**.
3. **A value list is global, with per-type availability.** One `colour` list serves every type; a type says which lists it draws from. There is no list per category and no list per seller.
4. **A type belongs to the platform.** A seller picks a type by picking a category; they do not define one. Owner's decision, 2026-10-03.
5. **The type is copied onto the product row at write.** `Product.productType` is denormalised from the category so a row is interpretable without the tree, and a category's type change does not silently re-ask every product.
6. **Derived facts are never stored.** The size label is computed from measurements by a pure function (`size-label.ts`); the rating from reviews ([product-reviews](../specs/product-reviews/) R6a); a bidding phase from the clock ([ADR-0023](0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)). A stored copy of a derivation is a column with no writer.

## Alternatives considered

- **Everything as data**: facts, kinds and units as rows too (Magento's attribute sets). The flexible answer, and the one that lets an admin invent a fact without a deploy. Rejected: a fact's *kind* drives validation, the form control, the variant axis and the channel mapping — code that must know the fact exists. Data that code must be rewritten to use is not more flexible than code.
- **Everything in code**: types as an enum. The first version. Rejected on 2026-10-03 when the ninth type arrived: the catalogue is the owner's to shape, and a new type was a release.
- **Per-seller types.** Rejected: channel mappings ([ADR-0045](0045-channel-mappings-are-versioned-data.md)) are per type; a seller-owned type would need its own mappings to every channel, which is the platform's work multiplied by the number of sellers.
- **A list per category.** Rejected: "maroon" means the same in abayas and in attar bottles; one list, many types is what makes a channel's value mapping a single row.

## Consequences

- ✅ A new type is an admin action; a new answer is a row; a new fact is a code change with a deploy — each at the level of risk it carries.
- ✅ Every product row says its type, so bulk import, readiness and the form all resolve the same questions from the row alone.
- ⚠️ Retiring a type that products use is refused with counts, never cascaded ([ADR-0020](0020-money-bearing-records-never-cascade.md) applied to a vocabulary).
- ⚠️ A seller who wants a type we do not have asks the platform. That is the trade: one vocabulary the channels can be mapped to, instead of a thousand that cannot.
