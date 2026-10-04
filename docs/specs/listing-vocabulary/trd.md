# TRD — listing vocabulary

- **Summary:** The product holds everything it says about itself; categories declare the questions, families carry what siblings share, and the fill step runs on save
- **Status:** 📝 Draft
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-02
- **References:** [spec.md](spec.md), [categories](categories/), [variants](variants/), [inherited-facts](inherited-facts/), [ADR-0047](../../adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md), [ADR-0046](../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md), [ADR-0003](../../adr/0003-one-repository-per-aggregate.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> This is the overview; each subfeature's TRD holds its own decisions.

## Approach

The product is the source of truth: everything it says about itself is stored on it, and reading
one is reading one row. The family, the brand and the shop's defaults are consulted when a product
is written, never when it is read.

The field set is derived from thirty-four platform templates rather than from the current model,
because the current model was written without market knowledge and would otherwise be the thing
the new model was shaped to fit ([ADR-0046](../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md)).

## Prior art

Held here because all three subfeatures rest on it.

**Where a product's variable facts live.** The established shape is queried facts as columns with
the category-specific tail in one indexed JSON column. One row per attribute is
entity-attribute-value, which PostgreSQL's community advises against by name: a JSON column
measures at a third of the storage and a large multiple of the read speed. **We follow the
established shape.**

**Category-specific field sets.** Every major marketplace does this — Amazon's 390 field
definitions resolve to 18 required plus 187 conditional on the product type; Flipkart publishes a
separate template per vertical. **We follow it**, and note that the per-category tail the
templates agree on is one to six fields, so a category declaring its own questions is cheap
rather than a combinatorial problem.

**Inheriting a fact from a brand.** Akeneo and Pimcore both do parent-to-variant inheritance with
per-value override, so the model is standard. **We depart on when it resolves** — see
[inherited-facts](inherited-facts/trd.md).

**What the platforms ask for**, read off thirty-four of their own bulk-upload templates and
recorded in [INTEGRATIONS.md](../../INTEGRATIONS.md). A field name agreeing is not its values
agreeing, and this holds inside a single platform: Flipkart's own colour list differs per node,
sixteen values common to all eleven that have one and nineteen more in only some. **We follow the
consequence**: the vocabulary holds meaning, each adapter maps it, and no field assumes a shared
value list ([ADR-0045](../../adr/0045-channel-mappings-are-versioned-data.md)).

## Technical decisions

Cross-cutting only. Decisions belonging to one part live in that part's TRD.

- **D1 — Three tiers, and the tiering is what keeps the form short.** Every fact below is
  *stored* on every product; where it is *typed* is a separate matter, settled by the fill step in
  [inherited-facts](inherited-facts/). The spine is on every product: the shop's code, name, description, images, maximum retail price, selling price, stock,
  brand, tax code, HSN, country of origin, maker, packer, importer, net weight. Seven of those
  come from the shop's own profile and are never typed per product. Six more are common to most
  categories — colour, pattern, material, measurements, pack quantity, audience — and the genuine
  per-category tail is two to eight.
- **D2 — The spine and the common facts earn columns; the product type's tail is one indexed JSON
  column.** What is filtered, sorted or searched on is a column. Sleeve and stitch for an abaya,
  capacity and shelf life for an attar earn none, because an abaya and an attar share almost none
  of them and columns for both leave each half empty.
- **D3 — A stored value carries which level supplied it, in the same entry.** Origin therefore
  costs no second column and no flag per fact, and it is what makes the brand-level correction in
  [inherited-facts](inherited-facts/) answerable.
- **D4 — Nothing is resolved on read.** A product read is one row, so there is nothing to batch
  and nothing to cache, and what gets published is reproducible from that row alone.

## Packages

None.

## UI approach

One screen changes, mobile-first ([ADR-0015](../../adr/0015-mobile-first-design.md)). The product
form leads with category and kind, because those decide every question after them; then the
family's shared facts once; then a short row per member carrying only code, price and stock. On a
phone that is a stacked list rather than four full forms, which is spec A5. Desktop adds columns
to the member rows and nothing else. Each subfeature's TRD describes its own part.

## Data model

[MIGRATION], detailed per subfeature. New `ProductFamily` and new tables for the permitted
answers; `Product` gains category, kind, nullable `familyId` and `brandId`, columns for the spine
and the common facts, and one indexed JSON column for the category tail.

## API / contract changes

[CONTRACT]. Product DTOs gain category, kind, the stored facts with their origin, measurements,
and the notion of a family; `docs/CONTRACTS.md` moves in the same PR.

## Test plan

Per subfeature. Two things are tested here because they span all three: that every category's
declaration names only facts that exist and only permitted values that resolve, which is what
stops a declaration drifting from the form it renders; and that a product read performs no
query against a family, a brand or the defaults, which is D4 stated as a test rather than a hope.

## Delivery (PRs)

Order is forced by dependency: declarations first, because the other two need something to read.

1. [categories](categories/) — the nine categories, their kinds, their facts and permitted
   answers, and label derivation. Pure; no schema change.
2. [variants](variants/) — `ProductFamily`, the new columns, the migration. First behaviour
   change: a family becomes several sellable products.
3. [inherited-facts](inherited-facts/) — the fill step wired into the write paths, origin stored
   and shown, the brand-level correction with its preview.
4. `sizes` and `colors` removed, once nothing reads them.

## Open questions

None.

**Closed since drafting**, recorded so none is reopened:

- How rich the colour list should be: the union, already shipped. Only the colours a shop uses
  ever need mapping, and they are mapped lazily when one first blocks a publish
  ([categories](categories/trd.md)).
- Whether a member needs its own description. It does, and it gets one without being typed: the
  family holds it as the answer to fill from and each member stores its own copy, overridable
  ([variants](variants/trd.md) D10).
- Whether the fill step needs cycle protection. It does not — the levels are a fixed list of
  three, so there is no recursion to guard.
