# Spec — listing vocabulary

- **Summary:** Describe a product once, in the words this shop uses, so every fact is stated where it is known and anything that sells on its own has its own stock
- **Status:** 📝 Draft
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-01
- **References:** [trd.md](trd.md), [categories](categories/), [variants](variants/), [inherited-facts](inherited-facts/), [ADR-0047](../../adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md), [ADR-0043](../../adr/0043-a-variant-is-a-product-in-a-family.md), [seller-profile](../seller-profile/), [media-library](../media-library/)

> Requirements and product approach only. Technical approach lives in trd.md.
> This is the overview; the three subfeatures below hold the detail.

## What this feature is

The facts a shop states about what it sells, and where each one is recorded so it is stated once
rather than retyped. Three parts, each specified on its own:

| Subfeature | Holds |
|---|---|
| [categories](categories/) | The nine categories, the kinds each holds, the facts each asks, and the answers it accepts |
| [variants](variants/) | What makes two things sell separately, and the family that carries what they share |
| [inherited-facts](inherited-facts/) | Filling a fact in from the family, the brand or the shop's defaults, and showing where it came from |

Nothing is published anywhere and no other company is contacted: this is a shop describing its own
goods for its own storefront.

**Which facts exist was decided by looking outward.** A fact earns its place because the shop can
answer it from the product, without knowing which platform is asking
([ADR-0047](../../adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md)) —
one platform asking is enough, none is enough. The set was read off thirty-four real bulk-upload
templates in [listing-node-templates](../../../listing-node-templates/), not invented and not
inferred from how the product model happens to look today.

## Why

A shop today lists "Black Abaya" with one price, one stock number, and its sizes and colours typed
into a box as text. Enough to sell it here, not enough to describe it to anybody else.

There is nowhere to put the facts a marketplace asks for — fabric, bust, length, tax code, shelf
life. One stock number covers every colour with no honest way to split it, so there is nothing
truthful to say when somebody asks how many black ones are left. And the same answers are retyped
on every product, so the colour box ends up holding "Maroon", "maroon" and "Marron", which are
three colours as far as any marketplace is concerned.

The measure is this phase's own: minutes to list a product. Everything here is judged against
that, not against how complete the model looks.

## Requirements

These are properties of the whole; each subfeature states its own in detail.

- **R1** — A product sits in one category, which decides every question asked of it and asks
  nothing that does not apply. Specified in [categories](categories/).
- **R2** — Where a fact can be measured, the measurement is what is recorded and anything
  following from it is worked out. Nobody in this store types a size.
- **R3** — Anything that sells on its own is its own product with its own code, price and stock;
  what its siblings share is recorded once. Specified in [variants](variants/).
- **R4** — A fact left unanswered is filled in from the family, the brand or the shop's defaults
  and stored on the product, and the shop is shown where it came from. Specified in
  [inherited-facts](inherited-facts/).
- **R5** — Nothing here blocks saving. A product with facts unanswered saves, sells here, and is
  told what is missing rather than refused.

## Product acceptance

- **A1** — Listing an abaya in four colours takes less time than listing two does today, and the
  fabric is stated once.
- **A2** — A product with nothing but a name and a price still saves and still sells here.
- **A3** — Nobody types a size. An abaya saves with its length and bust, and reads as free size.
- **A4** — A buyer sees one abaya in four colours, and buying the black reduces only the black's
  stock.
- **A5** — On a phone, giving four colours their stock and codes is not four full forms.

## Out of scope (this feature)

Anywhere outside this storefront. Which platform category a kind corresponds to, what happens when
it has no exact match, how a fact translates into another company's words, whether a product is
ready, and selling it at different prices in different places are all
`channel-registry`. This spec gives that work the vocabulary to map
**from**, and maps nothing itself; here a product has one price.

When the form asks for a fact and how an answer is written back to a brand is
`product-form`; required photographs stay with [media-library](../media-library/).
