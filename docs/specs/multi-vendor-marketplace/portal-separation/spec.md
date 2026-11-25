# Spec — portal separation

- **Summary:** Three route groups for three audiences, and one authorization model that tells them apart
- **Status:** ✅ Implemented; requirements below were held to
- **Domain:** cross-domain
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-08
- **Depends on:** organisations-and-membership
- **References:** [../spec.md](../spec.md), ../data-model.md (`5ecf1cac:docs/specs/multi-vendor-marketplace/data-model.md`)

> Requirements and product approach only. Its trd.md was removed once shipped (ADR-0073): `git show 431ed6e7:docs/specs/multi-vendor-marketplace/portal-separation/trd.md`.

## What this feature is

Three route groups for three audiences, and one authorization model that tells them apart.

## Why it is separate

The largest subfeature: 15 pages and 22 handlers move or split, and the single `role` check in `src/middleware.ts:114` becomes three questions. `431ed6e7:docs/specs/multi-vendor-marketplace/portal-split.md` is its working inventory.

## Requirements (provisional)

- **R1** — Signing in lands on the storefront; the selling portal is reached deliberately.
- **R2** — An org-scoped page states its organisation in the URL, and a request for an organisation the person does not belong to is refused.
- **R3** — Membership is checked against the database on the request, not read from a token minted at sign-in.
- **R4** — Every page and handler in `431ed6e7:docs/specs/multi-vendor-marketplace/portal-split.md` ends up in the group that document assigns it.
- **R5** — Nothing under `/admin` filters by organisation, and nothing under `/org` reads across organisations.

