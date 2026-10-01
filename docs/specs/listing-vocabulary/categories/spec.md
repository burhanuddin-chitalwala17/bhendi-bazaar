# Spec — listing vocabulary / categories

- **Summary:** Nine categories, each naming the kinds it holds and the few questions it asks, with fixed answers where a list exists
- **Status:** 📝 Draft
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-01
- **References:** [trd.md](trd.md), [parent spec](../spec.md), [ADR-0047](../../../adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

The list of categories a shop can put a product in, and for each one: the kinds of thing it
holds, the facts it asks about them, and which of those facts have a fixed set of answers.

## Why

Today every product is asked the same questions, which means it is asked almost nothing — there
is no place for an abaya's sleeve, an attar's shelf life or a ring's purity, because a single
question set that suited all three would have to be the union of all three and would be mostly
blank on every product.

Asking per category is only worth it if each category asks little. The platform templates say it
is: the per-category questions two platforms agree on number between one and six.

## Requirements

- **R1** — A product sits in exactly one of nine categories: Islamic wear, trousers, prayer mat,
  bag, travel pouch, fragrance, jewellery, socks, combo.
- **R2** — Each category names the kinds it holds, and the kind is a fact recorded on the product.
  Islamic wear holds abayas, burqas, niqabs and hijabs; fragrance holds attar and bakhoor, which
  are different things; a combo is its own category, not a kind of mat.
- **R3** — Each category decides which facts it asks about, and asks nothing that does not apply.
  An abaya is asked its sleeve and stitch; an attar its capacity and shelf life; a ring its
  plating and purity.
- **R4** — A fact with a fixed set of answers is chosen from that set, not typed. Colour, fabric,
  pattern and kind are chosen. Free text is kept for what genuinely has no list.
- **R5** — Where a fact can be measured, the measurement is what is recorded and anything
  following from it is worked out. A free-size abaya has a length and a bust; "free" follows from
  them and is never the only thing stored.
- **R6** — Adding an answer to a list is something the shop does, not something that waits for a
  release. Adding a *fact* is a release.

## Hazards this feature must answer

Each is a bar the design must clear rather than a question for the owner, and names the
[trd.md](trd.md) decision that answers it.

- **A list that still accepts typing is not a list.** The existing colours hold several spellings
  of the same one, so moving them across without deciding what happens to a value matching nothing
  reproduces the mess in the new shape. The leftovers say what is missing. *Answered by D3, D8.*
- **A category that asks everything is the old box with more steps.** Per-category questions only
  pay off if they are few; if listing an abaya means answering thirty things, the minutes go up
  and the feature has failed on its own measure. *Answered by D2 and the parent's D1.*
- **Nine categories is a guess about what this shop will sell.** It covers what it sells today and
  attar was nearly missed. A tenth category must be a declaration to add, not a migration.
  *Answered by D1.*

## Product acceptance

- **A1** — Listing an abaya asks about an abaya: no question about plating, capacity or purity
  appears on the form.
- **A2** — A colour the shop sells and the list lacks can be added by the shop, and the next
  product can choose it without a deploy.
- **A3** — Nobody types a size. An abaya saves with its length and bust and reads as free size.
- **A4** — An attar and a bakhoor are listed as different things, each asked its own questions.

## Out of scope (this feature)

Which platform category a kind corresponds to, and what happens when it has no exact match, is
`channel-registry`. Families and stock are [variants](../variants/);
filling a fact in from elsewhere is [inherited-facts](../inherited-facts/).
