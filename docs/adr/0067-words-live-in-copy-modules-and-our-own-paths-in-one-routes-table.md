# ADR-0067: Words live in copy modules, and our own paths in one routes table

- **Date:** 2026-11-05
- **Status:** Proposed

## Context

A scan on 2026-11-05 (owner: "no strings hard coded … easy modification and maintainability") found
about 1,500 pieces of user-facing text written inline across 360 front-end files, and 321 inline
paths to our own pages. The cost was visible the same day: the prototype's "The cloth" heading was
written into the product page as a literal and shipped on every product, a tote bag and bukhoor
included; finding every clothing-only word ("piece", "fit", "fabric") took a repository-wide grep.
Some areas already kept their words in one module (`home-copy.ts`, `portal-copy.ts`,
`channel-copy.ts`); most did not. Paths had no home at all: moving a page meant finding every
`/org/${orgId}/…` template by hand. Closed sets (statuses, roles) already have their rule
(ADR-0003 D5) and are not this decision.

## Decision

1. **Words a person reads live in a copy module beside the components that show them:**
   `src/components/<area>/<area>-copy.ts` (or the area's existing `*-copy.ts`), exported as one
   `as const` object per surface — strings, and functions for words with values
   (`welcome: (name) => …`). That covers JSX text, the copy props (`title`, `description`, `label`,
   `placeholder`, `aria-label`, `alt`…), toasts and confirmation dialogs. A page's own words go in
   its area's copy module, not in `page.tsx`.
2. **Our own pages' paths come from `ROUTES`** (`server/shared/routes.ts`): a constant for a fixed
   page, a builder for one with parameters (`ROUTES.org.products(orgId)`). It holds paths only, never
   an origin. It sits in `server/shared/` because emails and revalidation need it as well, and
   `server/` may not import `src/`.
3. **Not copy:** class names, test ids, closed-set values (their own constants), API paths (their
   `*ApiClient.ts`), external URLs, file names and MIME types, log messages, and a domain's
   `DomainError` text (its message belongs to the rule that throws it, and stays beside it). For the
   same reason a Zod schema's messages stay in its schema (`src/lib/validation/schemas/`: the one
   schema serves the form and the route, so the message already has one home), and a route
   handler's fallback error text stays in its handler (`src/app/api/**`) until a sweep of its own.
4. **Enforced absolutely.** `tests/unit/hardcoded-copy.test.ts` counts, per file, JSX text (after a
   tag or an expression), copy props, toasts, route literals and quoted sentences (copy in a ternary,
   an object or metadata) outside copy modules and `ROUTES`, and fails on any. It began as a
   ratchet (ADR-0056) over 1,837 items in 412 files and reached zero the day it was written, so its
   baseline was removed. The few files whose quoted words are deliberately not copy are named in
   its `SENTENCE_EXEMPT`, each with its reason.

## Consequences

- Rewording, a clothing-only word, or a renamed page is a change to one module, found in one place.
- Moving copy keeps every word byte-identical, so it changes no behaviour and no test.
- A copy module is also where translation would start, without committing to it now.
- The scanner is a heuristic: text it does not see (a string built across lines, an attribute it
  does not list) is caught by review, not by the suite.
