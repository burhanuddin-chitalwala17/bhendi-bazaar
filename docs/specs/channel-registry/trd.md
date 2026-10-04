# TRD — channel registry

- **Summary:** Channels and three mapping tables as data, a readiness answer that is a pure function of them, and a seam each adapter fills
- **Status:** 📝 Draft
- **Domain:** catalog, with a seam each channel adapter implements
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-04
- **References:** [spec.md](spec.md), [ADR-0041](../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md), [ADR-0045](../../adr/0045-channel-mappings-are-versioned-data.md), [ADR-0042](../../adr/0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md), [ADR-0046](../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md), [listing-vocabulary](../listing-vocabulary/)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

Four tables and one pure function. `OrgChannel` says which places a shop has turned on; three
mapping tables hold category, attribute and value; readiness is computed from those plus the
product's own row, with no network call.

The shape follows the listing vocabulary: declarations in code, selections and answers as data,
and the thing that decides kept pure so a page, a service and a test agree.

## Prior art

**Mapping to a channel's taxonomy is what every multichannel tool does.**
[Akeneo](https://help.akeneo.com/adobe-commerce-connector-configuring-catalog-data/adobe-commerce-connector-map-products)
maps attributes and their options per target system as configuration; Shopify's standard taxonomy
exists to be mapped onto Google's and Meta's rather than replace them. **We follow it**: three
layers, all data, none a `switch`.

**Nobody maps values automatically.** Google and Meta are the closest pair here — Meta accepts
Google's namespace — and still disagree on values: `in_stock` against `in stock`, five age groups
against seven. A tool that guessed would be wrong at the rate its guesses were plausible. **We
follow the consequence**: an unmapped value fails readiness and the shop chooses (spec R5).

**Readiness before publish is the norm** — Amazon's product-type schemas and Shopify's feed
diagnostics exist so a shop learns before submitting. **We go further on one point**: ours is a
pure function of stored data, so a hard case is a unit test rather than an account and a
rejection ([ADR-0045](../../adr/0045-channel-mappings-are-versioned-data.md) D4).

**Where we depart**: no scheduled re-sync of taxonomies. Fetching five channels' category trees
quarterly is machinery this project does not need yet, and a stale mapping is visible through its
`checkedOn` date instead (D4). Deliberate, not overlooked.

## Technical decisions

- **D1 — A channel is declared in code, not a row.** Corrected before building: the first draft
  made channels rows so an admin could add one, and reading the codebase showed that is not what
  a channel is. `server/shared/channels.ts` already declares the set, and adding one needs code
  in three places regardless — an image rule in `channel-rules.ts`, a readiness rule in
  `org-onboarding.types.ts`, and an adapter. A row would have been a second spelling of a closed
  set, which that file's own comment exists to prevent. The kinds — storefront, shopfront,
  marketplace, network
  ([ADR-0041](../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)) — are
  declared beside them. What a *shop* chooses is data, which is D2.
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
- **D9 — Nothing here holds a credential or makes a request** (spec R10); `channel-connectors`
  adds the secrets later, in its own domain.
- **D10 — The gate never disables a control.** Readiness is returned to the UI, and the publish
  action refuses with a `DomainError` naming what is missing, shown through the error envelope
  this project already has ([ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md)).
  A disabled button explains nothing (spec R7).
- **D11 — What an adapter can derive, it derives; it does not become a fact.** Google wants
  `gender` and `age_group`, which the marketplaces ask as one question — Men, Women, Boys, Baby
  Girls, Kids, Unisex — so the split belongs in Google's mapping. And `condition`, which no
  product can answer differently here, is a constant in that adapter until this store sells
  something used ([ADR-0047](../../adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md)).
- **D12 — A nearest fit is the platform's decision, shown to every shop it affects.** Decided by
  the owner on 2026-10-04. Choosing that a rida lists as an abaya is a commercial judgement about
  where buyers look, which argues for the shop — but one mapping serves every shop selling that
  type, so a seller's choice would silently change another's listings. The platform decides and
  the fit is shown with its note wherever a product's readiness is (D6), so a shop can see what
  it disagrees with. The question reopens the first time two shops want different answers, which
  would need the mapping scoped per org and is not worth building before anybody asks.

## Packages

None.

## UI approach

Two surfaces, both mobile-first ([ADR-0015](../../adr/0015-mobile-first-design.md)).

An admin register: per channel, what is mapped and what is not, with the unmapped values as a
worklist — one value fixed there serves every product using it, which keeps the job finite. And
a readiness panel on the product: blocked and warned read differently, and a nearest fit names
what it will be listed as. On a phone, one channel per row, expanding.

## Data model

[MIGRATION]. `OrgChannel` (org, channel, enabled) — the only per-shop state; the channels
themselves are declared (D1).
`ChannelCategoryMap` (channel, productType, kind, their category, `fit`, note, `checkedOn`).
`ChannelAttributeMap` (channel, productType, fact, their attribute, required, `checkedOn`).
`ChannelValueMap` (channel, list, our key, their value, `checkedOn`). Each map is unique on its
natural key. A category map's `kind` is nullable — every kind of that type — and NULLs are
distinct to a unique index, so a partial index carries that case as it does for `ListingValue`.

## API / contract changes

[CONTRACT]. A readiness DTO per product and channel — band, blocks, warnings — plus the admin
register's own shapes. `docs/CONTRACTS.md` moves in the same PR.

## Test plan

Readiness is pure, so its table is unit tests: every required fact present; one missing; a value
mapped; a value unmapped; a nearest-fit category; a channel a shop has not enabled. The maps'
uniqueness is a guard test against a real database, mutation-tested by dropping each constraint.
Seeded mappings are checked for consistency the way the product types are — one naming a fact or
a type that does not exist fails, which catches a bad seed.

## Delivery (PRs)

1. The tables and the channels, seeded. No behaviour change.
2. The pure readiness function and its tests, with no caller.
3. Readiness wired into the product form and the org's product list.
4. The admin register, including the unmapped-value worklist.
5. The seeded mappings: Flipkart and Meesho from the extracted templates, Google from its spec.

## Open questions

None. The one this draft carried — whether a nearest fit is the platform's decision or the
shop's — was closed by the owner on 2026-10-04 and is recorded as D12.
