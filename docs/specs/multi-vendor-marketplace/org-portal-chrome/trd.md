# TRD — org portal chrome

- **Status:** ✅ Implemented — PR-31
- **Domain:** cross-domain
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-09
- **References:** [spec.md](spec.md), [../portal-separation/trd.md](../portal-separation/trd.md), [CLAUDE.md](../../../../CLAUDE.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Two pieces: a switcher where the sidebar's static name was (`src/org/org-switcher.tsx`), and one
header shared by both portals (`src/components/layout/PortalHeader.tsx`). No new routes, no new data
shapes — the layout already had to know the membership; now it also shows it.

## Technical decisions
- **D1 — Switching is navigation, nothing else.** An org link is `/org/[id]` plus the current section, because the active org lives in the URL (programme decision, 2026-08-08). No cookie, no session write, no context provider — which is what makes A2 (two tabs, two orgs) true by construction rather than by care.
- **D2 — Switching preserves the section, not the record.** From one org's products you land on the other's products; a deeper path (a product id) is not carried across, because the record belongs to the org you are leaving.
- **D3 — One membership renders a heading, not a control** (R3). A dropdown with one option is a lie about the state space.
- **D4 — The header is a server component with one client leaf.** Identity comes from the session the layout already resolves; the only interactivity is sign-out, so `"use client"` is pushed down to `SignOutButton` ([CLAUDE.md](../../../../CLAUDE.md) — render on the server by default). The org layout fetches the membership list once, server-side, for both the check and the switcher.
- **D5 — The same `PortalHeader` serves `/admin`** (R5), with only the label differing. A second header is how the two panels drift.

## Packages
None.

## Data model
None.

## API / contract changes
None — no route moves, no DTO changes, no new endpoints.

## Test plan
Chrome is rendering over data already covered elsewhere: the membership list is `listOrgsForUser`
(PR-24), the boundary is `tests/unit/portal-boundary.test.ts` (PR-30). What would earn tests here is
behaviour, and there is none — the switcher is links, the header is text. A2 is guaranteed by D1
rather than asserted; if switching ever becomes stateful, that decision must bring its own tests.

## Delivery (PRs)
One PR (PR-31).

## Questions carried forward
- The storefront's account menu shows a static "Org Portal" entry to everyone signed in. Should it hide for buyers with no org and no intent to sell? Needs a per-render membership check on every storefront page — cost without a complaint to justify it yet.
