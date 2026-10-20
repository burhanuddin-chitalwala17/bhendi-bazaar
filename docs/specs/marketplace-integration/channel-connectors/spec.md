# Spec — channel-connectors

- **Summary:** A shop connects its own Amazon and Flipkart seller accounts by consenting on the marketplace's own page, and sees on one Channels page where it sells and whether each connection is healthy
- **Status:** Accepted
- **Domain:** channels (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-20
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [trd.md](trd.md), parent [marketplace-integration](../spec.md) and its [decisions](../decisions.md), [ADR-0041](../../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#connecting-a-seller-what-the-two-apis-actually-do), TRACKER F-013, F-014

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 1 of
> marketplace-integration, and the trial of [ADR-0061](../../../adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md).

## What this feature is
A Channels page in the shop's portal. Each marketplace has a card with one button. The owner taps
Connect Amazon, signs in on Amazon, allows Bhendi Bazaar, and comes back connected. From then on
the card says, in plain words, whether the connection is healthy and what to do if it is not.

## Why
A marketplace is a channel only once the shop has authorised us to act for it
([ADR-0041](../../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)): an unconnected
marketplace is off. Every later subfeature (import, merge, listings, stock sync, publish) needs a
connection we can trust and credentials nobody can read. This builds that once, for both
marketplaces, and makes "where you sell" a fact rather than a setting.

## Requirements
- R1 — Any member of a shop connects Amazon or Flipkart from the Channels page, consenting on the
  marketplace's own page. We never ask for, see or store a marketplace password (parent Q9).
- R2 — A connection belongs to the shop and member that started it. A return from the marketplace
  that did not begin in that session, has expired, or was altered connects nothing.
- R3 — One shop per marketplace account (parent Q8). An Amazon account already connected to
  another shop is refused at once, with the reason. Flipkart does not say which account consented,
  so its check happens when listings are first read, in channel-import (Q2).
- R4 — Credentials are never shown, logged or returned to anyone, platform staff included. They are
  stored encrypted, under a key that can be replaced without anyone reconnecting (parent Q12).
- R5 — Each card shows its state in plain words: not connected, connected, renewal due, needs
  reconnecting (with the reason), unavailable; who connected it and when; and for Amazon, the
  date the yearly re-approval falls due, warned 30 days ahead in the app (parent Q10).
- R6 — A connection stays alive with nobody doing anything until the marketplace itself requires
  the seller: we renew what can be renewed, and say clearly when it cannot.
- R7 — A member can disconnect at any time, after confirming. The credentials are deleted, every
  call stops, and the card says how to revoke our access on the marketplace too.
- R8 — Where a shop sells is what it has connected (parent Q6). The Channels page replaces "Where
  you sell". The shop's own store is always on; Google and Meta, which need no account, connect
  with one tap (parent Q7).
- R9 — A connection that needs the seller (renewal due, needs reconnecting) is also shown on the
  shop's dashboard, once, with the action to fix it.
- R10 — A marketplace the platform has switched off, or whose limit is reached (Amazon allows 25
  shops while our app is unlisted, parent Q36), still answers the tap and explains why.

## Hazards the TRD must answer
- **Two renewals at once.** Flipkart replaces the renewal credential near its expiry; two
  simultaneous renewals can keep the old one and lose the new, disconnecting the shop silently.
  *Answered by D8.*
- **A connection that is never used can lapse.** Flipkart's renewal credential lasts 180 days.
  *Answered by D7.*
- **A forged or replayed return** connecting someone else's marketplace account to a shop.
  *Answered by D4.*
- **Reconnecting with a different account** than before: refused; switching is disconnect then connect (Q8).
  *Answered by D9.*
- **The encryption key leaks or is lost.** Replacement must not need every shop to reconnect.
  *Answered by D3.*

## Product acceptance
- A1 — On a phone (~360px), a member taps Connect Amazon, approves on Amazon, and lands back on the
  Channels page showing Amazon connected; the same for Flipkart.
- A2 — A return URL replayed in another browser, edited, or older than ten minutes connects nothing.
- A3 — Connecting an Amazon account already connected to another shop is refused with a reason.
- A4 — Every state in ux.md's matrix for the marketplace card can be reached and reads as written.
- A5 — Disconnect leaves the channel off, and no stored credential remains.
- A6 — Neither the database row, the logs nor any response contains a readable credential.
- A7 — "Where you sell" is gone from What you sell; Google and Meta turn on and off from Channels.
- A8 — Verified on the owner's own Bhendi Bazaar Amazon and Flipkart accounts before any other shop.

## Scope
- **Outcome:** a shop connects Amazon or Flipkart by consent and sees each connection's health.
- **In:** R1–R10.
- **Later:** reading and matching listings — channel-import (Q1); the admin view of connections (Q3);
  starting from Amazon's Appstore (parent Q36); email reminders (parent Q10).

## Open questions
None. Q5 decided by the owner 2026-10-20.
