# Spec — bulk-publish

- **Summary:** A shop puts its whole range on a channel in one sitting: one screen shows what is ready and what needs a fix, grouped by problem, fixes are made many products at a time, and one tap sends everything ready, with each product's result where it always shows
- **Status:** Draft
- **Domain:** channels, with listing (readiness)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), [social-selling](../social-selling/spec.md) (Q102), [marketplace-publish](../marketplace-integration/marketplace-publish/spec.md), [readiness-fix](../channel-registry/readiness-fix/spec.md), [whatsapp-catalogue](../social-selling/whatsapp-catalogue/spec.md)

> Requirements and product approach only. Technical approach lives in trd.md. A sibling of
> social-selling (Q102), built in its step 2 for WhatsApp, Amazon and Flipkart together.
> Orchestrates what exists: readiness-fix's pages and marketplace-publish's create and send,
> whose implemented decisions it keeps.

## What this feature is
A "Put my range on…" screen per channel. It counts the shop's products as ready, needing a fix
(grouped by the fix) or already there; each group opens the page that fixes it for many products;
then Send puts everything ready on the channel and shows progress until done.

## Why
marketplace-publish already sends every pending change on a marketplace at once, but a product not
yet there is put on Amazon one at a time, and a shop with 300 products gives up. Doing the whole
range in one sitting, fixing many at a time, is what makes a new channel worth connecting.

## Requirements
- R1 — The screen opens from each channel's card and the Products page, and counts the shop's
  products for that channel: already there, ready, needs a fix, left out by the shop.
- R2 — Products needing a fix are grouped by the fix (no photo, photo too small, no description, a
  missing fact the channel asks), each group opening the page that fixes it for all of them, as
  readiness-fix already does for facts. Returning updates the counts.
- R3 — For Amazon, each product not yet there needs its page: one whose barcode matches a page on
  Amazon is suggested "Sell on this page", the rest "Create a new page"; families go as families.
  The shop can accept every suggestion in one tap or change any (Q2, marketplace-publish Q7, Q11).
- R4 — Before anything is sent, a review groups what will happen (new listings, changes, left out
  with why). Every product has a checkbox, the ready ones ticked; a group or any product can be
  unticked, and any opens to its full old-against-new view. Send sends only what is ticked (Q1,
  marketplace-publish Q2).
- R5 — Send runs in the background within each channel's limits; the screen shows progress, can be
  left and returned to, and each product's result appears on its listing as it always does.
  New Amazon pages pass Amazon's check-only mode first (marketplace-publish Q9).
- R6 — A product is never sent twice; running it again picks up only what is left.
- R7 — For WhatsApp, products are added automatically (whatsapp-catalogue), so the screen is the
  fixes: what is left out of the catalogue and why, fixed many at a time.
- R8 — For Flipkart, changes go as marketplace-publish sends them; a new product is still made in
  Flipkart Seller Hub, which the screen says (marketplace-publish Q12).

## Hazards the TRD must answer
- **Amazon's throttling** across hundreds of creates, and a send interrupted half-way.
- **A product edited during a send**: what was reviewed is what is sent.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — For a shop with 300 products, the Amazon screen counts 40 there, 180 ready, 80 needing a fix
  in four groups.
- A2 — Fixing "missing material" for 30 products on its page moves them to ready.
- A3 — Accepting every page suggestion and sending puts 180 products on Amazon, progress shown;
  each shows Sent, then Live or Needs attention on its listing.
- A4 — Running it again sends nothing already sent.
- A5 — The WhatsApp screen lists 12 products left out of the catalogue, grouped by why.

## Scope
- **Outcome:** a shop's whole range reaches a channel in one sitting.
- **In:** R1–R8, tested by A1–A5.
- **Later:** creating Flipkart products, once Flipkart's API allows it.

## Open questions
None.
