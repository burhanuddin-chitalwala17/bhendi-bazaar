# TRD — listing-model / attributes

- **Status:** Accepted
- **Domain:** listing, with catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-07
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), parent [trd.md](../trd.md) D1–D4, D10, D11

> Technical approach. Refines parent D1–D4, D10, D11.

## Approach
Expand only: new vocabulary and value tables beside today's, dual-written from every product save,
backfilled in batches and compared. Reads stay on today's columns until dynamic-form switches them.

## Prior art
Parent: Akeneo values + projection; Magento typed value tables.

## Technical decisions
- **D1 — `Attribute`** (key unique, kind, unitFamily?, multi, scope: product / brand / shop, label,
  retiredAt) and **`AttributeOption`** (attributeKey, key, label, order, retiredAt; unique pair). The 28
  facts become attributes with the same keys; their lists' `ListingValue` rows become options (D3 of
  parent; `ListingValue` retired in retire-old-paths). A test asserts every `kind` is handled in code.
- **D2 — `BbTypeAttribute`** (productTypeKey, attributeKey, group, order, labelOverride, requiredForBb).
  Built from `ProductType.facts`, `measures` and `factLabels`.
- **D3 — `ProductValue`** (productId, attributeKey, optionKey?, text?, number Decimal?, unit?, bool?,
  refId?, source, sourceId?; unique product+attribute; CHECK one value column set; index
  attributeKey+optionKey). One writer: a new `product-value.repository` in listing, which also writes
  the projection `Product.values` in the same transaction.
- **D4 — Canonical units.** Weight in grams, lengths in millimetres, volume in millilitres; the typed
  unit kept in `unit`. `Product.weight` (kg) migrates to the `weight` attribute in grams.
- **D5 — Inheritance at write.** `fillValues(productId)` resolves own → family → brand → shop per
  attribute by scope; a brand or shop-defaults save enqueues `listing.refresh-inherited` for affected
  products in batches of 500.
- **D6 — Brand parties.** `BrandParty` (brandId, role: maker / packer / importer, name, address,
  pincode; unique brand+role) and `Brand.amazonRegistered`; the brand-scoped attributes read them.
  `OrgListingDefaults.amazonGeneric` moves to each brand by migration (all brands of that shop).
- **D7 — Type follows category.** `Product.productType` is set from the category on every save and by a
  job when a category's type changes; products keep answers and the form asks only new attributes.
- **D8 — New attributes (parent Q26)** by migration: style, innerMaterial, outerMaterial, pocketCount,
  capacity (measure, ml), strapType (new) beside strap (kept, parent Q25), fabricType, careInstructions,
  sizeSystem, sizeClass, itemForm, unitCount, stoneType, stoneClarity, stoneCut, metalType, metalWeight,
  genericName, modelName, numberOfItems, with options from the channels' allowed values.
- **D9 — Backfill and compare** script: copies every product's facts, measurements, weight, brand
  compliance into values in batches of 1,000; compares counts and values per type; exits non-zero on
  any mismatch (parent Q33).

## Packages
None.

## Gates touched
`one-repository`, `product-visibility` CENSUS (new product reads), docs counts.

## Data model
[MIGRATION] `Attribute`, `AttributeOption`, `BbTypeAttribute`, `ProductValue`, `BrandParty`;
`Product.values` Json; `Brand.amazonRegistered`. Nothing dropped.

## Test plan
Integration: dual write keeps rows and projection equal; inheritance (brand change updates inheritors,
not overriders, spec A1); no brand uses the shop default (A2); backfill compare finds zero mismatch on
fixtures (A3); category type change asks only new attributes (A5).

## Delivery
1. Vocabulary, values, dual write, inheritance. 2. Brand parties, type follows category, new attributes.
3. Backfill and compare script.

## Open questions
None.
