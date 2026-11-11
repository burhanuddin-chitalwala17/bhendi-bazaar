# Spec — navigation-flows

- **Summary:** Every feature starts somewhere, finishes back there, and an early exit goes back there too, one step at a time, without losing typed work
- **Status:** Parked (2026-11-12) — owner judged the full rule not needed yet; the listing fix loop (A1) and the address fixes shipped as fixes
- **Domain:** cross-domain (front end: seller portal, admin, store)
- **Phase:** 13 — Design system
- **Verified:** 2026-11-12
- **References:** [decisions.md](decisions.md), trd.md (to come), [ADR-0067](../../adr/0067-words-live-in-copy-modules-and-our-own-paths-in-one-routes-table.md), [ADR-0053](../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0015](../../adr/0015-mobile-first-design.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
One rule for moving through the platform: a person always knows how they got to a screen and how to
get back, and never loses work by leaving.

## Why
Most sellers are traditional shop owners, not technical people. When "Save" or "Back" lands them
somewhere they did not come from, they lose their place and stop trusting the tool. An audit of all
three surfaces ([audit.md](audit.md), 2026-11-10) found the same pattern everywhere: screens return to a fixed list
whatever opened them, nested tasks skip a step on the way back, ten screens have no way back except
the browser, and only the product form warns before throwing typed work away.

## Requirements
- R1 — **Every feature has a start.** The screen that opened it. A screen opened with no known start
  uses its natural parent (Q6).
- R2 — **Finish returns to the start** with a toast naming what happened (Q2). Where a finish leads
  somewhere new by nature (checkout → the order), that page offers the way back.
- R3 — **Early exit returns to the start.** Header Back, Cancel, closing a panel, and the phone's back
  gesture all land in the same place (Q5).
- R4 — **Nested features unwind one step at a time** (Q1). A → B → C: leaving C lands on B, still as B
  was; leaving B lands on A.
- R5 — **The start comes back as it was left:** its filters, search, tab, page and open panel (Q7).
- R6 — **No dead ends.** Every screen shows a way back on the screen itself, at phone width.
- R7 — **Typed work is never lost by accident** (Q3, Q11). Leaving a page, dialog or sheet with unsaved
  changes asks "Leave without saving?"; with nothing changed it leaves at once.
- R8 — **Only our own addresses.** A start passed in a link is followed only if it is a page of ours (Q12).
- R9 — **Sign-in returns to the page and the action.** Signing in from a page lands back on it, with
  typed work kept; signing out of a public page stays on it (Q10).

## Product acceptance
Judged on a phone (~360px) first.
- A1 — From the marketplace listing screen: Fix → Edit product → Save lands back on the listing screen,
  and its Back lands on the Listings page with the same filter showing.
- A2 — From a filtered, paged admin orders list (and separately from Pickups, Refunds and a shop's
  Orders tab), open an order, then Back: each lands where it began, filters intact.
- A3 — Type into a form, then tap the browser back, the header Back, a menu link and Cancel: each asks
  "Leave without saving?"; Stay keeps the text. With nothing typed, none of them asks.
- A4 — Every screen listed as a dead end in the audit shows a Back control at 360px.
- A5 — A link carrying `https://elsewhere.example` as its start returns to the natural parent instead.
- A6 — Admin "Add product for a shop": Save and Back both return to that shop.
- A7 — A guest who signs in from checkout keeps the address they typed.
- A8 — An automated check fails when a new form page offers no early exit or ignores its start.

## Scope
- **Outcome:** across the seller portal, admin and store, every feature finishes and exits back where it started.
- **In:** the rule and its gate (R1–R8, A5, A8); seller portal screens (A1, A3, A4); admin screens (A2, A6);
  store and sign-in (R9, A7).
- **Later:** buyer returns and refunds (Q13); marketplace read and sync wording (Q14).

## Open questions
Q8, Q9.
