# CLAUDE.md — subscriptions domain

- **Verified:** 2026-11-12
- **Covers:** `server/subscriptions/**`

> Read the project-wide rules first: [`/CLAUDE.md`](../../CLAUDE.md). Requirements are in [docs/specs/subscriptions/feature-access/](../../docs/specs/subscriptions/feature-access/); every decision is in its `decisions.md`.

## Purpose
What a shop may use of the paid features (Channels, Storefront, Image enhancement), and the one question every other domain asks: *may this org use this feature now?* Billing will later flip the same switches; it does not exist yet (feature-access Q21).

## Boundaries
**Owns:** `OrgFeature` (one row per shop and feature, written only by `org-feature.repository.ts`), the closed set `FEATURE`, and `FeatureLockedError`'s meaning. **Does not own:** what a feature does. Each domain refuses its own actions by asking `featureAccessService.assert`; public reads are filtered in `src/data-access-layer/`, so catalog and listing never learn about plans.

## Rules
- **It imports only `shared`.** Every domain calls it, so a single import the other way makes a cycle (feature-access D1).
- **An absent row is locked** (D3). Nothing writes a default row; every shop but the home brand starts locked.
- **The home brand holds every feature, with no read** (`homeBrandOrgId()`, Q13). The admin cannot switch it.
- **Never cached across requests.** A switch shows on the next screen, action or job (Q17).
- **A refusal is `FeatureLockedError`** (403, its `feature` key in the envelope's details), so a client knows which lock to explain.
- **Every org route and every paid job is classified** in `feature-registry.ts`, and `tests/unit/feature-registry.test.ts` fails one that is not (D9).
- **Nothing here knows about money.** No price, payment or plan beyond the three booleans.

## Structure
| Path | Holds |
|---|---|
| `feature-access.types.ts` | `FEATURE`, the DTOs, labels |
| `feature-access.service.ts` | `forOrg`, `can`, `assert`, `allowedOrgs`, `planFor`, `set` |
| `org-feature.repository.ts` | The one writer of `OrgFeature` |
| `feature-registry.ts` | Every org route method and paid job type, each with its feature or `core` and why |
