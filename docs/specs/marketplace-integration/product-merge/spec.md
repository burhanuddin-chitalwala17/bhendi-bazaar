# Spec — product-merge

- **Summary:** The owner settles every marketplace listing that is not linked: matches it to an existing product, adds it as a new product with its photos and the real quantity, or leaves it off; an item sold on both marketplaces becomes one product
- **Status:** Implemented
- **Domain:** channels, with catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-21
- **References:** [decisions.md](decisions.md), parent [marketplace-integration](../spec.md) and its [decisions](../decisions.md), [channel-import](../channel-import/), [ADR-0029](../../../adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md), [ADR-0043](../../../adr/0043-a-variant-is-a-product-in-a-family.md), TRACKER F-013

> Requirements and product approach only. The technical approach was trd.md, removed once shipped (ADR-0073): `git show 431ed6e7:docs/specs/marketplace-integration/product-merge/trd.md`. Subfeature 3 of
> marketplace-integration.

## What this feature is
The Not linked tab becomes a to-do list the owner can empty. For each listing they say what it is:
a product they already have, a new product, or something they do not sell here.

## Why
The hub model (parent Q1) only works when every item the shop sells has one master product here.
After import, most of a shop's marketplace catalogue sits unlinked: the shop sold on Amazon and
Flipkart long before Bhendi Bazaar. Until each listing has a home, stock cannot be kept as one
figure and nothing can be published from here.

## Requirements
- R1 — Every not-linked listing offers three choices: match to a product, add as new, leave off.
- R2 — Matching suggests products with a similar name; nothing links on a name alone (Q4, Q5).
- R3 — The same item on Amazon and Flipkart is suggested as one: same SKU first, then similar names.
  The owner confirms, and the two become one product (Q4).
- R4 — Before a merge is confirmed, the owner sees each side's title, description, photos, price and
  stock, with the more complete side chosen per field and switchable (Q6, Q13).
- R5 — Adding a new product takes its name, description, photos and SKU from the chosen side; the
  photos are copied into the shop's library (Q7). SKU and price follow Q10 and Q11.
- R6 — Every merge asks "How many do you actually have?", pre-filled with the lowest count (Q8).
- R7 — Leaving off marks the listing "Left off", removes it from the to-do count, and can be undone
  (Q9).
- R8 — The listing's row, its details panel and the product's "On marketplaces" block show the
  result straight away.
- R9 — Nothing is written to Amazon or Flipkart (Q15).

## Hazards the TRD must answer
- **A double tap or two members at once** must not create two products from one listing, or link a
  listing to two products.
  *Answered by D4, D8.*
- **A read running during a merge** (channel-import's job) must not undo or duplicate what the owner
  just decided.
  *Answered by D4, D7.*
- **A new product's SKU already used** by another of the shop's products, archived ones included.
  *Answered by D5.*
- **Photos that fail to copy** midway must not leave a product half made, or block making it.
  *Answered by D6.*
- **Setting the quantity** goes through catalog's stock commands (Invariant 6), not a direct write.
  *Answered by D4, D5.*
- **A product made from two listings** must leave both linked to it, or neither.
  *Answered by D4.*

## Product acceptance
- A1 — On a phone, a not-linked Amazon listing is added as a new product; it appears in Products
  with the Amazon title, photos in the library, and the quantity entered.
- A2 — A listing matched to an existing product shows "Linked" with that product, and the product
  changes only in the fields chosen in the comparison.
- A3 — An item listed on both marketplaces with the same SKU is suggested as one; confirming makes
  one product linked to both listings.
- A4 — A listing left off disappears from the to-do count and comes back when undone.
- A5 — Two quick taps on "Add as new" make one product.
- A6 — Nothing changes on Amazon or Flipkart.
- A7 — Every state in ux.md is reachable and reads as written.
- A8 — Verified on the owner's own catalogue at 360px.

## Scope
- **Outcome:** every not-linked listing is matched, added or left off by the owner.
- **In:** R1–R9.
- **Later:** marketplace attributes into facts — `marketplace-facts`, next (Q3); variant groups into
  families and Flipkart's sizes — `family-merge`, after it (Q2); per-platform prices and listing
  screens — channel-listings.

## Open questions
None. Q26 decided by the owner 2026-10-21.
