# Spec — listing vocabulary / variants

- **Summary:** Anything that sells on its own is its own product with its own stock, and the category says what makes two things different
- **Status:** ✅ Implemented — PR-247, PR-249, PR-250 (2026-10-04)
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-01
- **References:** `431ed6e7:docs/specs/listing-vocabulary/variants/trd.md`, [parent spec](../spec.md), [ADR-0043](../../../adr/0043-a-variant-is-a-product-in-a-family.md), [media-library](../../media-library/)

> Requirements and product approach only. The technical approach was trd.md, removed once shipped (ADR-0073): `git show 431ed6e7:docs/specs/listing-vocabulary/variants/trd.md`.

## What this feature is

Making a thing that sells on its own — a colour, a bottle size, a set — a real product with its
own code, price and stock, and giving its siblings one place to record what they share.

## Why

A shop sells the black abaya and the maroon abaya as two things. Today they are one row with one
stock number and the colours typed into a box, so there is no honest answer to how many black
ones are left, and no way to charge differently for the one that costs more to make.

The same shop sells attar in three bottle sizes and incense by the pack. Those are not sizes and
not colours, which is why what varies cannot be fixed in advance — it belongs to the category.

## Requirements

- **R1** — Each category says what makes two of its things sell separately. Islamic wear varies by
  colour, fragrance by bottle size, incense by pack. Nothing is assumed to vary by size.
- **R2** — A thing that sells separately is its own product with its own code, price and stock.
  What its siblings share is recorded once for the family.
- **R3** — The family itself is not sellable: no stock, no basket, no order. Only its members can
  be bought.
- **R4** — Each member keeps its own photographs, because an abaya in four colours does not look
  the same in each.
- **R5** — A set sold alongside its parts is its own product with its own stock: a mat, a bag and
  the pair are three things counted separately, not one counted three ways.
- **R6** — A product with no siblings needs no family. One abaya in one colour is one product, and
  nothing asks the shop to declare a family of one.
- **R7** — Every screen that counts products says which it counts: families or sellable things.

## Hazards this feature must answer

Each is a bar the design must clear rather than a question for the owner, and names the
`431ed6e7:docs/specs/listing-vocabulary/variants/trd.md` decision that answers it.

- **"Products" stops meaning one thing.** Twenty abayas in five colours is a hundred rows. A
  dashboard reading "Products: 100" tells the shop it has a hundred abayas, which is false. The
  dashboard, the product list and the low-stock warning do not agree today by accident.
  *Answered by D6.*
- **A set and its parts can disagree about stock.** R5 keeps three counts, so selling the last
  loose mat leaves a combo showing in stock. Accepted, and not free — the alternative ties one
  sale to two other rows. *Answered by D4.*
- **Splitting one row into four can lose what was in the box.** The existing sizes and colours are
  free text and some of it matches no list. A migration that keeps only what it recognises throws
  away the shop's own record of what it sells. *Answered by D7.*
- **A family that can be bought is a stock leak.** If a family keeps a stock number at all,
  something will eventually sell it, and the four real counts will not move. *Answered by D3.*

## Product acceptance

- **A1** — A buyer sees one abaya in four colours, and buying the black reduces only the black's
  stock.
- **A2** — On a phone, giving four colours their stock and codes is not four full forms.
- **A3** — The family cannot be added to a basket by any route, including a direct link.
- **A4** — After the migration, every size and colour the shop had typed is still readable
  somewhere, including the misspelt ones.
- **A5** — A mat, a bag and the combo of both show three independent stock numbers.

## Out of scope (this feature)

Which facts a category asks, and the permitted answers, are [categories](../categories/). Filling
a fact in from the family is [inherited-facts](../inherited-facts/). What photographs are required
stays with [media-library](../../media-library/). Stock reservation and the checkout path are
unchanged by this feature and remain in [checkout-abandonment](../../checkout-abandonment/).
