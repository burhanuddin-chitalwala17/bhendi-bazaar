# TRD — seller-profile

- **Status:** 🔨 In progress — PR-151, PR-162, PR-175 (3 of 4)
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-09-27
- **References:** [spec.md](spec.md), [ADR-0003](../../adr/0003-one-repository-per-aggregate.md), [ADR-0032](../../adr/0032-records-people-authored-are-retired-not-deleted.md), [ADR-0033](../../adr/0033-a-domain-is-reached-through-its-public-surface.md), [org-storefront trd](../org-storefront/trd.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

The organisation row today holds both faces in one table (`prisma/schema.prisma`, `model Org`): contact, GST and PAN beside tagline, hero and policies. The split is made in the schema, not in the DTO: the public face moves to its own table, the listing context gets its own, and the storefront's read path is pointed at the public table alone. A leak then needs a join nobody wrote, rather than a field somebody forgot to strip. Brands become a small aggregate of their own, owned by the organisation.

## Technical decisions

- **D1 — Three tables, three repositories.** `Org` keeps identity, status and commercial terms. `OrgProfile` (one per org) takes every public-presentation column now on `Org` — tagline, hero, accent, description, delivery and returns policies, logo — plus story, public location and social handles. `OrgListingDefaults` (one per org) holds default origin, tax rate and tax code per category. Each has exactly one repository ([ADR-0003](../../adr/0003-one-repository-per-aggregate.md)); `org.repository.ts` stops reading or writing the moved columns.
- **D2 — `Brand` is an aggregate owned by the org.** Name, manufacturer, packer or importer, default origin, `retiredAt`. Unique on `(orgId, name)`. No product references it yet: the link lands with families in [listing-schema](../listing-schema/), so this feature cannot be blocked on that model.
- **D3 — The storefront reads `OrgProfile` only.** `server/catalog/storefront.service.ts` and `src/data-access-layer/storefront.dal.ts` are re-pointed at the profile repository; the public DTO is built from `OrgProfile` columns and the org's name, handle and active flag. A test asserts the storefront DTO's key set against an allowlist, so adding a column to `Org` can never widen a public payload.
- **D4 — One migration moves the columns and backfills in the same statement set.** Create the two tables, copy the moved columns for every org, then drop them from `Org`. Rows are created for every existing org so no read path has to handle an absent profile. Flagged [MIGRATION]; applied on deploy per [ADR-0014](../../adr/0014-deploys-run-their-own-migrations.md).
- **D5 — Nothing here validates completeness.** Every new column is nullable except the brand's name. Readiness is computed by listing against a channel's rules ([listing-schema](../listing-schema/)); this feature exposes the facts and never judges them (spec R4, R5).
- **D6 — Retirement, not deletion.** `Brand.retiredAt`; the brand repository's list excludes retired rows by default and a retired brand stays readable by id ([ADR-0032](../../adr/0032-records-people-authored-are-retired-not-deleted.md)). Deleting a brand is not offered.
- **D7 — The brand and defaults services are the write seam the product flow will call, and they answer "what would this change" before they change it.** [product-form](../product-form/) asks for a fact at the point of need and writes it through `brand.service` or `org-listing-defaults.service`, never through its own repository ([ADR-0033](../../adr/0033-a-domain-is-reached-through-its-public-surface.md)). Each write path has a preview counterpart returning the target's name and the count of products it covers, so the form can show the spec R6 line before it commits; the product-only alternative is an override on the product, which is [listing-schema](../listing-schema/)'s resolver order at work.
- **D8 — Onboarding reuses the storefront editor.** The existing branding editor under the org portal (`src/app/(org)/`) becomes step two; step one is the org's creation, step three is a new listing-context screen holding brands and defaults. Each step saves independently through the same validated forms ([ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md)). The sequence itself is a card at the top of the org dashboard (`src/app/(org)/org/[orgId]/page.tsx`) showing each step's done state with a link into it, and beneath them a per-channel readiness through one seam (`server/catalog/org-onboarding.types.ts`): the store's is computed now from an active pickup location and a product on sale, the marketplace channels answer "unknown" until [listing-schema](../listing-schema/) computes them against each channel's rules, and once every step is done and the store is ready the card collapses to one line rather than disappearing.
- **D9 — A country of origin is an ISO 3166-1 alpha-2 code, picked from a searchable list, named by the runtime.** The codes are the closed set in `server/shared/countries.ts`; names come from `Intl.DisplayNames`, so no list of names is kept and a code is what a marketplace asks for. A database table was rejected: the set is a universal standard that changes about once a decade, and a table is the answer for a business-defined set such as where the shop ships to, which would be keyed by this code.

## Packages

None.

## UI approach

Phone first. Step three is a single column: a list of brands as cards, each showing name, maker and origin with a tap-to-edit sheet; an add-brand action; a defaults section beneath with origin, tax rate and a tax code per category the org has products in. Nothing is marked required. Origin is a searchable country sheet (D9). A change of which brand is the default is announced — the checkbox names the brand that would stop being it, and the save says which one did — and retiring the default warns first and says afterwards that none is set. Desktop adds a two-column layout with the brand list beside the editor. The storefront editor is unchanged. All controls through the primitives ([ADR-0031](../../adr/0031-one-components-home-organised-by-domain.md)).

## Data model

[MIGRATION] New `OrgProfile`, `OrgListingDefaults`, `Brand`; columns `tagline`, `heroUrl`, `accent`, `description`, `logoUrl`, `deliveryPolicy`, `returnsPolicy` move from `Org` to `OrgProfile`. `OrgListingDefaults.taxCodeByCategory` is JSON keyed by category id. `countryOfOrigin` on `Brand` and `OrgListingDefaults` holds the ISO code (D9).

## API / contract changes

[CONTRACT] The storefront's public org DTO is redefined from `OrgProfile`; `BrandDto` and `OrgListingDefaultsDto` are added for the org portal. [CONTRACTS.md](../../CONTRACTS.md) moves in lockstep.

## Test plan

Per [TESTING.md](../../TESTING.md): unit — public DTO key allowlist (mutation-tested by adding a private column and watching it fail), brand uniqueness per org, retired brands excluded from lists and readable by id; integration — the migration backfills one profile row per org and the about page's DTO is byte-identical before and after (spec A6); route — a member of one org cannot read or write another's brands.

## Delivery (PRs)

1. Migration, the three repositories, storefront re-pointed. No visible change; A6 proves it.
2. Brand and defaults services, portal step three. Behaviour change: sellers can describe what they sell.
3. Onboarding sequence and the seller-level readiness placeholder that [listing-schema](../listing-schema/) will fill.
4. The brand page — [brand-page](brand-page/), in its three parts. Behaviour change: every shop's about page becomes a landing page.

## Open questions

None. Closed 2026-09-26 by the owner: `contactPerson` stays on `Org`, private, until said otherwise. `logoUrl` cannot reference an asset before the asset table exists, so it moves to `OrgProfile` as a URL in PR 1, and [media-library](../media-library/)'s own backfill adds the asset reference later — the column moves once and the reference is added once, so nothing is done twice.