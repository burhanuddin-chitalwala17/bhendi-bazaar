# Spec — listing-model / channel-catalogue

- **Summary:** Each channel's types and fields are stored with what they require, allow and measure in, so readiness names every required field a product is missing for a channel before it is sent
- **Status:** Implemented
- **Domain:** channels, with listing (readiness)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-07
- **References:** [decisions.md](decisions.md), parent [listing-model](../spec.md) Q2, Q11, [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. The technical approach was trd.md, removed once shipped (ADR-0073): `git show 431ed6e7:docs/specs/listing-model/channel-catalogue/trd.md`. Subfeature 1 of 5.

## What this feature is
Bhendi Bazaar keeps, for every channel type a product can go to, the list of fields that channel
asks: which are required, which values it accepts, and in which units. Readiness reads that list.

## Why
Amazon refused a Tote bag for 13 fields we could not see coming: our readiness only knows the fields
we chose to map, and every Amazon map row is marked not required. A channel's requirements must come
from the channel, not from what we remembered to type in.

## Requirements
- R1 — For each channel type in scope (Q2), its fields are stored with required / conditional /
  optional, value kind, allowed values and units, and the date and source they were read from (Q4).
- R2 — Amazon's types are read from Amazon through the home brand and refreshed daily (Q7);
  Flipkart's and Meesho's from their templates; Google's and Meta's from their published product
  data specifications (parent Q11, Q32).
- R3 — Fields a create always fills (identity, offer, compliance plumbing) are marked as the
  channel adapter's and never asked of the shop (Q5).
- R4 — Readiness for a product on a channel lists every required field of its channel type that has
  no value and no map, by the channel's own label (Q3, Q6).
- R5 — Nothing here stops saving or sending (ADR-0053).
- R6 — Every channel keeps working: today's maps and creates behave as before (parent R1).

## Hazards the TRD must answer
- **Amazon unreachable or the home brand disconnected:** the last read stays, dated; nothing is cleared.
- **A field disappears from a channel:** marked gone, not deleted, so history and maps survive.
- **Cost:** the daily read is one call per Amazon type, not per product or per shop.

## Product acceptance
- A1 — A Tote bag mapped to Amazon HANDBAG, with today's answers, shows "Amazon needs 13 more:"
  followed by the same 13 fields Amazon named on 2026-11-06, before any send.
- A2 — An Amazon field the create always sends (country of origin plumbing, offer, identifiers) is
  never in that list.
- A3 — A Flipkart bag lists Flipkart's mandatory bag fields; a Meesho handbag lists Meesho's; a
  handbag on Google lists colour (required for Apparel & Accessories in India), on Meta its required fields.
- A6 — When a channel adds a required field, Home says "{channel} now asks {n} more details for
  {type}" with a link to fill them (parent Q22).
- A4 — With the home brand disconnected, the last Amazon read still drives readiness and says its date.
- A5 — Publishing to Amazon works exactly as before.

## Scope
- **Outcome:** readiness names every field a channel requires, from the channel's own definition.
- **In:** R1–R6; the stored catalogue; the daily Amazon read; Flipkart and Meesho loaded once; the
  readiness line.
- **Later:** mapping each field to a source (field-maps), asking the missing ones on the form
  (dynamic-form).

## Open questions
None.
