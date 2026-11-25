# Spec — subscriptions/feature-access

- **Summary:** The admin switches each paid feature (Channels, Storefront, Image enhancement) on or off per shop, and every screen, action, background job and public page honours it
- **Status:** Implemented — 2026-11-12, on `feat/feature-access`
- **Domain:** cross-domain: a new `subscriptions` domain owns the switches; channels, catalog (storefront), content (enhancement) honour them
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-12
- **References:** [decisions.md](decisions.md), ux.md (`3dc22ac5:docs/specs/subscriptions/feature-access/ux.md`), trd.md (`3dc22ac5:docs/specs/subscriptions/feature-access/trd.md`), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0044](../../../adr/0044-a-marketplace-orders-money-is-reported-not-computed.md), [setup-requests](../../setup-requests/spec.md), [shopfront-feeds](../../shopfront-feeds/)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
Three paid features, each a lock the admin opens or closes for one shop: **Channels**, **Storefront**
and **Image enhancement** (Q3). Everything else a shop needs to sell on Bhendi Bazaar stays free (Q2).

## Why
The plan is ₹699 a month for the whole suite (BACKLOG `subscriptions`). Before anyone can be charged,
a paid feature has to be something a shop can be without. Today every shop gets everything, and
nothing could take a feature away cleanly: a lock shown on a screen but not on its job, its route or
its public page is a lock in name only.

## Requirements
- R1 — The admin switches each of the three locks on or off for one shop, and sees which are on.
  Every switch is recorded with who and when (Q16). It takes effect on the next screen, action or job (Q17).
- R2 — **Channels** (Q4): when off, the shop cannot connect a marketplace, publish, sync stock, read
  listings or orders, appear in the Google or Meta feeds, or raise a channel setup request (Q19).
  Background work for the shop stops too, not only the buttons.
- R3 — Channels off leaves live marketplace listings as they are (Q9) and keeps saved connections
  renewed (Q11). Switching on resumes without reconnecting.
- R4 — The product form is the same whether Channels is on or off (Q5). Channel fields are asked
  and never required; readiness still shows what each channel lacks.
- R5 — **Storefront** (Q6, Q7): when off, the shop's members and the admin see the storefront as it
  is; anyone else on its link sees "not yet available". The storefront is absent from the store
  directory, the sitemap, "Sold by" links and search indexing. The shop can still build it (Q18).
- R6 — Storefront off never touches the shop's products on Bhendi Bazaar: product pages and checkout
  are unchanged (Q8).
- R7 — **Image enhancement** (Q12): when off, no new enhancement is accepted, by hand or
  automatically. Work already queued finishes; photos already enhanced stay.
- R8 — A locked feature's screens still open, so the shop sees what it is missing (Q20, Q28). Each paid
  action carries a lock and, on tap, names the feature, the price and Talk to us, which opens the
  contact sheet filled in (Q26). Nothing is disabled.
- R8a — **Every way in is locked** (Q29): each place a paid action can start, not only the feature's
  own screen (Improve while adding photos, Put on {marketplace} after saving a product, bulk actions,
  Share your shop). ux.md *Every way in* lists them.
- R9 — The home brand always has every feature on (Q13). Every other shop, existing or new, starts
  with all three locked until the admin switches them on (Q14, Q15).
- R10 — Switching off never deletes the shop's data: channel answers, storefront look, connections,
  photos. Switching back on finds everything as it was.
- R11 — `/business` offers Talk to us in the header and on the pricing card (Q30).

## Hazards the TRD must answer
- **A lock in name only:** a screen hidden while its route, job, feed or public page still works.
  Every way in (page, API route, background job, public output) needs an enforcement point, and a
  new one added later must not ship unclassified. *Answered by D5, D7, D8, D9, D10 (trd.md).*
- **Switched off mid-flight:** a publish, sync pass or feed fetch already running when the admin
  switches off. Q12 settles enhancement; channel work must stop at the next step, not half-write.
  *Answered by D8.*
- **Oversell (accepted, Q9):** listings stay up with stock frozen on the marketplace. The admin's
  switch-off must say so before it is applied. *Answered by D12 and ux.md's turn-off sheet.*
- **Cost:** a check on every org request and every job pass must not add a database read per call
  beyond one. *Answered by D6, D8.*
- **The leak through a side door:** a locked storefront still reachable via a cached page, the
  sitemap, a product page's "Sold by", or an old link shared on WhatsApp. *Answered by D10, D11.*

## Product acceptance
- A1 — On a phone, the admin opens a shop, switches Channels off, sees the warning that live
  listings stay up unsynced, confirms. On reload the shop's Channels screen opens with the plan banner
  and a locked Connect on every card; Put on Amazon on a just-saved product opens the locked sheet.
- A2 — With Channels off, the shop's products are absent from `/feeds/google.xml` and
  `/feeds/meta.xml`, no stock sync or listing read runs for it, and calling a channel route directly
  is refused with the standard error.
- A3 — With Channels off, the product form asks Amazon's fields, saves with them blank, and shows
  "Amazon: 2 missing". Switched on, the same product publishes without being edited.
- A4 — With Storefront off, a signed-out phone opening `/store/<handle>` sees "not yet available";
  the shop's owner sees the full storefront, and Share your shop opens the locked sheet; the shop is absent from `/store`, the sitemap and
  "Sold by", and its product pages still sell.
- A5 — With Image enhancement off, Enhance in the Library and Improve on a photo in the product form
  both open the locked sheet; a job queued just before the
  switch finishes and its photo appears.
- A6 — The home brand stays fully on whatever its switches say; every other shop present at release,
  and a shop created after it, starts with all three locked.
- A7 — On `/business`, Talk to us in the header and on the pricing card opens the contact sheet.

## Scope
- **Outcome:** the admin can lock or unlock each paid feature for one shop, and the lock holds everywhere.
- **In:** the switches and their record (R1, R9), the three locks end to end (R2–R7, R10), the locks on
  every way in (R8, R8a), Talk to us on /business (R11), the admin's switch screen (A1).
- **Later:** collecting payment (Q21), trials or tiers (Q22), the shop managing its own plan (Q23).

## Open questions
- Q15
