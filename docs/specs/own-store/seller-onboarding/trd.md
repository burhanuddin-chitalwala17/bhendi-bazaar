# TRD — own-store/seller-onboarding

- **Status:** Accepted — 2026-10-30 (UX signed off 2026-10-30; all decisions closed)
- **Domain:** cross-domain — catalog (org, onboarding, locations, reviews), front end; reads analytics, channels, content, bidding
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-10-30
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), [org-profile trd](../org-profile/trd.md), [own-store](../spec.md) (Q12–Q14), [org-onboarding](../../multi-vendor-marketplace/org-onboarding/), [org-portal-chrome](../../multi-vendor-marketplace/org-portal-chrome/), [ADR-0016](../../../adr/0016-mobile-app-shell.md), [ADR-0034](../../../adr/0034-render-on-the-server-by-default.md), [ADR-0036](../../../adr/0036-a-files-reasons-to-change-are-a-decision.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0046](../../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md), [ADR-0048](../../../adr/0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0063](../../../adr/0063-every-public-route-is-classified-for-rate-limiting-in-one-registry.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach
One declared navigation list drives the tab bar, More and the sidebar. Home is a server page whose
sections fail alone. The setup list is the pure `deriveOnboarding` (`server/catalog/org-onboarding.types.ts`)
rewritten to five steps; the only new state is two timestamps on `Org`. In-place tasks reuse existing
routes. Renames are labels only: no URL changes, so no shared link breaks.

## Prior art
- Shopify: a self-ticking setup guide, dismissed per store on the server and reopenable; a phone bar
  of Home, Orders, Products, Store, More. Followed (Q6, Q23). Material and Apple cap a bottom bar at
  five, the rest behind More. Followed. Dukaan: live first, then share. Followed (Q19).
- The only new persistence is two nullable timestamps, a standard flag-with-date.

## Technical decisions
- **D1 — One navigation declaration (R5, R6, R11; Q7–Q10, Q22).** A new `PORTAL_NAV` beside
  `src/components/layout/OrgSidebar.tsx` declares groups (a closed set: Sell, Your shop, Grow, Money,
  Settings), items with label, icon, purpose line and which four are tabs. `PortalSidebar` gains
  optional groups, so the admin's flat list is untouched. Photos sits under Sell; Channels and
  Bidding under Grow (Q22). Only labels change: Dashboard→Home, Storefront→Shop page, Locations→Pickup
  addresses, Earnings→Money you'll receive, Library→Photos, What you sell→Brands and defaults.
- **D2 — Phone tab bar and More (R6; A3; Q28).** A portal tab bar, the same shape as
  `src/components/layout/mobile-tab-bar.tsx` (fixed at `bottom-tabbar`, hidden from `md:`). "More"
  opens the existing drawer in `PortalSidebar`, re-anchored to the bottom on a phone and rendering the
  grouped list from D1. The hamburger goes. Any page is therefore one tab or More plus one tap.
- **D3 — Shop hub (R8–R10; Q8).** New page `/org/[orgId]/shop`: link card with Share, then rows for
  Shop details (org-profile), Shop page, Pickup addresses and Reviews, each with a one-line status.
  Each row reads its own source and fails alone.
- **D4 — Create screen (R1; A1; Q21, Q27).** `/org/new` keeps its route and `POST /api/orgs` (already
  `ACCOUNT` in `src/lib/rate-limit/registry.ts`). The body is org-profile's three-field schema
  (org-profile D1). The link preview runs the server's own slug candidates (`server/catalog/org.handle.ts`)
  in the browser; the server picks the next candidate on a clash and Home shows the real link (Q27).
  Signed out opens the existing auth sheet, which returns here.
- **D5 — Five steps, derived (R3; A1, A6; Q2, Q3, Q19).** `deriveOnboarding` takes new facts: products
  on sale, an active location with a street address and contact name, logo and tagline, and
  `firstSharedAt`; it returns Q19's order, `doneCount` and `hidden`. Describe/sell and channel
  readiness go (Q4); Channels keeps its banner. The gatherer stays inside catalog.
- **D6 — Two timestamps (R3, R10; Q6, Q23).** `Org.setupHiddenAt` and `Org.firstSharedAt`, written
  by `orgRepository` with conditional updates, so a repeated tap writes nothing. Routes (`withOrg`,
  outside the public registry): `POST`/`DELETE /api/org/[orgId]/setup/hidden`, `POST …/setup/shared`.
- **D7 — Home (R2; Q5, Q14, Q22, Q24, Q25).** The page composes: greeting and link, "Needs you now",
  the setup list, "Your numbers". "Needs you now" is read by a new a new Home data-access module beside the org DALs,
  one try/catch per line, so a failed line shows its own retry. Lines: parcels to pack (the existing
  `pending-parcels` widget's count); reviews in the last 7 days (a new count in
  `server/catalog/review.service.ts`); the first channel attention item (`channelsDAL.attention`);
  photo improvements awaiting a decision (a new count in `server/content/enhancement.service.ts`); a
  live auction ending within 24 h (`biddingService.listForOrg`). Zero hides a line; all zero hides
  the section. Numbers stay `DashboardWidgets`, or Q14's line before a paid order; Refresh re-renders.
- **D8 — Return to Home (R7; A2).** A task opened from the setup list carries `from=home`, parsed
  against a closed set (`RETURN_TO`) and never read as a URL, so it cannot become an open redirect.
  On save the task goes to `/org/[orgId]?done=<step>` and Home shows the toast with the new count.
  Product-form's save honours it; whichever unit lands second wires it.
- **D9 — Hints and "?" (R4, R5; A5; Q11).** All hint copy and page purpose lines live in one module
  beside D1. `PageHeader` gains an optional help key that renders "?". A hint opens only on a tap,
  has 1–3 cards, restarts at card 1, and its last card starts the task.
- **D10 — A hand-off surface (Q12; ADR-0040 case 4).** A new a new hand-off sheet among the shared overlays:
  a bottom sheet on a phone; from `lg:` a popover (hint, share) or a 28rem side sheet (address).
  One `MAY_USE_SHEET` entry covers the hint, share and pickup-address flows.
- **D11 — Pickup address over a form (R8; A4; Q12, Q26, Q29).** A `PickupAddressSheet` wraps the
  existing `location-form.tsx`, `orgLocationSchema` and `POST /api/org/[orgId]/locations`, and hands
  the new location back selected. The opener stays mounted, so typed values survive. A duplicate
  name is a `ConflictError` (Q29). Openers: product form (wired by product-form, Q26), Shop hub, parcel.
- **D12 — Reviews in context (R9; Q13).** The portal product page gains a Reviews section from the
  existing `reviewsDAL.firstPage`. The Home line goes to that product when the new reviews share one
  product, otherwise to Reviews.
- **D13 — Share (R10; A2).** A `ShareShopSheet` built on `src/hooks/core/useShare.ts`. The link comes
  from `appUrl()`; WhatsApp is a `wa.me` link with the copy-deck message. The first tap calls the
  shared route (`useMutation`; a failure is silent, the next tap retries). The preview is the store's
  Open Graph metadata. Opened from Home, the hub, and after the first product (D8).
- **D14 — Renames and refusals (R11; A7).** The banner card title becomes "Banners"
  (`storefront-banners-manager.tsx`), the suspended page becomes "Your shop is paused", and seller
  copy says "shop". A copy test scans the portal for banned words; org-profile U5 extends it.

## Hazards
| Hazard | Answer |
|---|---|
| The create form asks eight things | Answered by D4 (with org-profile D1) |
| The onboarding card's steps are not the shop's steps | Answered by D5 |
| Dead ends (pickup address, reviews) | Answered by D11, D12 |
| Two things called promotions | Answered by D14 |
| Phone navigation is a drawer | Answered by D1, D2 |

## Packages
None.

## UI approach
Screens, states and copy come from [ux.md](ux.md).
- **Phone (~360px):** tab bar and More (D2); Home in one column (greeting, needs-you, setup list,
  numbers); actions are 44px+ rows; hand-off flows are bottom sheets (D10). **`md:`** shows the
  icon-rail sidebar (labels on focus and hover, never the only affordance), no tab bar, and Home's
  list beside needs-you. **`lg:`** shows the full grouped sidebar, numbers 4-up, hints and share as
  popovers, and the address as a side sheet.
- **Rendering:** every page and the layout are server components. Client leaves are the tab bar, the
  sidebar, the setup-list actions, the hint, share and address sheets, the create form and the
  "Updated" leaf.
- **Behaviour:** `setupApiClient.ts` (hide, unhide, shared) with `useMutation`; create via
  `orgsApiClient.create` and `useServerForm`; address via `orgLocationsApiClient` and `useServerForm`.
  DTOs: `OnboardingStatus`, `HomeAttentionDto`, the existing `OrgLocationDto` and `ReviewPageDto`.
- **Surfaces:** D10 only; no new tokens.

## Gates touched
`route-reachability` and `portal-boundary` (three `withOrg` routes, called by `setupApiClient`);
`rate-limit-registry` unchanged (no new public route; `POST /api/orgs` stays `ACCOUNT`); `overlay-surfaces`
`MAY_USE_SHEET` gains `handoff-sheet.tsx` under case 4; `file-cohesion` `RECORDED` gains `home.dal.ts`
(catalog, analytics, channels, content, bidding: "Home's one job is to ask each area whether it needs
the seller"); `one-repository` (Org writes via `orgRepository` only); `rendering-strategy`, `form-factors`, `ui-primitives`.

## Data model
| Unit | [MIGRATION] |
|---|---|
| U3 | `Org.setupHiddenAt`, `Org.firstSharedAt` (nullable, no backfill; additive, nothing rewritten or dropped) |

## API / contract changes
[CONTRACT] U3: `OnboardingStatus` (five steps, `doneCount`, `hidden`; readiness removed); the
`setup/hidden` and `setup/shared` routes. The create body is org-profile U1's contract.

## Test plan
Per [TESTING.md](../../../TESTING.md); every new guard is mutation-tested and recorded.
- **Unit:** `deriveOnboarding` for each step's fact and Q19's order (A1, A6); `PORTAL_NAV` lists every
  `(org)` page route exactly once, has four tabs plus More, and every item has a purpose line (A3, R5);
  `RETURN_TO` refuses anything outside its set; the copy test (A7).
- **Integration:** hide, unhide and shared are idempotent under double calls; a duplicate pickup
  name is refused; a new review counts on Home and a withdrawn one does not.
- **Component:** no hint, sheet or modal opens on first render of Home (A5); the product form keeps
  typed values across the address sheet's success and error (A4); create shows the link preview (A1).

## Delivery (PRs)
| Unit | Closes | Migrates | Contract |
|---|---|---|---|
| U1 Navigation shell, Shop hub, renames | R5 (lists), R6, R11, A3, A7; D1–D3, D14; Q22 placement | no | no |
| U2 Create screen (after org-profile U1) | R1, A1; D4 | no | no |
| U3 Home, setup list, return-to-home | R2, R3, R7, A1, A6; D5–D8; Q22 Home lines | yes | yes |
| U4 Hints and "?" | R4, R5, A5; D9, D10 | no | no |
| U5 Pickup address sheet, reviews in context | R8, R9, A4; D11, D12 | no | no |
| U6 Share | R10, A2; D13 | no | no |

Every unit changes behaviour.

## Open questions
None. Q23–Q29 are Claude · reversible.
