# ADR-0070: A product's attributes are rows, mapped at runtime to each channel's own catalogue

- **Date:** 2026-11-07
- **Status:** Accepted (2026-11-08, listing-model release). Supersedes ADR-0051; ADR-0052 still governs the code fact list until it moves to rows

## Context

[ADR-0052](0052-a-product-type-is-a-row-that-selects-from-facts-declared-in-code.md) declared the
questions a product answers as a list in code and stored the answers as one JSON column per product
([ADR-0051](0051-a-products-facts-are-one-json-column-each-entry-carrying-its-origin.md)). Channel
requirements were rows we typed by hand. On 2026-11-06 Amazon refused a Tote bag for 13 fields: half
stored and never sent, some sent to the wrong field, a few with no question at all; brand and shop
defaults filled nothing; readiness could not see any of it. Each new channel multiplies that.

## Decision

1. **Attributes are rows, added only by migration** ([listing-model](../specs/listing-model/) Q5). An
   attribute has a key, a kind (choice, text, number, measure, boolean, reference) declared in code,
   a unit family for measures, and an option list for choices. The admin panel selects, groups and
   maps attributes; it never creates one. A test holds code and table in agreement.
2. **A product's values are typed rows, one per attribute** (Q6): a column per kind, real foreign keys
   to the attribute and the chosen option, each row carrying its source (product, family, brand, shop
   default). Rows are the truth.
3. **A projection on the product** (one JSON column) is rebuilt in the same transaction as any write to
   its values. Every read path (storefront, form, payload builder) reads it; no request joins value rows.
4. **BB types and channel types are separate models** (Q2). A BB type selects attributes; a channel type
   holds the channel's own fields with required level, value kind, allowed values, units and the
   channel's JSON Schema, loaded from the channel (Amazon's definitions API; Flipkart and Meesho
   templates) and versioned, never typed by hand (Q11).
5. **One field map per channel field** says where its value comes from: an attribute, a derivation rule,
   a core product field, the shop's settings, or a constant, with value and unit conversion. A field
   the channel adapter always fills is marked so and never asked.
6. **A channel listing is built, not stored** (Q7): a pure function of product, maps and catalogue
   returns the payload and its gaps. The listing row keeps only overrides, what was sent and the answer.
7. **Completeness is stored per product per channel** and refreshed by a job when its inputs change,
   never computed on a page view.
8. **Every schema move is expand, migrate, contract**, each step reversible, with counts verified before
   the old path is removed.

## Alternatives considered

- **Keep facts in code, JSON per product (ADR-0051/0052).** Cheapest; but a channel field cannot point at
  a fact by foreign key, values cannot be indexed per attribute, and the owner's model (one source of
  truth, no duplication) cannot be expressed.
- **Pure EAV, rows only, read by join.** The textbook answer and Magento's; reading one product joins
  dozens of rows and every filter is a self-join. Rejected for reads; kept as the write truth.
- **JSON only, attributes as rows (Akeneo's current shape).** Fast reads, but no foreign key from a value
  to its option, and integrity rests on application code. Rejected as the truth; kept as the projection.
- **A stored copy per channel listing (Salsify-style destinations).** Simple to send; drifts the moment
  the product changes and doubles every write. Rejected; overrides only.
- **Admin-created attributes.** Owner's call (Q5): a new attribute needs validation, a form control and
  mappings, which is a developer's change.

## Consequences

- ✅ A channel's requirement, a product's answer and the map between them are each one row; nothing is
  guessed, dropped or duplicated, and readiness sees all three.
- ✅ A new channel is catalogue rows, maps and a provider; a new attribute is one migration.
- ✅ Reads stay one row; filters use an index on (attribute, option).
- ⚠️ Two representations of a product's values must agree; the projection is rebuilt in the writing
  transaction, and a test compares them.
- ⚠️ The migration from ADR-0051/0052 is large; it runs expand → backfill → switch → contract over the
  listing-model subfeatures, and the old paths go only in the last.
- ⚠️ Supersedes [ADR-0051](0051-a-products-facts-are-one-json-column-each-entry-carrying-its-origin.md) and
  [ADR-0052](0052-a-product-type-is-a-row-that-selects-from-facts-declared-in-code.md) once accepted.
