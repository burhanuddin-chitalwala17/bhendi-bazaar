# TRD — own-store/org-profile

- **Status:** Implemented — 2026-11-01 (units 1–5; accepted 2026-10-30, UX signed off 2026-10-30)
- **Domain:** catalog (Org, OrgProfile); notifications (one email)
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-11-01
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), [seller-onboarding trd](../seller-onboarding/trd.md), [storefront-themes](../storefront-themes/spec.md), [seller-profile trd](../../seller-profile/trd.md), [brand-page](../../seller-profile/brand-page/), [ADR-0003](../../../adr/0003-one-repository-per-aggregate.md), [ADR-0013](../../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0021](../../../adr/0021-audit-trail-never-fails-the-action.md), [ADR-0030](../../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md), [ADR-0035](../../../adr/0035-every-response-carries-a-nonce-based-csp.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0046](../../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0063](../../../adr/0063-every-public-route-is-classified-for-rate-limiting-in-one-registry.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach
A new Shop details page writes the shop's facts one section at a time, through a new
a new shop-details service in server/catalog. Profile columns go through `orgProfileRepository`; name,
mobile and email go through `orgRepository`. The storefront editor keeps only looks until
storefront-themes replaces it. Text that merges or leaves the page is never rewritten or dropped
at deploy. The old columns stay, buyers stop seeing them, and the shop's own save carries them
forward.

## Prior art
- Shopify's store details: store name and contact email the merchant edits, legal and billing asked
  apart. Etsy has one "About" story per shop. We follow both (Q2, Q4, Q9).
- Optimistic concurrency, as with HTTP `If-Match`: a write carries the version it read, and a miss is
  a conflict. Followed (Q21).
- Expand-and-contract, or parallel change: add the new shape, stop reading the old, and drop only
  later with consent. We follow it to the expand step only. Nothing is dropped here.
- Gap found in our code: `storefrontService.saveSettings` nulls every field it is not sent. A
  per-section save over it would wipe the other sections. D3 fixes it in this change.

## Technical decisions
- **D1 — Create asks three things (R3, R6; A1; Q2, Q3, Q22).** A new `openShopSchema` (name, required
  mobile from any country through the shared `phoneSchema`, email; Q26) in `src/lib/validation/schemas/org.schema.ts` is what `POST /api/orgs`
  parses. Its registry entry (`ACCOUNT`) is unchanged. Contact person, business name, GST, PAN and
  description are no longer accepted there. The admin's `createOrgSchema` and form stay (Q22), and
  so do the columns.
- **D2 — One page, two parts (R1, R2, R10; A2; Q5, Q11–Q14).** `/org/[orgId]/shop/details` is a server
  page reading a new `ShopDetailsDto`. Its parts are headed "Buyers see this" and "Only Bhendi Bazaar
  sees this", with the eye icon on each field. Essentials (name, logo, tagline) come first. Optional
  rows collapse under "Add more to your shop page". The tax card is static copy (R6). "See as a
  buyer" opens `/store/[handle]`.
- **D3 — Per-section save, no clobbering (R9; A6; Q17, Q21).** `PATCH /api/org/[orgId]/shop/details`
  parses `shopDetailsSectionSchema`, a union on `section`: essentials, about, place, person, social,
  promise. Each section whitelists only its own fields and carries `expectedUpdatedAt`. The repository
  writes those columns only, by `updateMany` on (orgId, updatedAt). A count of 0 is a `ConflictError`
  carrying the ux "Someone changed this" copy. Every field is optional, so a blank never blocks a
  save. In the same unit, `storefrontSettingsSchema` and `saveSettings` shrink to looks (cover,
  accent, hidden sections), so two editors never write one column.
- **D4 — "About your shop" without loss (R4; A5; Q4, Q18).** `OrgProfile.storyMergedAt` (nullable). A pure
  `aboutOf` in `server/catalog/storefront.types.ts` returns `description` alone once merged, or when
  there is no story. Otherwise it returns the introduction, a blank line, then the story; empty
  halves are skipped. The buyer page and the box both read it, so buyers see the same words from
  deploy. The box opens prefilled, with "We joined your introduction and longer story. Check it and
  save." The about save writes `description` and stamps `storyMergedAt` in one statement. `story` is
  kept, never shown again and never dropped. A joined text over 4,000 letters shows the counter and
  refuses only the about save; the old column is still there.
- **D5 — "How you work" retired, kept (R7; Q6).** `pillars` leaves every input schema and the buyer
  DTO. The column and its data are untouched. "Why buy from us" is storefront-themes' (its R8, Q21).
- **D6 — Delivery and returns (R2, R7; Q7, Q19).** `OrgProfile.returnsPreset` is a closed set
  (`RETURNS_PRESET`: standard, 7-day exchange, no returns; default standard), plus `promiseNote` of
  up to 280 letters, saved in the promise section. Buyers stop seeing `deliveryPolicy` and
  `returnsPolicy` from U2. The columns are kept, and the shop sees its old text read-only beside the
  presets with "Copy into note". Dispatch time is derived, not asked (Q19). Buyers see "This shop's
  terms" only for a non-standard preset or a note; the standard promise alone is the platform's (Q27).
- **D7 — Name, mobile, email, link (R5; A3; Q15, Q16, Q23, Q25).** `PATCH /api/org/[orgId]/shop/contact`
  (`withOrg`, owner-only like the handle route) parses `shopContactSchema` (name, mobile, email,
  `expectedUpdatedAt`). The write is conditional on `Org.updatedAt`. Order emails read
  `orgRepository.findEmailContact` and the shop page reads `Org.name`, so both use the new values at
  once (A3). An email change audits (ADR-0021) and enqueues an `org.email-changed` job in the same
  transaction with the old address. Its notifications handler is idempotent on the job id. The name
  sheet is client-only. The link row reuses `handle-change-dialog.tsx` and its route.
- **D8 — Looks stay on Shop page until themes (R7; A4; Q20).** The storefront editor keeps cover,
  hidden sections and banners. Accent shows the four existing values as unnamed swatches labelled
  "Colour". storefront-themes' editor replaces all of them.
- **D9 — Code hidden, copy swept (R8; A4; Q12, Q13).** `org-switcher.tsx` and the `/org` chooser stop
  rendering `Org.code`. seller-onboarding's portal copy test (its D14) gains A4's words and the old
  placeholders ("John Doe", "org@example.com", "ABC Traders Pvt Ltd"). The coupon prefix stays (Q28); the
  product form carries the code only as its upload folder (Q29).
- **D10 — Desktop preview (R10; Q24).** At `lg:`, a client leaf renders the storefront's own header and
  about components from `src/components/storefront/`, fed the form's current values, never an iframe.

## Hazards
| Hazard | Answer |
|---|---|
| One field, two names | Answered by D1, D4 |
| Two names nobody can tell apart | Answered by D1 (business name leaves the shop's forms, Q9) |
| Asked too early | Answered by D1 |
| No way to fix contact details | Answered by D7 |
| Raw and vague fields | Answered by D5, D6, D8, D9 |
| Private next to public | Answered by D2 (and the public selects stay allowlisted, see Gates) |

## Boundary with storefront-themes
org-profile owns the stored facts and their fields on Shop details: name, logo, tagline, "About your
shop" and its merge, area, the person, socials, returns preset and note, contact, and link.
storefront-themes owns theme, palette, hero and cover, banners, hidden sections, the claims, the
"Why buy from us" UI, and how every fact is drawn. Pillars are retired here (D5) and replaced there.
Its Q22 names a dispatch preset that Q19 treats as derived, so its TRD reconciles.

## Packages
None.

## UI approach
Screens, states and copy come from [ux.md](ux.md).
- **Phone:** one column. Each section is a card with its own Save. The name sheet uses `FormDialog`
  (a bottom sheet, centred from `md:`; ux says `lg:`, and the primitive's tablet switch is kept).
  Inputs stay at 16px. **`md:`** widens the fields. **`lg:`** puts the preview (D10) on the right.
- **Rendering:** the page is a server component. Client leaves are one form per section, the name
  sheet and the preview.
- **Behaviour:** `shopDetailsApiClient.ts` (section save, contact) behind `useServerForm` per section,
  reusing `orgsApiClient` (create) and `orgStorefrontApiClient` (handle, looks). DTOs: `ShopDetailsDto`
  (no code, GST, PAN or business name) and `BrandPageDto`.
- **Surfaces:** `FormDialog` only; no new tokens.

## Gates touched
`route-reachability` and `portal-boundary` (two `withOrg` routes, called by `shopDetailsApiClient`);
`rate-limit-registry` unchanged (no new public route); `request-body-parsing` (three new schemas);
`storefront-public-dto` (allowlist gains `returnsPreset`, `promiseNote`; `pillars` leaves the select);
`one-repository`; `jobs` registry (one job type, no schedule); `migration-drops` (none dropped);
`form-error-display`.

## Data model
| Unit | [MIGRATION] |
|---|---|
| U2 | `OrgProfile.storyMergedAt`, `returnsPreset` (enum, default standard), `promiseNote`, all additive. No text rewritten; `story`, `pillars`, `deliveryPolicy`, `returnsPolicy` and `Org.contactPerson`/`businessName`/`gstNumber`/`panNumber` are kept with their data |

## API / contract changes
[CONTRACT] U1: `openShopSchema` is the `POST /api/orgs` body. U2: `ShopDetailsDto` and
`shopDetailsSectionSchema`. `BrandPageDto.about` becomes `aboutOf`. `story` and `pillars` become
always null. `deliveryPolicy`/`returnsPolicy` become `returns: { preset, note }`.
`storefrontSettingsSchema` is narrowed to looks. U3: `shopContactSchema`.

## Test plan
Per [TESTING.md](../../../TESTING.md); every new guard is mutation-tested and recorded.
- **Unit:** `aboutOf` over every case (A5): both, either, blank, merged; the section schemas refuse
  each other's fields, code, GST and pillars (Invariant 4); `openShopSchema` accepts exactly three
  fields (A1); `prisma/schema.prisma` still declares every kept column (Q4, Q6 guard); the copy scan (A4).
- **Integration:** a stale `expectedUpdatedAt` conflicts; saving one section leaves the rest intact
  (Q17); staff are refused contact edits; an email change enqueues exactly one job; after a name
  and mobile change, the order email contact and the brand page carry the new values (A3).
- **Component:** every field shows its "who sees this" line (A2); an all-blank save succeeds (A6).

## Delivery (PRs)
| Unit | Closes | Migrates | Contract |
|---|---|---|---|
| U1 Create cut to three fields | R3 (create), R6, A1; D1 | no | yes |
| U2 Shop details, buyer part; storefront editor narrowed | R1–R4, R7 (facts out), R9, R10, A2, A5, A6; D2–D4, D6, D10 | yes | yes |
| U3 Private part: name, mobile, email, link; tax card | R5, R6, A3; D7 | no | yes |
| U4 Looks: pillars retired, accent swatches | R7, A4 (Accent, blocks); D5, D8 | no | yes |
| U5 Copy sweep, code hidden | R8, A4; D9 | no | no |

Every unit changes behaviour. U1 lands before seller-onboarding U2, which renders this schema.

## Open questions
None. Q17–Q25 are Claude · reversible.
