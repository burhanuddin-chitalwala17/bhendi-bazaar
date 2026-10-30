# Spec — family-merge

- **Summary:** The colours (or bottle sizes, platings, packs) of one item, listed separately on a marketplace, become one family on Bhendi Bazaar, each still its own product with its own SKU, price and stock; Amazon's own grouping is used and Flipkart's listings are grouped by the owner
- **Status:** Implemented
- **Domain:** channels, with catalog and listing
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-29
- **References:** [decisions.md](decisions.md), parent [marketplace-integration](../spec.md) (Q43), [product-merge](../product-merge/) (Q2), [marketplace-facts](../marketplace-facts/), [variants](../../listing-vocabulary/variants/), [ADR-0043](../../../adr/0043-a-variant-is-a-product-in-a-family.md), [ADR-0051](../../../adr/0051-a-products-facts-are-one-json-column-each-entry-carrying-its-origin.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 5 of
> marketplace-integration.

## What this feature is
An abaya sold on Amazon in four colours is four listings under one parent. Settled one by one, it
becomes four unrelated products. This feature makes it one family of four, the way the shop thinks
of it, without typing what the four share four times.

## Why
A family carries what its members share (name, description, category, fabric, care) and each member
only what differs (ADR-0043). Without it the shop edits the same description four times, the store
shows four separate abayas, and the parent listing a marketplace wants later has nothing to come
from. Amazon already says which listings belong together; Flipkart does not.

## Requirements
- R1 — An Amazon variation group (its parent and children, already shown together on the Listings
  page) can be settled as one family: the parent becomes the family, each child a product in it (Q2, Q3).
- R2 — Each member keeps its own SKU, price, stock and photos (Q9). Nothing changes on the marketplace (Q14).
- R3 — The family takes one category, and so one product type. It varies by whatever its listings
  actually differ on, among the facts and measurements the type asks: colour, length, waist,
  material, plating, pack. It starts from the type's usual axes, the page says which it uses, and
  the owner can remove one that is not a real difference (Q12, Q16).
- R4 — Each member's varying answers (its colour, length, plating or pack) comes from its own listing through the
  marketplace's mapping; an unclear one is asked, as marketplace-facts does (Q6).
- R5 — What every member's listing agrees on fills the family once; what differs stays on the member (Q7).
- R6 — Two members with the same varying answer are refused, naming both (Q8).
- R7 — Products that were settled one by one before this feature can be grouped into a family
  afterwards, from the same group on the Listings page (Q4).
- R8 — Flipkart listings, which carry no grouping, can be grouped by the owner: Bhendi Bazaar
  suggests listings that look like one item and the owner confirms; nothing is grouped automatically (Q5).
- R10 — Listings can join a family that already exists, through the same page (Q20); a group too
  large for one save is settled in parts (Q19).
- R11 — The family path is the obvious one without being forced: a group offers it first and
  explains itself once, and a single listing of a group points to it from its Settle page (Q22).
- R9 — Every grouping can be changed later: a member can leave a family or join another, from the
  product, as today (Q11, parent Q43).

## Hazards the TRD must answer
- **A half-made family:** a save that makes the family and only some members leaves listings
  linked to nothing sensible. All members are saved, or none. *Answered by D3, D5.*
- **A member already in another family, or already linked to another product,** must not be moved
  silently. *Answered by D3.*
- **The parent listing itself** has no stock and is not for sale; it must never become a product. *Answered by D2.*
- **Two people settling the same group at once** must make one family. *Answered by D3.*
- **A large group** (earrings in 4 platings and 6 colours) must still fit a phone screen. *Answered by D2 (the 30 cap) and the UI approach.*

- **A member whose varying answer is unknown, or two that look the same,** must be caught before
  anything is saved. *Answered by D1, D3.*
- **Values from the browser** must not decide what is saved. *Answered by D3.*

## Product acceptance
- A1 — On a phone, an Amazon item in four colours settles as one family of four products in one
  save, each with its own SKU, price and stock, and the store shows one item with four colours.
- A2 — The family's shared facts are filled once and each member shows only its own colour.
- A3 — Four colours already added one by one can be grouped into one family without re-adding them.
- A4 — Three Flipkart listings the owner picks become one family; nothing is grouped without the owner.
- A5 — Two members with the same colour are refused with both named, and nothing is saved.
- A6 — A member can be moved out of the family afterwards and remains a product with its stock.

## Scope
- **Outcome:** an item's colours (or what else its type varies by) from a marketplace become one family of products here.
- **In:** R1–R11, for every connected marketplace through one path; Amazon gives its groups, Flipkart is grouped by the owner.
- **Later:** pairing a family's Amazon and Flipkart listings member by member in one step (Q13; each
  Flipkart listing joins a member through today's Match); a family's own photographs (Q15); the
  parent listing a marketplace wants at publish (marketplace-publish).

## Open questions
None: Q3–Q5 decided 2026-10-26, Q16 on 2026-10-29.
