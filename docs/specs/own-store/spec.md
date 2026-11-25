# Spec — own-store (overview)

- **Summary:** A small shop gets an online store it is proud to hand out, runs it from its phone without help, and never costs the platform money through an offer or an order gone wrong
- **Status:** Draft
- **Domain:** catalog, checkout, promotions, shipping, notifications, payouts
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-10-29
- **References:** [decisions.md](decisions.md), [org-storefront](../org-storefront/), [seller-profile](../seller-profile/), promotions (`planning-archive-2026-11-25:docs/specs/promotions/`), [shipment-lifecycle](../shipment-lifecycle/), [bulk-catalog-upload](../bulk-catalog-upload/), [ADR-0061](../../adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md)

> The parent of seven subfeatures, one per vertical. Each gets its own spec, decisions, UX and TRD
> when it starts; this file holds what they share and their order. Track 1 of three (BACKLOG.md).

## What this is
Track 1 of the three problems the platform solves for a traditional business: **its own store** —
a landing page and shop it can put on WhatsApp, a visiting card and a pamphlet. Tracks 2 (photos
made platform-ready) and 3 (selling on Amazon, Flipkart, Google, Meta) run alongside.

## Why
The store works but reads as built for us, not for the shop. Products are one long form, orders
stop at "Mark as packed", offers carry two verified ways to lose money, the profile asks unclear
questions, and every storefront looks like Bhendi Bazaar. The seller is not tech-savvy and uses a
phone in the shop.

## Rules every subfeature follows
- **Ask at the point of need.** Nothing is asked before the step that uses it (seller-profile R7).
- **Never leave the page to finish a task.** Anything a form depends on is created over it.
- **One task-based home.** What needs doing now, a setup list of at most five steps, then numbers.
- **No tours on arrival.** Hints of one to three steps, started from the setup list or a "?".
- **Plain words.** "Money you'll receive", not "ledger"; all copy in one place, ready to translate.
- **Money rules are invariants**, not features: Invariants 1–3, ADR-0018, ADR-0019.

## The seven verticals, in build order
1. **offers-hardening** — every verified money finding fixed, each with the test that proves it.
   Findings: one parcel's cancellation reverses every org's whole sale on the order; the
   per-customer coupon limit races; the org discount ceiling skips flat and sale-price discounts;
   platform-funded depth is unbounded; the quote route double-counts repeated lines; a losing coupon
   blocks checkout; no database checks back the engine; coupon codes are guessable without rate limits.
2. **order-fulfilment** — the org marks a parcel ready, the platform books the pickup, the buyer
   is told the date and ETA, and all three see one timeline to delivery. Cancellation and refund.
   One email matrix. Fixes found: new parcels are written as `pending`, outside the vocabulary,
   so tracking moves may be ignored; the courier webhook is unsigned; "packed" is order-wide, not
   per parcel; `estimatedDelivery` is never written.
3. **product-form** — create and edit in short steps on a phone, with a readiness hint while
   filling, not after. Admin can help a shop fix a product.
4. **bulk-sheet** — the template carries instructions and a dropdown for every platform-defined
   value (category, type, kind, family, brand, answers), is version-stamped, nudges a fresh
   download, and errors come back as the seller's own file with bad cells marked.
5. **seller-onboarding** — from "create shop" to first share in minutes: task home, setup list,
   grouped navigation, phone tab bar, in-place creation. Locations and reviews reachable in context.
6. **org-profile** — essentials only, each field explained by where it shows; contact and legal
   details editable by the shop; tax and bank asked when the first payout needs them.
7. **storefront-themes** — four templates (fancy & futuristic, royal & traditional, young &
   beautiful, affordable & everyday), each its own type, layout, palette and section order; the
   shop's offers and deals given a home; the storefront stops looking like the marketplace.

## Included with minimal focus
Channels (track 3), the media library and photo improvement (track 2) and bidding stay as built; this track only gives each a place in the new portal shell and a Home line when it needs the seller (seller-onboarding Q21). Their own roadmaps live in their tracks.

## Later
Bidding polish · replying to reviews · regional languages · SMS/WhatsApp order updates (needs DLT
templates) · custom domains · automatic courier booking (TRACKER F-005).

## Sequencing
1 first: it is money. 2 next: it carries the same parcel-reversal fix and is what buyers feel.
3–4 share the form's rules. 5–6 share one UX round. 7's UX starts in parallel with 2 because it
is design-led; its build waits for 6, which supplies the fields it renders.
