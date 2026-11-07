# Spec — listing-model / dynamic-form

- **Summary:** The product form asks every attribute the product's type needs for any channel, required for the shop's connected channels and optional for the rest, with each product's completeness per channel shown and stored
- **Status:** Accepted
- **Domain:** listing, with catalog and channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-07
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), parent [listing-model](../spec.md) Q3, Q4, Q17, Q22, Q27–Q29, [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 4 of 5.

## What this feature is
The form draws its questions from the product's type. What Bhendi Bazaar and the shop's connected
channels need is "Required now"; what other channels would need is under "Also helps on…". Each
product shows, per channel, how complete it is, and the products list counts what is left.

## Why
Today the form asks a fixed list; a channel field mapped to a fact the type does not ask shows a hint
with no field; connecting a channel later would leave every product with gaps nobody sees.

## Requirements
- R1 — The form asks exactly the attributes the product's type uses, grouped, in the type's order.
- R2 — "Required now": what BB and the shop's connected channels require; "Also helps on…": what other
  supported channels would need, collapsed; each question carries small badges of the channels using it (parent Q27).
- R3 — An inherited answer says where it came from ("from your brand Noor") and can be overridden.
- R4 — Per product, per connected channel, completeness is shown ("Amazon 17 of 19") with what is
  missing; the products list counts it; it is stored, never computed on a page view (parent Q17).
- R5 — Connecting a channel shows "{n} products need {m} details for {channel}", opening the bulk-fill
  page; a product is created on that channel only once complete (parent Q4, Q28).
- R6 — When a channel adds a required field, Home says so with a link to fill it (parent Q22).
- R7 — The brand page holds the three parties with address and pincode, and "Registered on Amazon /
  list as Generic"; only the name is required (parent Q10, Q29).
- R8 — Nothing on the form stops a save (ADR-0053); the form and the server validate from the same rules.

## Product acceptance
- A1 — On a phone, a Tote bag of a shop connected to Amazon shows Style, Inner material, Pockets,
  Capacity and Strap type under "Required now", badged Amazon; Flipkart-only questions sit under "Also helps on Flipkart".
- A2 — Filling them moves "Amazon 6 of 19" to "Amazon 19 of 19" without a reload of the list.
- A3 — Connecting Flipkart shows "38 products need 4 details for Flipkart" and the bulk-fill page.
- A4 — Country, maker and packer show "from your brand Noor"; overriding one on a product keeps it.
- A5 — Saving a brand with only a name works; its products show what each channel still needs.

## Scope
- **Outcome:** one form that asks everything any channel needs, honest about which matter now.
- **In:** R1–R8; the form, per-channel completeness, the connect prompt, the channel-change alert, the brand page.
- **Later:** none.

## Open questions
None.
