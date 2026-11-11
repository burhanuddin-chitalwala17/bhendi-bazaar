# Spec — channel registry

- **Summary:** What each selling channel is, what it calls the things this shop sells, and whether a product is ready to go there — answered before publishing rather than after a rejection
- **Status:** ✅ Implemented
- **Domain:** catalog, with a seam each channel adapter implements
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-04
- **References:** `431ed6e7:docs/specs/channel-registry/trd.md`, [ADR-0041](../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md), [ADR-0045](../../adr/0045-channel-mappings-are-versioned-data.md), [ADR-0047](../../adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md), [listing-vocabulary](../listing-vocabulary/), [INTEGRATIONS.md](../../INTEGRATIONS.md)

> Requirements and product approach only. The technical approach was trd.md, removed once shipped (ADR-0073): `git show 431ed6e7:docs/specs/channel-registry/trd.md`.

## What this feature is

The register of where a shop can sell, what each of those places calls the things it sells, and
whether a given product is ready to go to one.

It publishes nothing. It is the dictionary and the pre-flight check that publishing will need:
`shopfront-feeds`, `channel-connectors` and `marketplace-publish` each depend on it, and none of
them can begin without it, because nothing would know what to send.

## Why

[listing-vocabulary](../listing-vocabulary/) gave this shop one way to describe a product. Every
channel has its own, and they do not agree — not about categories, not about attributes, and not
about values. A field name matching is not its values matching, and that holds even inside one
platform.

Without this, the first attempt to publish is also the first time anybody learns the words are
different, and the learning arrives as a rejection: a listing suppressed for a missing attribute,
or live in the wrong category where nobody looking for it will find it. Both are discovered days
later, by a shop that thought it had listed.

The store's largest line is the clearest case. A rida is 36 of its 94 products and has **no exact
match** on either marketplace: Flipkart's node permits Abaya, Burqa and Naqab; Meesho has Abayas,
Burqa, Niqab, Hijab and Other Islamic Wear. Something has to decide which, and it must be a
decision somebody took rather than a guess the system made.

## Requirements

- **R1** — A channel declares what kind it is, and the kind decides what it gets
  ([ADR-0041](../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)). A shopfront
  gets a feed; a marketplace gets authorisation, listing, orders and stock. The kind belongs to
  the channel, never to the shop or the product.
- **R2** — Three things are mapped, all as data: a product type and its kind to the channel's
  category, a fact to the channel's attribute, and an answer to the channel's value.
- **R3** — A mapping says when it was checked and against what. A claim about somebody else's
  system, undated, cannot be audited or expired.
- **R4** — A mapping is marked **exact** or **nearest fit**, and a nearest fit is shown before
  anything is published. A rida listed as an abaya is a decision; a rida listed as an abaya
  silently is a surprise waiting to be found.
- **R5** — An answer with no mapping is reported and never guessed. The shop is told which value
  has no equivalent and chooses one, once, for every product that uses it.
- **R6** — Readiness is answerable per product and per channel, before publishing: what is
  missing, what is unmapped, and where a category is only the nearest they have.
- **R7** — **Readiness advises and never gates.** It is shown wherever a product is, and
  publishing is always attempted — not disabled, and not refused. We have never published once,
  so our idea of what a channel requires is itself untested; refusing on it would stop listings
  that would have gone through and we would never learn which. The channel's own answer is the
  only verdict that has been tested. A gate may be added once publishing has been, and the
  evidence for it will be the rejections we actually see.
- **R8** — The platform owner edits mappings without a release. A channel adding a colour on a
  Tuesday must not wait for a deploy, and nor must the shop waiting on it.
- **R9** — A channel can be turned off per shop, and off is the default. A shop sells where it
  has chosen to sell.
- **R10** — Nothing here contacts anybody. The register and the advice answer from stored data,
  so the hard cases are tests rather than an account and a rejection.

## Hazards this feature must answer

Each is a bar the design must clear rather than a question for the owner, and names the
`431ed6e7:docs/specs/channel-registry/trd.md` decision that answers it.

- **A mapping that is right today is wrong next quarter.** Channels rename categories and retire
  values. A register with no date and no way to re-check becomes a confident lie. *Answered by
  D4.*
- **Readiness that disagrees with the channel is worse than none.** It will disagree, in both
  directions, until publishing has been watched. *Answered by D5, D8 and D13.*
- **A nearest fit is invisible once it works.** It is approved once and then applies silently to
  every later product, including ones it suits far less. *Answered by D6.*
- **Mapping is a long job nobody finishes.** Thousands of values across several channels is not
  an afternoon, and a half-filled register must still be useful rather than blocking everything.
  *Answered by D3 and D7.*

## Product acceptance

- **A1** — A product's readiness for a channel is answerable with no network call.
- **A2** — An unready product says what is missing, naming the fact and the channel, and can
  still be published.
- **A3** — A value with no mapping is reported for that channel only, and the shop is shown it
  once rather than per product.
- **A4** — A rida's listing category on each marketplace is visible before publishing, marked as
  a nearest fit.
- **A5** — The owner changes a mapping and the next readiness answer reflects it, with no deploy.
- **A6** — A shop that has enabled no channel sees no readiness warnings anywhere.

## Out of scope (this feature)

Publishing itself: the feed file is `shopfront-feeds`, per-shop authorisation is
`channel-connectors`, pushing a listing is `marketplace-publish`. Reading orders back, and
reconciling stock across channels, belong to whichever of those owns the channel. Nothing here
holds a credential or makes a request.
