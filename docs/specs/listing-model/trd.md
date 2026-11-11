# TRD — listing-model (architecture)

- **Status:** Accepted
- **Domain:** listing, with channels, catalog and requests
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-08
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ADR-0070](../../adr/0070-a-products-attributes-are-rows-mapped-to-each-channels-own-catalogue.md), [ADR-0053](../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0038](../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0003](../../adr/0003-one-repository-per-aggregate.md)

> The storage and runtime design every subfeature builds on. Subfeature TRDs refine, never contradict.

## Approach
Four layers with one direction of dependency. **Vocabulary** (attributes, options, BB types) is
reference data. **Product values** are typed rows with a projection. **Channel catalogue** is each
channel's own types and fields. **Mapping** joins the two and is read by one pure builder that
produces a payload and its gaps. Completeness is stored and refreshed by jobs.

## Prior art
- **Akeneo PIM:** attributes and families as data, values projected to JSON, completeness per channel
  stored and recomputed on change. We follow all three; we keep typed rows as the truth (Akeneo relies
  on application checks).
- **Magento EAV:** typed value tables per kind; read cost is its known weakness. We keep typed columns,
  never read by join.
- **Salsify / Feedonomics:** one golden record, per-destination requirements and transform rules,
  feeds built at export. We follow; no stored destination copy.
- **Amazon Product Type Definitions API:** a JSON Schema per type. We store it and validate locally.
- **Our own:** expand/contract migrations, transactional outbox jobs, statement-count tests. Kept.

## Technical decisions
- **D1 — Vocabulary tables.** `Attribute` (key, kind, unitFamily, multi, scope: product / brand / shop),
  `AttributeOption` (attribute, key, label, order, retiredAt), `BbType` (today's ProductType, kept), and
  `BbTypeAttribute` (type, attribute, group, order, label override, requiredForBb). Rows created only
  by migration; a unit test asserts every `Attribute.kind` is one the code handles.
- **D2 — `ProductValue`**: (productId, attributeId) unique; `optionId` FK, `text`, `number` (decimal),
  `unit`, `bool`, `refId`; one populated per kind, enforced by a CHECK. `source` (product, family,
  brand, shop) and `sourceId`. Indexes: (attributeId, optionId), (productId). Measures stored in a
  canonical unit per family (grams, millimetres, millilitres) with the shop's unit kept for display.
- **D3 — Projection.** `ProductValueSet.values` JSON (its own table, attributes Q8) `{attributeKey: {v, unit?, src}}`, rebuilt from rows inside
  the transaction that writes them (one repository owns both). A nightly job compares a sample.
- **D4 — Inheritance at write.** On a product, family, brand or shop-default save, a job recomputes the
  inherited rows of affected products in batches of 500 (one read, one upsert per batch); the product's
  own rows are never overwritten.
- **D5 — Channel catalogue.** `ChannelType` (channel, key, label, schemaVersion, schema JSON, readAt,
  source, goneAt) and `ChannelField` (type, key, label, required: required / conditional / optional,
  kind, allowedValues, allowedUnits, adapterFills, goneAt). Upserted by key; a vanished field is marked
  gone. Amazon read daily, one call per mapped type, through the home brand; Flipkart and Meesho from
  `listing-node-templates/extracted/` by migration.
- **D6 — Maps.** `TypeMap` (BB type, kind?, channel type, publishes) replaces ChannelCategoryMap.
  `FieldMap` (channel field, source: attribute / rule / core / shop / constant, attributeId?, ruleKey?,
  coreKey?, constant?, unitTarget?) one per channel field per BB type, with `ValueMap` (field map,
  optionId → channel value). Rules are named functions in code (`department_from_audience`), parameterised by rows.
- **D7 — Builder.** `buildListing(product, typeMap, fields, maps, overrides) → { payload, gaps[] }`, pure,
  no I/O. Loaded inputs are cached per process, keyed by a `mapsVersion` counter bumped on any map or
  catalogue write. The provider turns the neutral payload into the channel's shape.
- **D8 — Local validation.** Before an Amazon call the payload is checked against the stored JSON Schema
  (ajv); a failure is a gap shown to the shop, never a request.
- **D9 — Completeness.** `ProductChannelState` (product, channel, missing count, missing field keys,
  inputsHash, computedAt). Refreshed by a job on product save, map change or catalogue change, batched;
  the products list reads it. Only connected channels get rows (parent Q4); connecting enqueues a backfill.
- **D10 — Migration order.** Expand (new tables, kept in step by triggers from today's answers, attributes
  Q7), backfill (in the expand migration, counts compared per type), switch reads (projection becomes the source the form and builder
  read), contract (drop `Product.facts`, ChannelAttributeMap/Fill/ValueMap, `FACT_DECLARATIONS`) in
  retire-old-paths. Each step its own migration and reversible until contract.
- **D11 — Brand as a reference.** Brand carries parties (maker, packer, importer: name, address, pincode)
  and `amazonRegistered`; brand-scoped attributes (origin, maker, packer, importer) inherit from it (Q8, Q10).

## Packages
`ajv` (JSON Schema validation) for D8; added to DEPENDENCIES.md in channel-catalogue.

## Data model
[MIGRATION] across subfeatures: D1, D2, D5, D6, D9 tables; `Product.values`; Brand parties. Nothing
existing dropped until retire-old-paths.

## Scale
10,000 shops × 500 products × 60 attributes ≈ 300M value rows: indexed, read never by join; partition
by product hash is the next lever. Completeness rows ≈ products × connected channels. Builder cost per
listing is CPU only; bulk readiness is O(batches) queries.

## Delivery
1. channel-catalogue (D5, D8 schema stored, readiness reads it). 2. field-maps (D6, D7, builder used
by create). 3. attributes (D1–D4, D11; expand and backfill). 4. dynamic-form (switch reads; D9).
5. retire-old-paths (contract). Each subfeature has its own spec, UX where it has screens, and TRD.

## Open questions
See [decisions.md](decisions.md) Q16 onward.
