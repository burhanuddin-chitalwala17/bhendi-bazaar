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
mapping tables hold category, attribute and value; readiness is computed from those and the
product's own row, with no network call. The shape follows the listing vocabulary: declarations
in code, answers as data, and the thing that decides kept pure so page, service and test agree.

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

**Where we depart**: no scheduled re-sync of taxonomies. Fetching five category trees quarterly is
machinery this project does not need yet; `checkedOn` makes a stale one visible instead (D4).

## Technical decisions

- **D1 — A channel is declared in code, not a row.** Corrected before building: the first draft
  made channels rows so an admin could add one. `server/shared/channels.ts` already declares the
  set, and adding one needs code in three places regardless — an image rule, a readiness rule and
  an adapter — so a row would have been a second spelling of a closed set, which that file's own
  comment exists to prevent. The kinds
  ([ADR-0041](../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)) are declared
  beside them. What a *shop* chooses is data, which is D2.
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
  nearest`, with a note saying why. It is the **quieter band**, so it is shown every time rather
  than approved once and forgotten (spec R4, third hazard).
- **D7 — Three bands: incomplete, warned, ready.** Incomplete is something the channel marks
  compulsory; warned is a nearest fit or a recommended-but-absent fact; ready is neither. A
  half-mapped register therefore still reports usefully.
- **D8 — A channel's required set is declared by its adapter, as a schema**
  ([ADR-0042](../../adr/0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md)
  decisions 2–5 unchanged). One declaration answers readiness and builds the payload, so what is
  checked cannot drift from what is sent — the second hazard.
- **D9 — Nothing here holds a credential or makes a request** (spec R10); the secrets arrive with
  `channel-connectors`.
- **D10 — Readiness advises; it never gates.** Decided by the owner on 2026-10-04, replacing a
  draft where an incomplete product was refused with a `DomainError`. Nothing disables a control
  and nothing refuses a publish: "required" here is our reading of a template, never something
  watched, so refusing on it would stop listings that would have gone through and we would never
  learn which. The channel's answer is the verdict. A gate becomes arguable once there are real
  rejections to build it from, and the band names say advice so none is wired in by accident.
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
  it disagrees with. It reopens the first time two shops want different answers, which would need
  the mapping scoped per org.

## Packages

None.

## UI approach

Two surfaces, both mobile-first ([ADR-0015](../../adr/0015-mobile-first-design.md)).

An admin register: per channel, what is mapped and what is not, with the unmapped values as a
worklist — one value fixed there serves every product using it, which keeps the job finite. And
a readiness panel on the product: the bands read differently and a nearest fit names what it
will be listed as, with nothing on either surface preventing a publish (D10). On a phone, one
channel per row, expanding.

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

1. The tables and the channels, declared. No behaviour change.
2. The pure readiness function and its tests, with no caller.
3. The register read, and the shop's opt-in — without which nothing can turn a channel on, so
   readiness could never appear and the rest would be undemonstrable.
4. Readiness wired into the product form and the org's product list.
5. The admin register, including the unmapped-value worklist.
6. The seeded mappings: Flipkart and Meesho from the extracted templates, Google from its spec.

## Open questions

None. The one this draft carried — a nearest fit's owner — was closed on 2026-10-04 as D12.
