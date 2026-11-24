# TRD — social-selling/social-home

- **Status:** Accepted
- **Domain:** social (the shop card, composing public surfaces), analytics (the admin overview)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md) (A-D20), [ADR-0055](../../../adr/0055-an-admin-surface-reads-through-projections-and-writes-through-the-aggregates-one-repository.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
No table. The Home card is a server component that asks each owning domain for its one figure in
parallel, drops any that fail or are zero, and orders the rest by urgency. The admin overview is an
analytics read model over the same facts, counts only.

## Prior art
- **Dashboards that read each source's own number** rather than a copied metrics table: our admin
  dashboard (`server/analytics/`) does this. Followed (R6).

## Technical decisions
- **D1 — Figures (R1, Q1).** `socialHome.figures(orgId)`: `Promise.allSettled` over inbox
  `needsYouCount`, social `nextDue` and `publishedThisWeek` and `waitingForConnection`, automations
  `answeredThisWeek`, campaigns `spendThisMonth`, channels `setupNext` and `needsAttention`. A
  rejected or slow (>800 ms) figure is omitted, never shown as zero (ux Partial).
- **D2 — Order (R3).** Needs attention, Needs you, next setup step, then the rest; zero omitted;
  nothing → "All good" or the next step.
- **D3 — Lock (R4).** Without the plan the card renders the lock sheet copy (feature-access).
- **D4 — Admin overview (R5).** `analytics/social.admin.ts`: per platform connected shops, needing
  attention (with ids for links), onboarding count this week from `MetaOnboardingCount`, unrouted and
  dead events in the last day, uncertain and failed sends. Counts only; it can select no sealed
  column (A-D12 test).

## Packages
None.

## UI approach
ux.md's Home card (a server component, `home-card.tsx` in social's components, links via
`ROUTES`), and the admin section on the admin channels page. Words in `social-copy.ts`.

## Gates touched
analytics' read-only rule (it writes nothing); sealed-columns covers `social.admin.ts`.

## Data model
None.

## API / contract changes
Each domain exposes its one figure on its public surface.

## Test plan
- A failing figure is omitted, the rest render (A1 with a stub).
- Order and the setup-step button (A2).
- Admin counts from seeded rows; a needing-attention shop links to its connection (A3).

## Delivery
1. Figures and card (UI).
2. Admin overview.

## Open questions
None.
