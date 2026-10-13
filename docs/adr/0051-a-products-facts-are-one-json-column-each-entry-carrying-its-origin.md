# ADR-0051: A product's facts are one JSON column, each entry carrying its origin

- **Date:** 2026-10-05
- **Status:** Accepted

## Context

The listing programme ([listing-vocabulary](../specs/listing-vocabulary/) and its four subfeatures) replaced two free-text columns with a vocabulary: a product answers a set of *facts* (colour, material, pattern, occasion…) chosen from permitted answers, plus measurements in the unit its type fixes. Which facts a product is asked depends on its product type, so the set is open-ended and differs per row.

The persistence shape was decided in the TRD (D1–D4) and in `categories` D6a/D7, and shipped on 2026-10-03/04 (`prisma/schema.prisma` `Product.facts`, `Product.measurements`, `ProductFamily.facts`; `server/catalog/listing-facts.ts`, `fill-facts.ts`, `fact-correction.service.ts`). It is the model the whole programme stands on, and it was recorded only in spec prose. [ADR-0046](0046-a-new-model-is-checked-against-the-field-before-the-codebase.md) used this exact question — EAV versus columns versus JSON — as its worked example of checking the field first; the answer deserves its own record so the next person who meets a JSON column on a hot table does not "normalise" it in good faith.

## Decision

1. **The spine and the discriminators earn columns; every other answer lives in one JSON column.** `productType`, `familyId`, `brandId`, `categoryId`, price and stock are columns because they are filtered, joined or counted. `facts` and `measurements` are `Json` because they are read whole, per row, and never queried individually.
2. **Each stored entry is `{ value, origin }`.** The origin names the level that supplied the answer — product, family, brand, or the shop's listing defaults (`ORIGIN` in `listing-facts.ts`). Origin lives *in the entry*, not in a parallel column, so a value and its provenance cannot drift apart.
3. **Facts are parsed, never cast.** Every read goes through `storedFactsSchema` (`listing-facts.ts`). A `Json` column is untrusted input to the code that reads it, for the same reason a request body is (Invariant 4).
4. **Blanks are filled on save, never on read.** `fill-facts.ts` asks the levels in order — product, family, brand, shop defaults — and the first answer wins, remembering which level gave it. A product read is one row, and what is published must be reproducible from that row alone.
5. **A correction at a level is a preview and an update over one predicate.** `fact-correction.service.ts` counts and then rewrites the products whose entry still carries that level's origin; a product somebody has since answered by hand is left alone. The two queries share the `where`, so the preview and the result cannot disagree.
6. **A family carries facts, measurements and its type; brand and category stay on the product.** This refines [ADR-0043](0043-a-variant-is-a-product-in-a-family.md) D2/D3: the family's variant axis is declared on the product type and copied onto the family, not declared per family.

## Alternatives considered

- **An entity–attribute–value table** (`ProductAttribute(productId, key, value, origin)`). The conventional relational answer, and the one a database-minded reviewer reaches for first. Rejected: every product read becomes a join and a pivot; filtering by a fact is rare and already served by the discriminator columns; and ADR-0046's own survey found EAV to be the named anti-pattern here, for exactly the reasons Magento's history shows.
- **A column per fact.** Clear types and indexes. Rejected: the fact set is per product type and grows with every channel audit; a migration per adjective is a migration per week, and most columns would be null on most rows.
- **Resolve inheritance on read.** Store only what the shop typed; compute the family/brand fallbacks when the product is read. Rejected: a listing is read far more often than written, the publish payload must be reproducible from one row, and resolve-on-read loses the provenance the brand-level correction depends on.
- **A separate `Fact` document store.** Nothing in the problem needs a second store; it would be a dependency with one table in it ([ADR-0037](0037-the-host-is-a-deployment-fact-not-an-architectural-input.md)).

## Consequences

- ✅ Adding a fact is a line in `FACT_DECLARATIONS` and, if it needs answers, rows in `ListingValue` ([ADR-0052](0052-a-product-type-is-a-row-that-selects-from-facts-declared-in-code.md)); no migration.
- ✅ "Where did this answer come from" is always answerable, which is what makes "fix the brand, and every product that inherited from it" a safe one-click action.
- ⚠️ A fact cannot be filtered in SQL. If a buyer-facing filter on a fact is ever needed, that fact is promoted to a column by a deliberate migration — the discriminator rule, applied again.
- ⚠️ The JSON shape is a contract enforced by a Zod schema, not by the database. A write that bypasses `storedFactsSchema` can store anything; the one-writer rule ([ADR-0055](0055-an-admin-surface-reads-through-projections-and-writes-through-the-aggregates-one-repository.md)) is what keeps the writers few.
