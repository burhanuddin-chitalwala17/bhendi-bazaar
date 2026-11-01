# Spec — own-store/seller-onboarding

- **Summary:** A shop created on a phone reaches its first shared store link from a task-based home, and finds every tool it needs without leaving the page it is on
- **Status:** Accepted
- **Domain:** cross-domain — catalog (org, onboarding facts, locations, reviews), analytics (home numbers), front end
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-10-30
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [own-store](../spec.md) (Q12, Q13, Q14), [org-profile](../org-profile/) (the fields this flow asks), [seller-profile](../../seller-profile/) (R5, R7), [org-onboarding](../../multi-vendor-marketplace/org-onboarding/), [org-portal-chrome](../../multi-vendor-marketplace/org-portal-chrome/), [ADR-0016](../../../adr/0016-mobile-app-shell.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md (written after UX sign-off).

## What this feature is
Vertical 5 of own-store. From "Create shop" to the first WhatsApp share in minutes: a short create
screen, a home that says what to do next, a setup list of five steps that tick themselves, hints
the seller starts, a phone tab bar, and tasks that finish where they start.

## Why
The owner: "dashboard is only stats; locations and reviews are almost done but navigation is bad,
we always have to leave pages." Sellers are traditional shop owners on a phone between customers.
A home of charts does not tell them what to do; a flat list of twelve links, behind a hamburger,
does not tell them where anything is; a product form that needs a pickup address it cannot create
sends them away and they do not come back. Research behind the shape: a task-based home (Shopify),
a checklist of at most five self-ticking steps, hints started by the seller (finished 3× more
than automatic tours, own-store Q12), store-live-then-share (Dukaan), plain words, 44–48px targets.

## Hazards this feature must close
- **The create form asks eight things**, three of them tax facts nobody needs on day one (Q14),
  and "Organisation Name" beside "Business Name" with no hint of the difference.
- **The onboarding card's steps are not the shop's steps.** "Describe your shop" and "Say what
  you sell" tick on a tagline or a brand; a shop with no product and no pickup address reads
  two-thirds done. Channel readiness for Amazon and Flipkart sits on day one's screen.
- **Dead ends.** The product form needs a pickup address and stock location; Locations is another
  page. Reviews live only on their own page, never beside the product they are about.
- **Two things called promotions.** The banner card on Storefront is titled "Promotions"; the
  sidebar's "Offers" lives at `/promotions`.
- **Phone navigation is a drawer.** Twelve items, ungrouped, one tap to open and a scroll to find.

## Requirements
- R1 — Creating a shop asks only the fields org-profile marks "asked at creation", on one screen
  that fits a 360px phone without scrolling, and lands on Home.
- R2 — Home is task-based, top to bottom: what needs the seller now (orders to pack, a channel
  needing attention, new reviews), the setup list while it is open, then the numbers.
- R3 — The setup list has five steps (Q2), each ticking itself from a fact the shop already has,
  shows "{n} of 5 done", can be hidden, and is reachable again from More.
- R4 — Every setup step opens a hint of one to three cards, started by the seller; its last card
  starts the task. Nothing opens by itself on first login (own-store Q12).
- R5 — Every portal page answers "what is this for?" in one tap, and every navigation item
  carries a one-line purpose where it is listed (Q11).
- R6 — The phone has a bottom bar: Home · Orders · Products · Shop · More (own-store Q13). More is
  a sheet of every other page, grouped and described. The desktop sidebar uses the same groups.
- R7 — A task started from Home or the setup list returns there when done, the step ticked and
  said so ("Pickup address added · 3 of 5 done").
- R8 — Anything a form depends on is created over it: a pickup address from the product form's
  stock field (a parcel never lacks one, Q31); the form keeps what was typed.
- R9 — Reviews are read where they matter: on the product in the portal and as a Home item when
  new; locations are reached from the stock field, the parcel and the Shop tab.
- R10 — Sharing is a first-class step: the link, "Share on WhatsApp", "Copy link" and "See it as
  a buyer sees it", from Home, the Shop tab and after the first product is saved.
- R11 — Names say what a page holds: one word per idea across the portal (Q7). Every target is at
  least 44px; no button in these screens is ever disabled (ADR-0053).

## Product acceptance
Judged on a ~360px phone first.
- A1 — A signed-in person with no shop creates one in under a minute and lands on Home showing
  "1 of 5 done".
- A2 — Following only the setup list, a seller adds a product, a pickup address, a logo and a
  line about the shop, and shares the link on WhatsApp without using the browser's back button.
- A3 — From any portal page, any other is at most two taps away on a phone.
- A4 — A seller with no pickup address adds a product: the address is created in a sheet over the
  form, comes back selected, and nothing typed is lost.
- A5 — First login shows no tour, popup or modal; every hint is opened by the seller and has at
  most three cards.
- A6 — The setup list ticks without the seller marking anything, hides on "Hide for now", and
  comes back from More → "Setup list".
- A7 — The word "Promotions" no longer names the banner card; nothing on these screens is disabled.

## Scope
- **Outcome:** a new shop reaches its first shared link from a home that tells it what to do,
  without leaving the page to finish a task.
- **In:** create screen (R1, A1); Home (R2, R3, A1, A6); hints and "?" (R4, R5, A5); tab bar,
  More sheet and grouped sidebar (R6, A3); return-to-home and in-place creation (R7, R8, A2, A4);
  reviews and locations in context (R9); share (R10); renames (R11, A7).
- **Delivery, six units:** 1 navigation shell and renames · 2 create screen · 3 Home and setup
  list · 4 hints and "?" · 5 pickup address sheet and reviews in context · 6 share.
- **Later:** user-started "Show me around" tour (Q20) · QR poster for the counter (Q15) · team
  page (Q16, [org-team](../../multi-vendor-marketplace/org-team/)) · payout details at first payout
  (Q17, org-profile Q9) · a "Pick your look" step once storefront-themes ships (Q18).

## Open questions
None — all decided; see [decisions.md](decisions.md).
