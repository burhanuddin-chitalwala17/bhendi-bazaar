# Spec — listing-model (overview)

- **Summary:** One Bhendi Bazaar product that holds every attribute any channel needs; each channel keeps its own catalogue of what it asks, and one mapping layer builds and checks each channel's listing from the product
- **Status:** Accepted
- **Domain:** listing, with channels, catalog and requests
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-07
- **References:** [decisions.md](decisions.md), [plan.html](plan.html) (flow diagrams and evidence), [ADR-0052](../../adr/0052-a-product-type-is-a-row-that-selects-from-facts-declared-in-code.md), [ADR-0053](../../adr/0053-readiness-advises-and-never-gates.md), [setup-requests](../setup-requests/), [channel-catalogue](channel-catalogue/)

> The parent of five subfeatures. Each has its own spec, decisions, UX and TRD; this file holds only
> the model they share and their order.

## What this is
A shop describes a product once, fully. Every channel it sells on gets a listing built from that
product, and before anything is sent the shop sees, per channel, every field the channel requires,
where its value comes from, and what is still missing.

## Why
On 2026-11-06 Amazon refused a Tote bag for 13 fields. Half were already stored and never sent, some
went to the wrong Amazon field, and a few had no question at all. Brand and shop defaults looked
connected and filled nothing. The owner called it a black box. Each new channel would make it worse.

## The model every subfeature follows
- **The BB product is the whole truth (Q1, Q6).** One value per attribute, each with its source.
- **Separate type models (Q2).** BB types say what we ask; channel types say what a channel accepts.
- **Every channel we build for (Q32).** Amazon, Flipkart and Meesho, and the feed channels Google
  Shopping and Meta: same catalogue, maps and completeness; a feed channel's output is its feed.
- **Channel catalogue (Q11).** Each channel's types and fields, with required flags, allowed values
  and units, loaded from the channel itself, refreshed only when the channel changes.
- **One field map per channel field.** Its value comes from an attribute, a rule, a core field, the
  shop's settings or a fixed value, with value and unit conversion. Nothing guessed, nothing dropped.
- **Built, not copied (Q7).** A channel listing stores overrides and what was sent; the payload is
  built from the product and the maps each time.
- **Broad from day one (Q3, Q4).** Every product holds every channel's attributes; required only
  where the shop is connected; a channel's listing exists once connected.
- **Attributes are rows a developer adds (Q5).** The admin chooses and maps; never creates.
- **Brand fills compliance attributes (Q8, Q10).** Origin, manufacturer, packer and importer are
  attributes the brand fills by default; a product can override; no brand means the shop's default.
- **Type follows category (Q9).**

## Subfeatures, in order (Q14), shipped as one release (Q31)
1. [channel-catalogue](channel-catalogue/) — each channel's types and fields stored, so readiness
   reads what a channel truly requires.
2. field-maps — one map per channel field with its source and conversions; an admin mapping screen.
3. attributes — attributes and product values as rows; brand and shop fill attributes.
4. dynamic-form — the form renders a type's attributes with per-channel completeness; brand parties.
5. retire-old-paths — the old fact declarations and map tables go once nothing reads them.

## Requirements every subfeature keeps
- R1 — Every channel keeps working through every subfeature; nothing is migrated in a way that loses a
  product's answer.
- R2 — A shop can always see, per channel, what is filled, from where, and what is missing (ADR-0053:
  advise, never gate).
- R3 — A new channel or a channel's change is data and a provider; never a rewrite of the model.

## Open questions
None.
