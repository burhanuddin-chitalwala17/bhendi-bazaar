# Spec — marketplace-facts

- **Summary:** When a product is linked to a marketplace listing, its type and facts (fabric, sleeve, occasion and so on) fill in from that listing's own attributes where the answer is clear, and the owner answers the rest once per product; one path serves every marketplace
- **Status:** Implemented
- **Domain:** channels, with listing and catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-25
- **References:** [decisions.md](decisions.md), parent [marketplace-integration](../spec.md) and its [decisions](../decisions.md) (Q42), [product-merge](../product-merge/), [ADR-0047](../../../adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md), [ADR-0051](../../../adr/0051-a-products-facts-are-one-json-column-each-entry-carrying-its-origin.md), [ADR-0054](../../../adr/0054-a-channel-mapping-carries-a-checked-date-and-source-and-required-ness-is-data.md), TRACKER F-013

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 4 of
> marketplace-integration.

## What this feature is
A shop describes a product once. After a listing is linked, the product already knows what its
marketplace says about it, so the shop does not type the same facts again.

## Why
Product-merge gives a product a title, photos and stock, but not the attributes a marketplace
needs. Without them the product form stays incomplete, and every publish later starts from nothing.
Amazon's listing already holds those answers, so reading them saves the shop most of the typing.

## Requirements
- R0 — A linked listing's own marketplace type is read first. The mapping gives our product type automatically; when it gives several, the owner picks (Q11). For a product with no category yet, that type gives the category: one pre-selected, or the owner picks among several (Q25). The facts then follow from the type (Q9).
- R1 — A linked Amazon listing's attributes are read on the owner's request and when a product is
  made from a listing, and mapped to our facts through the channel's attribute mappings.
- R2 — A fact is filled only where the marketplace answer maps to exactly one of our answers. Each
  filled fact records that it came from Amazon.
- R3 — Where a marketplace answer maps to several of ours, the owner chooses the product's answer,
  once per product, with the marketplace's words shown beside our options (Q42).
- R4 — A fill only fills empty facts; a fact the owner has answered is never changed by a fill (Q2).
- R8 — When no product type matches an Amazon type, the seller can park the listing in one step, and ask the admin about it by email or WhatsApp with a message already filled in (Q6, Q12, Q13). Parked listings return to the to-do when a type exists.
- R9 — Product details beyond facts fill the same way: weight, dimensions, HSN code, MRP, country of origin, and the manufacturer and packer details (Q17).
- R10 — An admin can correct which marketplace types point to each of our types, and which one publishes, on the channel register screen (Q26). A shop corrects one product's type by changing its category, for that product only (Q27).
- R7 — Every fact can be changed later, including one filled from Amazon, and an answer chosen from Amazon's options can be changed too; a changed fact is marked, and Amazon's answer can be restored (Q10).
- R5 — Facts that cannot be read (no product type, a category with no mapping, an unreadable
  listing) say so plainly, and the product can still be used.
- R6 — Every marketplace goes through the same path, with no marketplace-specific handling. A listing whose marketplace returns no attributes (Flipkart today) fills nothing and says so; when that marketplace starts returning them, only its read changes (Q4).

## Hazards the TRD must answer
- **A fill racing the owner's own edit** must not overwrite what the owner just typed.
  *Answered by D7.*
- **An Amazon attribute with no mapping yet** must not be filled or guessed.
  *Answered by D5.*
- **Mapping rows that are out of date** must show when they were last checked.
  *Answered by D11.*
- **A large read** on a shop with many linked products must not block the product page.
  *Answered by D7.*

## Product acceptance
- A1 — On a phone, a product linked to an Amazon listing shows its clear facts already filled, each
  marked "from Amazon", and nothing the owner typed has changed.
- A2 — A fact with several possible answers shows Amazon's words and our options; choosing one fills
  it and records the choice.
- A3 — A product with no product type says so and fills nothing.
- A4 — A product made from a listing has its facts filled as part of making it.
- A5 — A product linked only on a marketplace that returns no attributes (Flipkart today) shows "no answers" and no error.
- A6 — Every state in ux.md is reachable and reads as written.
- A7 — A filled fact can be edited, and the change is marked "changed by you"; "Reset to Amazon's answer" restores Amazon's.

## Scope
- **Outcome:** a linked Amazon product's facts fill from Amazon, and the owner answers only the
  ones that are unclear.
- **In:** R0–R10 for every connected marketplace through one path (Amazon gives attributes today), for the product types the owner names; the "Fill from Amazon" action on
  linked products; the owner's answers to ambiguous facts.
- **Later:** changing a fact on a live listing (channel-listings); new
  product types and their mappings beyond the first list (Q6); publish-time use (marketplace-publish).

## Open questions
None. Q3 and Q12 decided by the owner 2026-10-23.
