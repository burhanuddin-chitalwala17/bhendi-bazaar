# TRD — channel registry

- **Summary:** Channels and three mapping tables as data, a readiness answer that is a pure function of them, and a seam each adapter fills
- **Status:** 📝 Draft
- **Domain:** catalog, with a seam each channel adapter implements
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-04
- **References:** [spec.md](spec.md), [ADR-0041](../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md), [ADR-0045](../../adr/0045-channel-mappings-are-versioned-data.md), [ADR-0042](../../adr/0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md), [ADR-0046](../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md), [listing-vocabulary](../listing-vocabulary/)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

Four tables and one pure function. `Channel` says what each place is and whether a shop has
turned it on; three mapping tables hold category, attribute and value; and readiness is computed
from those plus the product's own row, with no network call.

The shape follows the listing vocabulary deliberately: declarations in code, selections and
answers as data, and the thing that decides kept pure so a page, a service and a test agree.

## Prior art

**Mapping to a channel's taxonomy is what every multichannel tool does**, and the two reference
implementations agree on the shape. [Akeneo](https://help.akeneo.com/adobe-commerce-connector-configuring-catalog-data/adobe-commerce-connector-map-products)
maps attributes and attribute options per target system as configuration. Shopify's standard
taxonomy exists to be mapped onto Google's and Meta's rather than to replace them. **We follow
it**: three layers, all data, none a `switch`.

**Nobody maps values automatically**, which is the part worth stating. Google and Meta are the
closest pair in this space — Meta accepts Google's own namespace — and they still disagree on
values: `in_stock` against `in stock`, five age groups against seven. A tool that guessed would
be wrong at exactly the rate its guesses were plausible. **We follow the consequence**: an
unmapped value fails readiness and the shop chooses (spec R5).

**Readiness before publish is the norm** — Amazon's product-type schemas and Shopify's feed
diagnostics both exist so a shop learns before submitting. **We follow it and go further on one
point**: ours is a pure function of stored data, so a hard case — a value mapping to nothing, a
channel whose required set changed — is a unit test rather than an account and a rejection
([ADR-0045](../../adr/0045-channel-mappings-are-versioned-data.md) D4).

**Where we depart**: no scheduled re-sync of taxonomies. Fetching five channels' category trees
quarterly is machinery this project does not need yet, and a stale mapping is visible through its
`checkedOn` date instead (D4). Deliberate, not overlooked.

## Technical decisions

- **D1 — `Channel` is a row, and its kind is declared in code.** The kinds are storefront,
  shopfront, marketplace and network
  ([ADR-0041](../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)); each decides
  which machinery applies, so a kind is a branch in code and not something an admin invents.
  Which channels exist, and their keys, are rows.
- **D2 — A shop opts in per channel, and off is the default** (spec R9). `OrgChannel` carries
  the enablement and, later, whatever `channel-connectors` needs. An absent row is off, so a shop
  that has decided nothing is not nagged about anything.
- **D3 — Three mapping tables, not one.** Category mapping is keyed by `(channel, productType,
  kind)`; attribute by `(channel, productType, fact)`; value by `(channel, list, valueKey)`. They
  are separate because they are filled at different times and by different effort — a shop can
  publish with categories mapped and values half-done, and the gate will say exactly which values
  are missing (spec R5, the fourth hazard).
- **D4 — Every mapping row carries `checkedOn` and the source it was checked against.** A mapping
  is a claim about somebody else's system on a particular day. Nothing expires automatically; the
  date is what makes a stale one visible and is shown wherever a mapping is.
- **D5 — Readiness is a pure function** of the product row, the channel's mappings and the
  channel's declared required set. No Prisma, so the hard cases are unit tests
  ([ADR-0045](../../adr/0045-channel-mappings-are-versioned-data.md) D4) and a page and a service
  cannot disagree about whether something is ready.
- **D6 — A nearest fit is a column on the category mapping, not a convention.** `fit: exact |
  nearest`, with a note saying why. Readiness returns it as a **warning rather than a block**, so
  it is shown every time rather than approved once and forgotten (spec R4, third hazard).
- **D7 — Readiness answers in three bands: blocked, warned, ready.** Blocked is what the channel
  will refuse; warned is a nearest fit or a recommended-but-absent fact; ready is neither. A
  half-mapped register therefore still reports usefully instead of refusing everything.
- **D8 — A channel's required set is declared by its adapter, as a schema**
  ([ADR-0042](../../adr/0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md)
  decisions 2–5 unchanged). The same declaration answers readiness and builds the payload, so the
  gate cannot drift from what is actually sent — which is the second hazard.
- **D9 — Nothing here holds a credential or makes a request** (spec R10). The register is
  readable by a page; `channel-connectors` adds the secrets later, in its own domain.
- **D10 — The gate never disables a control.** Readiness is returned to the UI, and the publish
  action refuses with a `DomainError` naming what is missing, shown through the error envelope
  this project already has ([ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md)).
  A disabled button explains nothing (spec R7).
- **D11 — `gender` and `age_group` are derived from `audience`, not stored twice.** The
  marketplaces ask one question — Men, Women, Boys, Baby Girls, Kids, Unisex — that Google splits
  into two. The split belongs in the Google adapter's mapping, which is what mappings are for.
- **D12 — A nearest fit is the platform's decision, shown to every shop it affects.** Decided by
  the owner on 2026-10-04. Choosing that a rida lists as an abaya is a commercial judgement about
  where buyers look, which argues for the shop — but one mapping serves every shop selling that
  type, so a seller's choice would silently change another's listings. The platform decides and
  the fit is shown with its note wherever a product's readiness is (D6), so a shop can see what
  it disagrees with. The question reopens the first time two shops want different answers, which
  would need the mapping scoped per org and is not worth building before anybody asks.
- **D13 — A constant a channel needs and no product can answer is the adapter's, not a fact.**
  Google requires `condition`; this store sells new goods only, so it is a constant in that
  adapter. It becomes a fact the day anything used is sold, and not before
  ([ADR-0047](../../adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md)).

## Packages

None.

## UI approach

Two surfaces, both mobile-first ([ADR-0015](../../adr/0015-mobile-first-design.md)).

An admin register: the channels, and per channel what is mapped and what is not, with the
unmapped values as a worklist — one value fixed there serves every product using it, which is
what keeps the mapping job finite. And a readiness panel on the product, listing the enabled
channels and what each would say: blocked and warned read differently, and a nearest fit names
what it will be listed as. On a phone, one channel per row, expanding.

## Data model

[MIGRATION]. `Channel` (key, kind, label, active). `OrgChannel` (org, channel, enabled).
`ChannelCategoryMap` (channel, productType, kind, their category, `fit`, note, `checkedOn`).
`ChannelAttributeMap` (channel, productType, fact, their attribute, required, `checkedOn`).
`ChannelValueMap` (channel, list, our key, their value, `checkedOn`). Each map is unique on its
natural key so a second mapping cannot quietly shadow the first.

## API / contract changes

[CONTRACT]. A readiness DTO per product and channel — band, blocks, warnings — plus the admin
register's own shapes. `docs/CONTRACTS.md` moves in the same PR.

## Test plan

Readiness is pure, so its table is unit tests: every required fact present; one missing; a value
mapped; a value unmapped; a nearest-fit category; a channel a shop has not enabled. The three
maps' uniqueness is a guard test against a real database, mutation-tested by dropping each
constraint. Seeded mappings are checked for internal consistency the way the product types are —
a map naming a fact or a type that does not exist fails, which is what catches a bad seed.

## Delivery (PRs)

1. The tables and the channels, seeded. No behaviour change.
2. The pure readiness function and its tests, with no caller.
3. Readiness wired into the product form and the org's product list.
4. The admin register, including the unmapped-value worklist.
5. The seeded mappings for Flipkart and Meesho from the extracted templates, and for Google from
   its published specification.

## Open questions

None. The one this draft carried — whether a nearest fit is the platform's decision or the
shop's — was closed by the owner on 2026-10-04 and is recorded as D12.
