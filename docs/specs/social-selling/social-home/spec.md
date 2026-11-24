# Spec — social-selling/social-home

- **Summary:** A shop sees on its Home, in one card, how selling on Instagram and WhatsApp is going and what needs it; the platform owner sees, on the admin channels page, which shops are connected and where something is going wrong
- **Status:** Accepted
- **Domain:** social, reading inbox, channels, campaigns and audience through their public surfaces; the admin view in analytics
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q2, Q8, Q110, Q111, Q113)

> Requirements and product approach only. Technical approach lives in trd.md. Built in step 7,
> when every figure it shows exists. Shows; never stores what another module owns.

## What this feature is
Two summaries. For the shop, one card on Home that answers "is this working, and what needs me?"
For the platform owner, an overview of every shop's connections on the admin channels page.

## Why
A shop judges a paid feature by what it sees each morning; five screens of numbers are seen by no
one. The owner needs to see a broken connection or Meta's onboarding limit before shops report it
(parent Q113).

## Requirements
- R1 — A shop with social selling on sees one card on its Home: conversations needing it, enquiries
  answered automatically this week, posts published this week and the next one due, this month's
  WhatsApp spend against its limit, and the setup steps left (parent Q111, Q113).
- R2 — Every figure opens the screen behind it, filtered to what it counts (Needs you opens the
  Inbox on Needs you).
- R3 — A figure with nothing to say is left out; with nothing at all, the card shows the next setup
  step instead.
- R4 — Without the paid lock open, the card shows what social selling does and the lock's sheet, as
  every locked feature does (parent Q8).
- R5 — The admin channels page shows, per platform: shops connected, connections needing attention
  (each openable), Meta's weekly onboarding limit used, and events failing in the last day (parent Q2).
- R6 — No figure is computed a second way: each is read from the module that owns it.

## Hazards the TRD must answer
- **Home slowing down** as five modules are asked for a number each.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — A shop with two conversations needing it and a post due at 6pm sees both on Home; tapping
  the first opens the Inbox on Needs you.
- A2 — A shop part-way through setup sees its next step as the card's button.
- A3 — The admin page shows one shop's WhatsApp as needing attention and opens it.

## Scope
- **Outcome:** shop and owner each see at a glance how social selling is going.
- **In:** R1–R6, tested by A1–A3.
- **Later:** sales per post or message (parent Q108).

## Open questions
None.
