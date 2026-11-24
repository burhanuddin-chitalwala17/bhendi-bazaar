# TRD — <feature>

- **Status:** Draft
- **Domain:** …
- **Phase:** …
- **Verified:** YYYY-MM-DD
- **References:** spec.md, the spike, ADRs

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
The chosen approach, and what makes it the right shape.

## Prior art
Required when this introduces a new persistence shape, data model, integration pattern, or
concurrency or caching strategy; "None — no new model" otherwise. Name what the field does, with
a source, and say whether we follow it. A departure is allowed and is argued here. **An existing
pattern in this repository is evidence, not authority** — consistency is a reason to match and
never a reason not to check ([ADR-0046](../../../docs/adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md)).
If the check finds a pattern already in our code that is wrong, say so here, and either fix it in
this change or record why it stays.

## Technical decisions
- D1 — decision + rationale (+ reference).

## Packages
New dependencies, cross-referenced to DEPENDENCIES.md. "None" if none.

## UI approach
Only if the feature has UI, else "None". **Cite `ux.md` for screens, states and copy; do not redesign them here.** This section says how the signed-off UX is built. Rules: [src/components/CLAUDE.md](../../../src/components/CLAUDE.md).
- **Per form factor** ([ADR-0050](../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md)): the ~360px phone layout first (content order, primary actions, touch affordances), then what `md:` (tablet) and `lg:` (desktop) add. A TRD that describes only desktop is not done.
- **Rendering:** which parts are server components reading through the data-access layer, and which leaf earns `"use client"`.
- **Behaviour:** each request's `*ApiClient` and the hook that calls it (`useServerForm`, `useMutation`, `useAsyncData`); the DTO each component is handed.
- **Surfaces:** which primitives and overlays (ADR-0040) it uses, and any new token.

## Gates touched
Which source-scanning tests this change meets, and any allowlist entry it adds with its reason. That way the cost is seen at design time, not when a test fails. The common ones:
- a new domain → `PUBLIC_SURFACE` (module-boundaries);
- a new `CLAUDE.md` → `LIVING_DOCS` (docs-integrity);
- a new route → its caller and its portal guard (route-reachability, portal-boundary);
- a file reaching a third domain → `RECORDED` (file-cohesion);
- a sheet → `MAY_USE_SHEET` (overlay-surfaces);
- a new `prisma.<model>` write outside a `*.repository.ts` → `one-repository`;
- a listing fact or product-type change → `product-visibility` CENSUS.

"None" if none.

## Data model
Schema changes. Flag [MIGRATION]. "None" if none.

## API / contract changes
Touches docs/CONTRACTS.md? If so the PR carries [CONTRACT] and CONTRACTS.md moves in lockstep. "None" if none.

## Test plan
The tests that will exist when done, cross-referenced to TESTING.md.

## Delivery (PRs)
Small PRs, each independently verifiable. Say which one changes behaviour, and for each whether it is `after U<k>` or `independent` — the handoff is read from this list.

## Open questions
Q ids from decisions.md. All must be decided or parked before Draft → Accepted.
