# TRD — listing-model / channel-catalogue

- **Status:** Accepted
- **Domain:** channels, with listing (readiness)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-07
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), parent [trd.md](../trd.md) D5, D8, [ADR-0070](../../../adr/0070-a-products-attributes-are-rows-mapped-to-each-channels-own-catalogue.md)

> Technical approach. Refines parent D5, D8; never contradicts them.

## Approach
Two tables hold each channel's own types and fields. Amazon fills them from its definitions API
daily; Flipkart, Meesho, Google and Meta from data migrations generated from the extracted templates
and published specs. Readiness reads the catalogue for the product's channel type and lists required
fields with no value and no map. Nothing in today's publish path changes.

## Prior art
None beyond parent: the catalogue is Akeneo's "channel requirements" stored per destination, and
Amazon's Product Type Definitions API is the documented source for its side.

## Technical decisions
- **D1 — `ChannelType`** (id, channel, key, label, schema Json?, schemaVersion?, source, readAt, goneAt;
  unique channel+key) and **`ChannelField`** (id, channelTypeId, key, label, requirement: required /
  conditional / optional, kind: choice / text / number / measure / boolean, allowedValues Json?,
  allowedUnits Json?, adapterFills boolean, source, readAt, goneAt; unique type+key). One writer:
  a new `channel-catalogue.repository` in channels.
- **D2 — Amazon read.** `amazonTypeDefinition` grows into `amazonCatalogueType(token, type)`: required
  set from the schema's `required` plus the per-type conditional rules; each property's kind, enum
  (allowed values), unit enum. `channelCatalogueService.refreshAmazon()` runs from the daily
  `channels.maintain`, one call per Amazon type any ChannelCategoryMap row publishes to, through the
  home brand (`HOME_BRAND_ORG_ID`); upsert by key, missing keys get `goneAt`; unreachable leaves rows.
- **D3 — Feed and template channels.** A one-off script under `scripts/` reads
  `listing-node-templates/extracted/{flipkart,meesho}.json` and Google's and Meta's specifications
  (checked 2026-11-07) and writes a data migration; production applies it on deploy (CLAUDE.md
  invariant 7: reference data never in the seed).
- **D4 — Adapter fields.** `adapterFills` true for the identity, offer and compliance plumbing a create
  sends today (`SENT_BY_CREATE` and the always-sent keys in `amazonCreateBody`); readiness skips them.
- **D5 — Readiness.** `listingReadiness` gains a catalogue input: for the product's channel type, each
  required, non-adapter, non-gone field with no ChannelAttributeMap/Fill row for that type, or whose
  mapped fact is unanswered, is a `missingField` problem with the channel's label. Batched: catalogue
  read once per channel type per request.
- **D6 — Channel change alert.** A refresh that adds a required field records it; Home's attention
  reads "{channel} now asks {n} more details for {type}" for shops with products of that type (parent Q22).
- **D7 — JSON Schema stored** on `ChannelType.schema` for Amazon; validation itself is field-maps D-work.

## Packages
None in this subfeature (`ajv` lands with field-maps).

## UI approach
No new screen. The readiness line on the product page and listing names the missing fields;
the Home line follows existing attention lines.

## Gates touched
`one-repository` (new writer); `docs-integrity` counts (migrations, models); `module-boundaries` (the
catalogue service on channels' surface).

## Data model
[MIGRATION] `ChannelType`, `ChannelField`; a data migration loading Flipkart, Meesho, Google and Meta.

## Test plan
Unit: Amazon schema to fields (required, conditional, enums, units) on a stubbed schema; template
loader output for one node per channel. Integration: readiness for a HANDBAG product lists the 13
fields of 2026-11-06 (spec A1); adapter fields absent (A2); refresh marks a vanished field gone.

## Delivery
1. Tables, repository, Amazon read, readiness, Home line. 2. Template/spec data migration.

## Open questions
None.
