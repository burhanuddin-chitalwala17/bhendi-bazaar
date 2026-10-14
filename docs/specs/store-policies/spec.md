# Spec — store-policies

- **Summary:** One public page states how the store sells — shipping, cancellation, returns, refunds, payments, privacy, terms, reviews, bidding and grievances — in words that match what the store actually does
- **Status:** Draft
- **Domain:** cross-domain (content only)
- **Phase:** 10 — Discoverability
- **Verified:** 2026-10-14
- **References:** [trd.md](trd.md), [shopfront-feeds](../shopfront-feeds/), [contact-us](../contact-us/), [checkout-abandonment](../checkout-abandonment/), [shipment-lifecycle](../shipment-lifecycle/), [bidding](../bidding/), [product-reviews](../product-reviews/)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
A single page, `/policies`, with one section per policy and a link to each section, reachable from
every page on a phone and on desktop.

## Why
Google Merchant Center and Meta reject a store with no return policy, contact details and terms
they can find, and Razorpay asks for the same. India's Consumer Protection (E-Commerce) Rules, 2020
require a marketplace to publish its legal name, address and a grievance officer. A buyer deciding
whether to pay a shop they have never heard of needs the same answers.

## Requirements
- R1 — Each policy has its own address on the page (`/policies#returns`), so a channel or a buyer
  can be sent to exactly one section.
- R2 — The page says only what the store does. Where the store has no feature (returns, cancellation,
  refunds are handled by a person over WhatsApp or email), it says how a person does it.
- R3 — The owner's decisions of 2026-10-14: returns within **7 days** of delivery; cancellation only
  **before the order ships**; refunds started within 2 business days and credited within **7 business
  days**, to the original payment method.
- R4 — The legal name, registered address, jurisdiction and grievance officer are stated once and
  shown wherever needed; until the owner supplies them they read as visible `[TO FILL]` markers.
- R5 — Reachable from the footer on desktop and from Contact us on a phone, where the footer is hidden.
- R6 — Listed in the sitemap; the page is public and indexable.

## Hazards the TRD must answer
- **A policy that drifts from the code is a promise we break** — the unpaid-order hold, the
  carriers, the payment methods. *Answered by D2.*
- **A blank legal field looks finished.** A missing grievance officer must be impossible to overlook.
  *Answered by D3.*

## Product acceptance
- A1 — On a 360px phone, Contact us shows a link to the policies, and the page reads as one column
  with a jump list at the top. *Verified manually.*
- A2 — `/policies#returns`, `#shipping`, `#privacy` and `#terms` each land on their section.
- A3 — The page states the 15-minute hold on unpaid orders, India-only shipping, Razorpay without
  cash on delivery, and the three timelines in R3.
- A4 — With no legal details filled in, the page shows `[TO FILL]` in the grievance section.

## Out of scope (this feature)
- A self-service cancel, return or refund flow — the page describes the manual process.
- Per-seller policies on a shop's own pages.
- Translations.
