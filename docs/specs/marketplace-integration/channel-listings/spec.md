# Spec — channel-listings

- **Summary:** Each product's Amazon and Flipkart listing has its own screen: it inherits the product, keeps only what differs, locks what must match, and shows what the marketplace has beside it
- **Status:** Implemented
- **Domain:** channels, with catalog (the product's new fields) and listing (readiness)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-02
- **References:** [decisions.md](decisions.md), parent [marketplace-integration](../spec.md) (Q19, Q21–Q29, Q39), [marketplace-publish](../marketplace-publish/spec.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md) "Editing and creating a listing", [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. The technical approach was trd.md, removed once shipped (ADR-0073): `git show 431ed6e7:docs/specs/marketplace-integration/channel-listings/trd.md`. Subfeature 6 of
> marketplace-integration; marketplace-publish (8) sends what this one prepares.

## What this feature is
A product's page shows, for every connected marketplace, its listing there. Opening it shows the
listing as that marketplace will get it: the product's own title, price, photos and text unless the
shop has changed them for that marketplace, the fields that must match everywhere, and what the
marketplace shows now.

## Why
Today the "On marketplaces" block is read-only, and every title, photo or price change on Amazon is
made in Seller Central. Each marketplace rewards different content, so the shop needs to say "shorter
title on Flipkart, ₹50 more on Amazon" once, here, without describing the product again (parent Q21).

## Requirements
- R1 — Every linked listing has a screen with the six listing fields (Q3), each either the product's
  (inherited) or the listing's own (changed), and saying which (Q8).
- R2 — A changed field can go back to the product's value, alone or all at once (Q8).
- R3 — Strict fields are shown and locked, explaining where they are edited (Q10, parent Q28).
- R4 — Where the marketplace's copy differs from ours, it is shown under the field and can be taken
  into the listing (Q9, parent Q39).
- R5 — Fields a marketplace does not let us write show the marketplace's copy and say where to
  change it; ours can be copied (Q4).
- R6 — When this ships, each linked listing keeps what is live wherever it differs from the product,
  so the first look shows nothing waiting (Q2).
- R7 — The product gains up to five key features and a barcode, asked on the product form (Q6).
- R8 — Saving a listing never sends it; the screen and the product say how many changes wait (Q15).
- R9 — Photos are chosen and ordered from the product's photos; marketplace photo and length rules
  warn and never block (Q11, Q12).
- R10 — A later change to the product flows into every listing that inherits that field, and shows
  as a change waiting on each.

## Hazards the TRD must answer
- **The first look rewriting a marketplace:** a listing with no own values would send the product's
  title over Amazon's on its first publish (Q2). *Answered by D3.*
- **Two editors:** the shop editing a listing while a read updates "On Amazon now" must not lose
  either. *Answered by D2, D4.*
- **An override outliving its reason:** a field changed long ago keeps differing silently. *Answered by D5.*
- **A strict field sneaking into a listing** through a request. *Answered by D2.*

## Product acceptance
- A1 — On a phone, the shop opens a product, taps "Edit Amazon listing", changes the title, saves;
  the title reads "Changed for Amazon" with the product's title under it, and "1 change waiting".
- A2 — "Use product's" puts the product's title back and the chip reads "Same as product".
- A3 — Tapping MRP says it is set on the product and links there.
- A4 — After shipping, a listing whose Amazon price differs from the product shows Amazon's price as
  its own and nothing waiting.
- A5 — On Flipkart's screen, the title shows Flipkart's with "Change it in Flipkart Seller Hub" and
  "Copy ours"; price can be changed.
- A6 — Changing the product's description shows "1 change waiting" on every listing that inherits it.
- A7 — Amazon's current title, when different, shows under the field; "Use Amazon's" makes it the
  listing's own.

## Scope
- **Outcome:** each product's marketplace listing is shown and edited here, inheriting the product.
- **In:** R1–R10 for Amazon and Flipkart; the two new product fields.
- **Later:** Amazon search keywords (Q17); bulk editing (Q18).

## Open questions
None.
