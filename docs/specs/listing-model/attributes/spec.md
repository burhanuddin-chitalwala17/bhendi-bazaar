# Spec — listing-model / attributes

- **Summary:** Every question a product answers is an attribute row a developer adds, every answer a typed value pointing at it, and brand and shop fill the compliance attributes, so nothing a channel needs lives in a side door
- **Status:** Accepted
- **Domain:** listing, with catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-07
- **References:** [decisions.md](decisions.md), parent [listing-model](../spec.md) Q5, Q6, Q8–Q10, Q16, Q19, Q20, Q25, Q26, [ADR-0070](../../../adr/0070-a-products-attributes-are-rows-mapped-to-each-channels-own-catalogue.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 3 of 5. No UI:
> the screens that read attributes are dynamic-form's.

## What this feature is
The vocabulary every product is described in becomes one dictionary of attributes. A product's answer
to each is stored once, typed, with where it came from. Brand and shop settings fill the attributes
they own, and a product type follows its category.

## Why
Questions were a list in code that nothing could point at; country of origin, maker and packer reached
Amazon from the brand by a side door the form and readiness could not see; brand and shop defaults
filled nothing; a product's type drifted from its category. Channel fields need something real to map to.

## Requirements
- R1 — Every question is an attribute with a kind (choice, text, number, measure with unit, yes/no, a
  reference to a brand), added only by a developer's migration (parent Q5).
- R2 — Every answer is stored once per product per attribute, with its source: the product, its
  family, its brand or the shop's defaults (parent Q6, Q16).
- R3 — Country of origin, manufacturer, packer and importer are attributes; the brand fills them by
  default and a product can override any (parent Q8). A product with no brand uses the shop's default (Q10).
- R4 — A brand holds three parties (maker, packer, importer: name, address, pincode) and whether it is
  registered on Amazon or lists as Generic (parent Q10, Q29).
- R5 — A product's type always follows its category; a category moving to another type asks its
  products only what is new (parent Q9).
- R6 — The new attributes of parent Q26 exist: bags, clothing, fragrance and incense, jewellery, and
  generic name, model name and number of items for every type.
- R7 — Every existing answer moves across with nothing lost; an old answer that does not fit a new
  question stays as its own attribute, and the new one starts empty (parent Q19, Q25).
- R8 — Measures are kept in one unit per family and shown in the unit the shop typed (parent Q20).

## Hazards the TRD must answer
- **Losing an answer in the move:** counts per type compared before the switch; a mismatch stops the
  release (parent Q33).
- **Two sources disagreeing** (the value rows and the product's read copy): rebuilt together, compared nightly.
- **A brand edit touching thousands of products:** inherited values refreshed in batches, never overwriting the product's own.

## Product acceptance
- A1 — A product whose brand is Noor shows country, maker and packer "from your brand Noor"; changing
  Noor's maker updates every product that inherits it, and none that overrides it.
- A2 — A product with no brand uses the shop's default brand's values.
- A3 — Every answer on every product before the move is present after it, by count and by value.
- A4 — A Tote bag can be asked Style, Inner material, Pockets, Capacity and Strap type; today's
  "Detachable" strap answer is still there, under its own name.
- A5 — Moving a category to another type keeps its products' answers and asks only the new questions.

## Scope
- **Outcome:** one dictionary of attributes, answered once, with brand and shop filling theirs.
- **In:** R1–R8; the attribute dictionary; typed values; brand parties; type follows category; the move.
- **Later:** none.

## Open questions
None.
