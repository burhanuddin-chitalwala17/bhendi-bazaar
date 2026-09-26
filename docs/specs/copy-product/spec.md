# Spec — copy-product

- **Summary:** An org starts a new product from one of its own, carrying the descriptive fields
- **Status:** Implemented — PR-147
- **Domain:** catalog
- **Phase:** 6 — Catalogue richness
- **Verified:** 2026-09-23
- **References:** [trd.md](trd.md), [product-archive](../product-archive/spec.md), [ADR-0015](../../adr/0015-mobile-first-design.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
An org starts a new product from one of its existing products, so the descriptive work already done on a sibling item is not typed again.

## Why
An org's catalogue is mostly families: the same kurta in five fabrics, the same attar in three sizes. Each shares a description, category, sizes, colours, tags and flags, and today every one is re-entered by hand. Re-entry is slow on a phone and is where a family drifts apart — one member tagged, the next not.

## Requirements
- R1 — From its product list, an org can copy any one of its products into a new-product form.
- R2 — A copy carries the description, category, attributes (sizes, colours, tags) and flags. It does not carry the name, price, SKU, photos, video, stock or weight: those identify or value one specific item, and carrying them makes a duplicate, not a sibling.
- R3 — On the new-product page, an org can pick a product to copy from, choosing among the products it has on sale, and can go back to a blank form. The choice can be narrowed by typing part of a product's name or SKU.
- R4 — An org can only copy its own products. Naming another org's product, or one that does not exist, opens an ordinary blank form.
- R5 — The copy is only a starting point. Nothing is saved until the org submits, and the result is an independent product with no link back to its source.
- R6 — The form says which product it was copied from and what still needs filling in.
- R7 — The row actions on the product list sit behind one ⋯ menu, which includes Copy. Deleting still asks for confirmation.

## Product acceptance
- A1 — On a ~360px phone, the ⋯ menu on a row opens to View, Edit, Copy product, Archive/Restore and Delete, each a comfortable tap target.
- A2 — Choosing Copy opens the new-product form with description, category, sizes, colours, tags and flags filled in, and name, price, SKU, photos and stock empty.
- A3 — Picking a different product in the "Copy from product" menu replaces the copied fields. "Start blank instead" clears them.
- A6 — Typing in the menu's search box narrows the list by name or SKU as you type, says so when nothing matches, and keeps working when the pointer passes over the list.
- A4 — Editing the URL to another org's product id shows a blank form, not that product's description.
- A5 — A draft typed on the blank form is still there after abandoning a copy.

## Out of scope (this feature)
- Copying photos or video. A photo belongs to one item, and a shared reference would make deleting it from one product a question about another.
- Copying across orgs, and bulk duplication (see [bulk-catalog-upload](../bulk-catalog-upload/spec.md)).
