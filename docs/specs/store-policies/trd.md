# TRD — store-policies

- **Status:** Draft
- **Domain:** cross-domain (content only)
- **Phase:** 10 — Discoverability
- **Verified:** 2026-10-14
- **References:** [spec.md](spec.md), [ADR-0034](../../adr/0034-render-on-the-server-by-default.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
A server-rendered page in `src/app/(main)/policies/` that hands a `StorePolicies` component the few
facts that live in code. The copy is JSX in one component under `src/components/support/`, beside
Contact us, which is the same job: telling a buyer how to deal with the store.

## Prior art
None — no new model. A single policies page with anchored sections is how small Indian marketplaces
and Shopify's policy pages present this; Merchant Center accepts an anchored URL for a return policy.

## Technical decisions
- **D1 — One page, anchored sections, not one page per policy.** Fewer routes to keep in the sitemap
  and footer, and every channel asks for a URL, which an anchor satisfies (spec R1).
- **D2 — Facts that live in code are passed in, not retyped.** The unpaid-order hold is
  `ABANDONED_HOLD_MINUTES` (`server/payments/payment.service.ts`), exported for this and read by the
  page; support email and WhatsApp come from `src/lib/config.ts`. Carriers and payment methods are
  prose: there is one of each, and changing either is a change this page would be part of.
- **D3 — Legal facts are one constant, `LEGAL`, in `src/lib/config.ts`,** a static brand fact like the
  support email. An unset value is the literal `[TO FILL: …]`, rendered as it stands (spec R4).
- **D4 — Phone reach is a link in the Contact us sheet** (`src/components/support/contact-sheet.tsx`);
  desktop reach is the footer. The footer stays desktop-only (ADR-0016).
- **D5 — Indexed.** Added to `src/app/sitemap.ts`; nothing in `src/app/robots.ts` blocks it.

## Packages
None.

## UI approach
- **Phone:** one column in `PageShell` `narrow`; `PageHeader`; a wrapping list of jump links; each
  section an `h2` with an `id` and `scroll-mt` so the sticky header does not cover it. Links are ≥40px.
- **Tablet/desktop:** the same column, centred; nothing added.
- **Rendering:** server components only; no `"use client"`.
- **Surfaces:** no new primitive or token.

## Gates touched
None.

## Data model
None.

## API / contract changes
None.

## Test plan
Verified manually at 360px and desktop width (A1, A2, A4). A3 is checked by reading the rendered
page against the constants it is given; a test that the page contains its own copy would restate it.

## Delivery (PRs)
One unit, behaviour-changing: the page, the component, `LEGAL`, the export, the footer and sheet
links, the sitemap entry, CHANGELOG.

## Open questions
- The owner fills `LEGAL` before the page is registered with Google or Meta.
