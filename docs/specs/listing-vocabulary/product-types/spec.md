# Spec — listing vocabulary / product types

- **Summary:** An admin creates and edits the question sets themselves, so onboarding a seller with a new product line does not wait for a developer
- **Status:** ✅ Implemented — PR-236, PR-237, PR-238, PR-240, PR-241 (2026-10-03)
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-03
- **References:** [trd.md](trd.md), [parent spec](../spec.md), [categories](../categories/), [ADR-0047](../../../adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

A product type is the set of questions a product is asked. This makes that set something an
admin creates and edits in the platform, rather than something declared in code and shipped in a
release.

It does not make the *facts* themselves editable. Colour, fabric, sleeve, capacity and the rest
are a declared vocabulary, because each carries validation and a way of being answered. A type is
a **selection from that vocabulary**, and a selection is data.

## Why

The nine types written from the platform templates cover ninety of this store's ninety-four
products. That is not the measure, because the store is one seller. The measure is onboarding:
for the first hundred sellers a new product line arrives often enough that a developer in the
loop is a bottleneck on the main growth activity, not an occasional chore. Later, with the
catalogue settled, it becomes rare again — but the expensive period is now.

Adding a *category* is already an admin action. Adding a *question set* is not, and the two are
asked for in the same breath: a seller who brings a line the platform has never carried needs
both.

## Requirements

- **R1** — An admin creates a product type: what it is called, which facts it asks, which
  measurements it takes and in what unit, what makes two of its products sell separately, and
  which kinds it holds.
- **R2** — The facts available to choose from are the platform's declared vocabulary. A fact
  nobody has declared is still a release, and that is the line: choosing *which* questions is
  configuration, inventing a *new kind of* question is engineering.
- **R3** — A product keeps the answers it was saved with. Editing a type changes which questions
  are asked next time and rewrites nothing already stored.
- **R4** — A type in use cannot be deleted. It is retired, which hides it from the pickers and
  leaves every product that names it reading exactly as before.
- **R5** — A category points at a type, and may point at none. Pointing at none is legitimate for
  a category whose products genuinely differ, and its products are then asked the shared
  questions only and are not publishable.
- **R6** — Where a type's size reads as a scale rather than a word — a ring's diameter becoming a
  ring size — that scale belongs to the type and the admin sets it.
- **R7** — Creating a type is a design decision, not data entry, and the screen says so: it shows
  which questions each marketplace will then demand, and refuses nothing.
- **R8** — Nothing here blocks saving a product. A product whose type was edited mid-life still
  saves, still sells, and is told what is now missing.

## Hazards this feature must answer

Each is a bar the design must clear rather than a question for the owner, and names the
[trd.md](trd.md) decision that answers it.

- **A wrong type is worse than no type.** It asks a seller the wrong questions, and the answers
  are stored and published before anybody notices. The screen has to make a bad type hard to
  build rather than merely possible to fix. *Answered by D7 and the UI approach.*
- **A type edited after products exist.** Removing a fact from a type must not blank it on the
  products that answered it, and adding one must not make them retroactively invalid.
  *Answered by D3 and D8.*
- **A typo becomes a type.** The nine were constants the compiler checked. A row is not checked by
  anything, so a product could come to name a type that does not exist. *Answered by D2.*
- **Every form render becomes a database read.** The questions now live in a table, and the
  product form is the hottest seller-facing screen there is. *Answered by D5.*

## Product acceptance

- **A1** — An admin creates a type and the next product in a category using it is asked its
  questions, with no deployment.
- **A2** — Editing a type leaves every existing product's stored answers untouched.
- **A3** — A type with products cannot be deleted, and retiring it changes no product.
- **A4** — A product cannot be saved naming a type that does not exist.
- **A5** — The product form costs no more database reads than it did before this feature.
- **A6** — The nine types that shipped in code exist afterwards with the same keys, and every
  product keeps the type it had.

## Out of scope (this feature)

The facts themselves — adding a genuinely new kind of question stays a release. Mapping a type
and its kinds onto another company's categories is `channel-registry`. What the seller's own form
looks like is `product-form`. Collections, and a product appearing in several places a buyer
browses, are their own feature.
