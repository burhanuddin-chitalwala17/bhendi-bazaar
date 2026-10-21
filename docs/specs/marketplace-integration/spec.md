# Spec — marketplace-integration (overview)

- **Summary:** A shop runs its Flipkart and Amazon business from one master product per item: connect the accounts, bring the catalogue in, settle duplicates, tune each platform's listing, keep one stock figure, and publish
- **Status:** Draft
- **Domain:** channels (new), with catalog and listing
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-20
- **References:** [decisions.md](decisions.md), [channel-connectors](channel-connectors/), [INTEGRATIONS.md](../../INTEGRATIONS.md#connecting-a-seller-what-the-two-apis-actually-do), [ADR-0041](../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md), [ADR-0042](../../adr/0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md), [ADR-0061](../../adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md), TRACKER F-013

> The parent of eight subfeatures. Each has its own spec, decisions, UX and TRD; this file holds only
> the model they share and their order. Every decision, with who made it, is in decisions.md.

## What this is
Selling on Flipkart and Amazon without visiting either. A shop describes each product once, here,
and every marketplace it has connected shows that product, priced and stocked from here.

## Why
The seller's cost today is describing the same product on every marketplace and keeping stock right
by hand; an oversold item is a cancellation and a marketplace penalty. One master product and one
stock figure remove both, and Bhendi Bazaar becomes the place the shop works from.

## The model every subfeature follows
- **Bhendi Bazaar is the hub (Q1).** Products come in once, on connecting. After that, changes go
  out from here; orders, listing status and differences found on the marketplace come back.
- **One master product, one listing per platform (Q21).** A platform listing inherits the master
  and stores only what differs for that platform.
- **The master is the most complete version (Q25, Q23).** It holds every fact any connected
  platform needs, platform-only fields included; a platform screen never asks for input.
- **Strict fields are the master's alone (Q24, Q28).** Quantity, MRP, SKU, barcode, HSN and tax
  code, brand and the legal label are identical on every platform. Everything else may differ (Q29).
- **One quantity (Q24).** No per-platform stock, cap, buffer or safety stock (Q35).
- **Differences are found daily and settled by the seller (Q31).** Quantity is put right
  automatically; any other difference waits for the seller to keep ours or take theirs (Q39).
- **Amazon end to end; Flipkart behind switches (Q4).** All code is channel-neutral; each Flipkart
  capability turns on when Flipkart allows it, with no rework.

## Subfeatures, in order
Each is one outcome, ships alone, and needs the one before it.
1. **channel-connectors** — connect an Amazon or Flipkart account by consent and see its health.
2. **channel-import** — every listing on a connected marketplace arrives in an inbox; exact-SKU
   matches link to existing products by themselves, undoably (Q14, Q17).
3. **product-merge** — the owner decides which products are the same, whose content wins, and the
   real quantity (Q15–Q20).
4. **marketplace-facts** — a listing's attributes fill its product's facts through the reverse of
   the channel mappings; Amazon's mappings are built here (product-merge Q3).
5. **family-merge** — an item's sizes become one family on Bhendi Bazaar (product-merge Q2).
6. **channel-listings** — each platform's listing has its own screen, filled from the master,
   editable except for the strict fields (Q22, Q28, Q29).
7. **inventory-sync** — a sale or a cancellation anywhere moves the one stock figure, and every
   platform shows it (Q30, Q32, Q38).
8. **marketplace-publish** — a product is published to a platform from its listing screen, and
   its status comes back. Flipkart waits on a new-product API (Q33).

## Scope
- **In:** the eight subfeatures above, for Amazon.in and Flipkart.
- **Later:** instant sale notifications (Q34), the Amazon Appstore listing (Q36), returns as their
  own feature, Meesho, sales reporting, and matching by barcode or image (Q37).

## Open questions
None at this level; Q33 waits on Flipkart. Each subfeature's own questions live in its own decisions.md.
