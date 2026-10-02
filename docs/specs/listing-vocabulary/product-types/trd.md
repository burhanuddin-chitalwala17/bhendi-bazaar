# TRD — listing vocabulary / product types

- **Summary:** A `ProductType` row keyed by the string products already store, referenced by a foreign key, with the fact vocabulary staying in code
- **Status:** 📝 Draft
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-03
- **References:** [spec.md](spec.md), [parent trd](../trd.md), [categories](../categories/), [ADR-0046](../../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md), [ADR-0013](../../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0032](../../../adr/0032-records-people-authored-are-retired-not-deleted.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

The nine declarations in `server/catalog/product-type.ts` become nine rows. Nothing about their
shape changes: a type still names the facts it asks, its measurements and units, its variant axis
and its kinds. Only the home changes, from a TypeScript object to a table an admin can write to.

The split is between the **vocabulary** and the **selection**. A fact carries a way of being
answered and a validation rule, so it is code. A type is a list of fact keys, so it is data.

## Prior art

**Both reference implementations put this in the hands of an administrator, not a developer.**

[Akeneo](https://help.akeneo.com/v7-build-your-catalog/v7-manage-your-attributes), the dominant
open PIM, creates attributes *and* families through the UI at runtime with no deployment. What
stays fixed is the set of attribute **types** — text, number, measurement, simple select, yes/no,
date, image — which is precisely the vocabulary/selection split above.

[Shopify](https://shopify.dev/docs/apps/build/metafields/definitions) ships a standard taxonomy
where each category arrives with predefined attributes — colour, size, material, pattern, care —
and lets a merchant add their own definitions through the admin with no code. Again only the
**data types** are fixed.

**We follow both.** We ship the nine as seeded rows, which is Shopify's "standard taxonomy comes
filled in", and allow an admin to add more, which is Akeneo's families.

**Where we depart, deliberately:** neither lets a merchant invent a new *answer kind*, and
neither will we. A genuinely new kind of question needs a UI control and a validation rule, which
is engineering.

## Technical decisions

- **D1 — `ProductType` is a table keyed by the string products already store.** `key` is UNIQUE
  and holds `islamic-wear` and the rest. Nothing about the values in `Product.productType` or
  `Category.productType` changes.
- **D2 — Both columns gain a foreign key against `ProductType(key)`, not against its id.**
  Postgres permits a foreign key against any unique column, so the existing rows keep the exact
  strings they hold and simply gain integrity — no backfill, no id rewrite, no data migration of
  anything already stored. This is what makes spec A4 true by construction rather than by a check
  somebody has to remember, and it answers the typo hazard. Null stays legal: a foreign key never
  constrains a null, which is what the untyped categories need.
- **D3 — A type is a selection of fact keys; the facts stay in code.** The row stores the keys
  from `server/catalog/listing-facts.ts`, its measurements with their units, its variant axis and
  its kinds. A key naming no declared fact is refused on write, because the alternative is a form
  field with no meaning.
- **D4 — Editing a type never touches a product.** Stored answers are already on the product
  ([inherited-facts](../inherited-facts/) D2), so removing a fact from a type stops it being
  *asked* and leaves every answer where it is. That is spec R3 falling out of the existing
  design rather than needing machinery.
- **D5 — The form costs two queries, both indexed, and no cache.** The product form is a server
  component, so the type and its facts load in the render that already reads the category — one
  more join, not a new round trip, and nothing per keystroke. Value lists are fetched for the
  lists that type actually uses (`WHERE list IN (…)`), never all twenty-two. The alternative, a
  cache, is something this project deliberately does not have, and two indexed reads do not earn
  one.
- **D6 — The zod schema becomes a factory.** `categorySchema(availableTypes)` returns the object;
  the form builds it from the options it was handed and the route from the database. Same
  function, same rules, both sides — so what a shop is shown inline stays what the server
  enforces ([ADR-0013](../../../adr/0013-one-error-envelope-and-useserverform.md)), which a
  runtime-known enum would otherwise cost.
- **D7 — The creation screen shows what each choice will demand.** Choosing facts is a design
  decision, so the screen names which marketplace requires each one and which are commonly
  expected for similar goods. It refuses nothing — spec R7 — because a type we think is wrong may
  be a line we have not met.
- **D8 — A type is retired, never deleted** ([ADR-0032](../../../adr/0032-records-people-authored-are-retired-not-deleted.md)),
  and the foreign key refuses deletion while any product or category names it. Retirement hides
  it from the pickers and changes nothing already stored.
- **D9 — The size scale moves onto the type.** A type declares which measurements its label reads
  from, and optionally a scale of value-to-label pairs. Nearest-match is one generic function, so
  a ring's diameter table becomes data and a type is fully configurable rather than half.
- **D10 — The nine ship as a data migration, not a seed.** Reference data production cannot run
  without, which is Invariant 7's test; `vercel.json` applies migrations on every deploy and the
  seed reaches no environment but a local one.
- **D11 — A type belongs to the platform, never to a seller.** Decided by the owner on
  2026-10-03: an admin defines types, exactly as an admin defines categories. There is no
  `orgId` on the row and no per-seller variant, which is Shopify's shape — a seller inventing its
  own would fragment the mappings every channel adapter depends on, and two sellers' idea of the
  same product line would diverge the day after they both listed one. The permitted *answers*
  stay org-scopeable (`ListingValue.orgId`), because a shop knowing a colour the platform does
  not is harmless where a shop knowing a different question set is not.
- **D12 — `server/catalog/product-type.ts` keeps the reading and resolving, loses the data.**
  `resolveProductType` walks the category tree on rows rather than constants and is otherwise
  unchanged; `declarationFor` is replaced by a repository read. The tree walk stays pure so the
  page and the service resolve identically, as `resolveShotList` does.

## Packages

None.

## UI approach

A new admin screen under the existing categories area, mobile-first
([ADR-0015](../../../adr/0015-mobile-first-design.md)): a list of types with how many categories
and products use each, and a form that is a long single column of grouped checkboxes — the facts,
then measurements with their units, then the variant axis, then the kinds. On a phone that is one
section at a time rather than a grid. Each fact shows which marketplaces require it (D7).

The category form's existing product-type select reads its options from the table instead of the
constant; nothing else about it changes.

## Data model

[MIGRATION]. New `ProductType`: `key` unique, label, the fact keys, the measurements with units,
the variant axis, the kinds, the optional label scale, `retiredAt`. Foreign keys from
`Product.productType` and `Category.productType` against `ProductType(key)`, added after the rows
exist and safe to add while every value is null.

## API / contract changes

[CONTRACT]. The category DTO's `productType` stops being a closed enum and becomes a key
validated against the table; `docs/CONTRACTS.md` moves in the same PR.

## Test plan

The foreign key is a guard test against a real database: a product naming an unknown type is
refused, and deleting a type in use is refused — both mutation-tested by dropping the constraint.
A type whose fact keys name nothing declared is refused on write. Editing a type and asserting no
product row changed is the test for spec A2. The query budget is asserted the way
`tests/integration/db-ops-budget.test.ts` already asserts others, so spec A5 cannot regress
unnoticed. Label derivation keeps its existing table, now fed from a row rather than a constant.

## Delivery (PRs)

1. The table, the data migration carrying the nine across, and the foreign keys. No behaviour
   change: the code still reads the constants.
2. The repository and the resolver reading rows; the constants deleted.
3. The schema factory, and the category form reading its options from the table.
4. The admin screen for creating and editing a type.
5. `rida` added as a kind and `combo` given its masalla-bag kind — through the new path, as data.

## Open questions

None. The one this draft carried — whether a type belongs to the platform or to a seller — was
closed by the owner on 2026-10-03 and is recorded as D11.
