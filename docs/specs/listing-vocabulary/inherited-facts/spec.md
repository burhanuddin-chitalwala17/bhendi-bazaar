# Spec — listing vocabulary / inherited facts

- **Summary:** A fact left blank is filled in from the family, the brand or the shop's defaults, stored on the product, and shown with where it came from
- **Status:** 📝 Draft
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-02
- **References:** [trd.md](trd.md), [parent spec](../spec.md), [seller-profile](../../seller-profile/)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

Answering a question once instead of once per product. A fact the shop has already stated — on
the family, on the brand, or as its own default — fills itself in when a product is saved, and
the product is left carrying the answer. A description typed once on the family is how four
colours of one abaya each end up with their own description without it being typed four times.

## Why

The same answers are typed again on every product. One supplier's fabric is entered fifty times,
the country of origin is entered on everything, and the packer's name and address are entered on
everything because every marketplace demands them. That is most of the minutes this phase is
trying to remove, and it is also where the typing errors come from.

Filling a fact in silently creates a new problem: a wrong answer arriving from a brand looks
exactly like a right one. So being told where an answer came from is part of the feature, not a
nicety on top of it.

## Requirements

- **R1** — On save, a fact left unanswered is filled from the family, then the brand, then the
  shop's defaults, in that order, and stored on the product. Answering it on the product
  overrides all of them.
- **R2** — From then on the product carries its own facts. Nothing is fetched from a brand to show
  a product or to send it anywhere.
- **R3** — Wherever a fact was filled in rather than typed, the shop is shown where it came from.
  "Nida matte, from your brand Noor" is what lets somebody spot the one crepe abaya.
- **R4** — A filled-in fact stays editable, and editing it clears the mark. From then on it is the
  shop's own answer and no later change elsewhere touches it.
- **R5** — Correcting a fact at **any level above the product** — the family, the brand, or the
  shop's defaults — offers to correct every product that took its answer from there and has not
  since been edited by hand. A hundred products saying "Made in India" because the brand said so
  are fixed in one action; the one somebody deliberately changed is left alone. The family is the
  level this happens on most, because it is where the description was typed.
- **R6** — Before any such change takes effect, the shop is told how many products it will change,
  and confirms. A correction and a change of supplier are identical to the system and completely
  different to the shop, so it asks rather than assumes.
- **R7** — An order keeps what was true when it was placed. Changing a fact today never rewrites
  what a buyer was shown last year.
- **R8** — A retired brand still answers for products that named it; retiring one never blanks a
  product.

## Hazards this feature must answer

Each is a bar the design must clear rather than a question for the owner, and names the
[trd.md](trd.md) decision that answers it.

- **Being filled in for you hides a wrong answer.** A fact from the brand is convenient until it
  is wrong on one product and nothing on screen says where it came from. A design that inherits
  correctly while showing nothing has met this spec's letter and missed it. *Answered by D3 and
  the UI approach.*
- **The count and the update can disagree.** R6 shows a number and then changes rows. If the two
  are separate queries, the shop confirms one figure and a different set changes. *Answered by D5.*
- **"Not since edited by hand" has to survive a correction.** R5 depends on knowing which answers
  the shop owns. If editing a value does not reliably clear its mark, a deliberate change is
  silently reverted by the next brand correction. *Answered by D3 and D4.*
- **An order showing today's facts is a rewritten receipt.** R7 is not about this feature changing
  orders on purpose; it is about an order that reads through to a product and therefore changes
  when the product does. *Answered by D7.*

## Product acceptance

- **A1** — Every filled-in fact on a product form says which brand or default it came from.
- **A2** — Correcting the country of origin on a brand corrects every product that took its answer
  from there, after a confirmation naming how many that is, with no product opened.
- **A3** — A product whose fabric was edited by hand is not touched by a later brand correction.
- **A4** — Retiring a brand leaves every product that used it reading exactly as before.
- **A5** — An order placed last month still shows what it said last month after the brand changes.

## Out of scope (this feature)

Which facts exist and what answers they accept is [categories](../categories/). Families are
[variants](../variants/). Where a brand's own facts are entered, and writing an answer back to a
brand from the product form, is `product-form` and
[seller-profile](../../seller-profile/).
