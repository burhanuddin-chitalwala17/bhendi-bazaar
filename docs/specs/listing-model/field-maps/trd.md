# TRD — listing-model / field-maps

- **Status:** Accepted
- **Domain:** listing, with channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-07
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), parent [trd.md](../trd.md) D6, D7, D8

> Technical approach. Refines parent D6–D8.

## Approach
`FieldMap` rows, one per (BB type, channel field), name a source and conversions. A pure builder turns
a product's values plus the maps into a neutral payload and a gap list; each provider turns the neutral
payload into its channel's shape (Amazon attributes, feed tags). The default maps are a data migration
Claude writes from each channel's documentation, each row carrying source URL, date and reason.

## Prior art
Salsify / Channable: destination field ← source + transform rules, evaluated at export. Followed.

## Technical decisions
- **D1 — `FieldMap`** (id, bbTypeKey, kind?, channelFieldId, source: attribute / rule / core / shop /
  constant / adapter / developer, attributeKey?, ruleKey?, coreKey?, shopKey?, constant?, unitTarget?,
  checkedSource, checkedOn, reason; unique bbType+kind+channelField) and **`FieldValueMap`** (fieldMapId,
  optionKey, channelValue; unique). One writer: a new `field-map.repository` in listing.
- **D2 — Rules** are named pure functions in a new `field-rules` module in listing (`department_from_audience`,
  `age_range_from_audience`, `size_display_from_measures`, `item_form_from_kind`…), keyed by `ruleKey`;
  a test asserts every `ruleKey` in a row exists.
- **D3 — Builder** `buildChannelListing(input) → { fields: {key, value, unit?}[], gaps: {field, reason}[] }`
  in a new pure `listing-builder` module in listing. Inputs loaded once per batch, cached per process keyed by
  a `mapsVersion` counter bumped by any map or catalogue write.
- **D4 — Units** convert from the canonical family unit (attributes subfeature) to `unitTarget`; until
  attributes lands, from today's measure units and `Product.weight` (kg).
- **D5 — Providers** gain `toChannelShape(fields)`: Amazon nests `value`/`unit`, `marketplace_id`,
  `language_tag`, dotted paths (`outer.material`, `size_info.display_name`); feeds emit `g:` tags.
  Replaces `mapped()` and `forwardAttributes`/`fillAttributes` in the create path.
- **D6 — Local validation.** `ajv` validates the Amazon shape against `ChannelType.schema` before the
  check-only call; failures become gaps.
- **D7 — Overrides of a fixed value** (parent Q24): a constant map is a default the product value
  overrides when the product answers the same attribute.
- **D8 — Admin screen** `/admin/channels/{channel}/{type}`: server page via DAL; edit through
  `PUT /api/admin/field-maps` (`requirePlatformAdmin`, Zod), audited.
- **D9 — Proof** (spec R7): a script runs one sample product per mapped type through Amazon
  `createListing(preview)` and the Google and Meta validators; results recorded in the CHANGELOG.

## Packages
`ajv` 8 (validation, D6); DEPENDENCIES.md entry.

## Gates touched
`one-repository`, `route-reachability`, `portal-boundary`, `hardcoded-copy`, docs counts.

## Data model
[MIGRATION] `FieldMap`, `FieldValueMap`; data migration with the default maps for all five channels.

## Test plan
Unit: builder per source kind, unit conversion, value pairing, gap on unpaired answer; every rule key
resolves. Integration: Tote bag builds department and age range from audience (spec A2), grams reach
Amazon as kilograms (A3), admin edit changes the next build (A4).

## Delivery
1. Tables, builder, rules, providers' shape, create path switched. 2. Default maps (research) and
admin screen. 3. Proof run.

## Open questions
None.
