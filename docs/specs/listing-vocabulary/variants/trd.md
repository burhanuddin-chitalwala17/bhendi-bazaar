# TRD — listing vocabulary / variants

- **Summary:** `ProductFamily` as its own aggregate carrying no money and no stock; the variant axis declared per category; a combo an ordinary product
- **Status:** 📝 Draft
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-02
- **References:** [spec.md](spec.md), [parent trd](../trd.md), [ADR-0043](../../../adr/0043-a-variant-is-a-product-in-a-family.md), [ADR-0003](../../../adr/0003-one-repository-per-aggregate.md), [ADR-0020](../../../adr/0020-money-bearing-records-never-cascade.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

A family is a row carrying what siblings share and nothing that can be sold. Each member is an
ordinary `Product` pointing at it, so every path that already sells a product — basket, stock,
order, price resolution — keeps working without being taught about families.

## Prior art

**Parent-with-variants is the universal catalogue shape**, and every platform in the set
implements it: Amazon's parent SKU, Flipkart's Group ID and Parent Variant FSN, Meesho's Group ID
and Variation. **We follow it.**

**What the axis is, however, is not universal, and that is the finding.** Flipkart declares its
variant axes per node and no two of its twelve agree — size for an abaya, capacity and colour for
a bag, plating and size and colour for a ring, set and quantity for incense. An axis fixed in
code would be wrong for most categories, so **the category declares it**
([ADR-0043](../../../adr/0043-a-variant-is-a-product-in-a-family.md)).

**Bundles.** The established shape for a set whose parts also sell is either its own stocked SKU
or a composed bundle that draws down its components. Both are standard; marketplaces model the
first, ERPs the second. **We take the first** and say why in D4.

## Technical decisions

- **D1 — The variant axis is declared per category**, as part of the category declaration in
  [categories](../categories/). It names which facts make two members different, and the form
  uses it to decide which fields sit on the member row rather than on the family.
- **D2 — `ProductFamily` is a new aggregate with its own repository** ([ADR-0003](../../../adr/0003-one-repository-per-aggregate.md)).
  `Product` gains a nullable `familyId`, nullable because a product without siblings is normal
  and because requiring one would refuse every row that exists (spec R6).
- **D3 — A family holds no price, no stock and no `ProductStock` relation.** Spec R3 is enforced
  by the columns not existing rather than by a check, which is the only way it cannot be
  forgotten. It is also not addressable as a product: no route resolves a family to a buyable
  thing, so spec A3 holds without a guard on each route.
- **D4 — A combo is an ordinary product in the combo category, with its own stock.** Its contents
  are recorded as text, which is what the platforms ask for — Meesho's `Gifting-Combo` asks
  `Sales Package Include` and `Number Of Contents`, not a reference to two other listings. It
  does not draw stock from the mat and the bag: that would make one sale a conditional decrement
  of two further rows under Invariant 6, with its own failure modes and its own spec. The owner
  confirmed the shop counts the three separately, so the model matches the shop.
- **D5 — Photographs stay on the member, not the family** (spec R4). The library deduplicates by
  content hash, so four identical shots across four colours cost one stored object — the family
  earns nothing by holding them.
- **D6 — "Products" becomes two counts, and every caller picks one.** A family count and a
  sellable count, named differently wherever they appear. The dashboard widget, the product list
  and the low-stock warning each state which they mean.
- **D7 — The migration reads `sizes` and `colors` and keeps everything, matched or not.** A value
  matching a permitted answer becomes a member; one matching nothing becomes a member with the
  value kept as flagged free text. Nothing is dropped, which is spec A4.
- **D8 — `sizes` and `colors` are removed in a later PR than the one that replaces them.**
  Dropping a column in the migration that replaces it leaves no way back if the mapping was
  wrong, and the mapping is over data nobody has audited.
- **D10 — The family holds the description as the answer to fill from; every member stores its
  own copy.** Not one or the other: the family is where it is typed once, and the fill step copies
  it onto each member on save with the family recorded as its origin. A member that needs its own
  wording overrides it, which makes that member the owner. The family is therefore never read to
  display or publish a product, which keeps the parent's D4 true, and nobody types the same
  paragraph four times. Correcting the family's description later offers to correct the members
  that took it from there; this decision is why
  [inherited-facts](../inherited-facts/) R5 covers the family and not only the brand.
- **D9 — A family is retired, never deleted** ([ADR-0032](../../../adr/0032-records-people-authored-are-retired-not-deleted.md)),
  and deleting one with members is refused rather than cascading — its members carry money and
  attribution ([ADR-0020](../../../adr/0020-money-bearing-records-never-cascade.md)).

## Packages

None.

## UI approach

The family's shared facts appear once, then one short row per member carrying only what the axis
says differs plus code, price and stock. On a phone that is a stacked list, not four full forms
(spec A2); desktop adds columns to the same rows. Adding a member is one action that copies the
family's facts rather than an empty form. Mobile-first per
[ADR-0015](../../../adr/0015-mobile-first-design.md).

## Data model

[MIGRATION]. New `ProductFamily`, holding the shared facts and no money or stock columns.
`Product` gains nullable `familyId`. `Product.sizes` and `Product.colors` are read by the
migration and removed in a later step (D8).

## API / contract changes

[CONTRACT]. Product DTOs gain the family and the member's axis values; list endpoints gain the
two counts of D6. `docs/CONTRACTS.md` moves in the same PR.

## Test plan

`ProductStock` keeping its key is a guard test, because spec A1 depends on it. A family having no
price or stock is asserted once so its absence reads as deliberate, and mutation-tested by adding
a stock column and watching it go red. Spec A3 is tested by route, not by UI: no route resolves a
family id to a buyable product. The migration runs over a fixture of the real messy values,
asserting nothing is lost and every unmatched value is flagged. D9's refusal to delete a family
with members is a test, because cascade is the default and the default is wrong here.

## Delivery (PRs)

1. `ProductFamily`, its repository, the nullable `familyId`, and the refusal to delete with
   members. No behaviour change: nothing creates a family yet.
2. The migration from `sizes` and `colors`. **Behaviour change**: a family becomes several
   sellable products, and stock splits.
3. The two counts, and every caller naming which it means.
4. The form's family and member rows.
5. `sizes` and `colors` removed.

## Open questions

None. The description question is closed by D10.
