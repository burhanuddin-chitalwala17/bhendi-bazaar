# TRD — own-store/storefront-themes

- **Status:** Implemented — units 1–6, 2026-11-01
- **Domain:** catalog (storefront), promotions (one column, one read)
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-10-30
- **References:** [spec.md](spec.md), [ux.md](ux.md) (signed off 2026-10-30), [decisions.md](decisions.md), [org-profile trd](../org-profile/trd.md), [ADR-0064](../../../adr/0064-a-storefront-theme-is-a-token-set-and-a-section-composition-declared-in-code.md), [ADR-0016](../../../adr/0016-mobile-app-shell.md), [ADR-0018](../../../adr/0018-one-effective-price-function.md), [ADR-0022](../../../adr/0022-design-decisions-go-through-tokens.md), [ADR-0026](../../../adr/0026-images-are-delivered-through-the-optimizer.md), [ADR-0030](../../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md), [ADR-0035](../../../adr/0035-every-response-carries-a-nonce-based-csp.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0049](../../../adr/0049-colour-is-a-primitive-palette-read-through-semantic-tokens.md), [ADR-0058](../../../adr/0058-media-is-one-aggregate-a-derivative-is-lineage-not-a-use-and-usage-is-derived.md), [ADR-0063](../../../adr/0063-every-public-route-is-classified-for-rate-limiting-in-one-registry.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
A theme is a key into code: a CSS scope over the semantic tokens plus a composition, an ordered list
of sections each with its variant (ADR-0064, Q2). One section library renders all four themes; a shop
stores a theme key, a palette key and its content. Pages stay server components reading through
`src/data-access-layer/storefront.dal.ts`; prices still come from `resolveProductPrice`
(`server/promotions/price-context.ts`). An unthemed shop keeps today's pages until it publishes (Q19).

## Prior art
- **Shopify Online Store 2.0** ([shopify.dev/docs/storefronts/themes/architecture](https://shopify.dev/docs/storefronts/themes/architecture)):
  code ships sections with a settings schema, the merchant stores values, and the editor previews the
  live store in a same-origin iframe. We follow the split and the iframe preview; we depart with one
  section library instead of a codebase per theme (ADR-0064), no reordering (Q25), no colour or font
  settings (own-store Q15). **Dukaan / Instamojo:** templates plus a free colour; picker rejected (Q15).
- **Fonts:** build-time self-hosting, as the framework's loader documents. Followed.

## Technical decisions
- **D1 — The registry is code.** A new themes module in `server/catalog` declares the closed theme set
  (Edge, Darbar, Bloom, Daily; Q18) and per theme: three palette keys, the composition, card style, phone
  grid density (Daily 3-up, others 2-up), and the categories it is suggested for (Q19). Stored keys are
  parsed on read; an unknown key reads as unthemed.
- **D2 — Theme tokens.** Each `[data-theme]` scope in `src/app/globals.css` repoints role tokens: faces
  (display, body, label), type roles as `clamp()` with a rem floor (never viewport-only), tracking,
  section and gap spacing, store container, card and control radius, elevation, motion. An overridden
  token must reach its utility through a variable, so `--radius-card` leaves `@theme inline`. Every new
  token is registered in `cn`.
- **D3 — Palettes.** `[data-palette]` scopes repoint surface, text, border and primary tokens plus two
  new roles, `deal` and `feature` (Edge's one dot, Darbar's jewel fills, Bloom's pop), each with a
  foreground. New colours enter the primitive palette; a new family joins `FAMILY` in
  `tests/unit/design-tokens.test.ts` in the same change. Palettes are fixed light or dark (Q5): the
  `dark` custom variant excludes `[data-palette]` descendants, so shared `dark:` styles never fire there.
- **D4 — Contrast gate (Q16).** A new palettes unit test resolves each scope to primitives, converts
  OKLCH to sRGB and requires 4.5:1 for every text role on its ground and 3:1 for control edges; hero
  text sits on the scrim token, tested over white and black photos. Mutation-tested by lightening one
  primitive, recorded (ADR-0056).
- **D5 — Fonts (Q7, Q30).** One new module beside the storefront components loads, through the
  framework's Google loader, six families, two per theme at most: Edge Space Grotesk + Geist Mono,
  Darbar Jost + Cormorant Garamond, Bloom the root's DM Sans + DM Mono, Daily Mulish. Variable files,
  `latin`, `display: swap`, matched fallbacks, and **`preload: false`** — a layout otherwise preloads
  every font on every child route. Self-hosted, so the browser fetches only the faces the rendered
  theme uses, and CSP is unchanged: `font-src 'self'` (`src/lib/security-headers.ts`).
- **D6 — Routes (Q3, Q35).** `src/app/(store)/store/layout.tsx` stops drawing chrome; a new layout
  under `[handle]` resolves the shop (memoised) and draws themed or marketplace chrome. Themed:
  `/store/{handle}` is the landing page, `/shop` the goods, `/about` 308s to the landing page.
  Unthemed: today's pages, `/shop` 307s home. `resolve.ts` keeps retired-handle redirects per page;
  `src/app/sitemap.ts` lists `/shop` instead of `/about` for themed shops.
- **D7 — Themed chrome (Q6, Q33).** Header, tab bar (Home · Shop · Deals · Cart · More) and footer with
  the platform band, on the shared cart count and the `--tab-bar-h` utilities (ADR-0016). Links into a
  product add `?shop={handle}`; middleware forwards it as a header and the `(main)` layout draws that
  shop's chrome only if the product is the shop's; leaving that product refetches the tree (Q40). The
  canonical stays `/product/{slug}` (ADR-0030 D5).
- **D8 — Sections.** Q8's sections are server components under `src/components/storefront`; each takes
  a DTO slice and renders nothing when it is empty. A missing photo draws the theme's pattern (Q17) from
  tokens. The registry declares each section's variants, editor fields and hideability. One product
  card carries the four card styles as composition-selected slots.
- **D9 — One page DTO.** A new `StorefrontPageDto` in `server/catalog/storefront.types.ts`, assembled by
  `storefrontService`, serves themed pages; the DAL adds priced bestsellers and new-in, 8 each (Q23).
  Bestsellers are units in paid orders over 90 days via `orderService`, closing up under four (Q34).
  Proof keeps `server/catalog/brand-page-proof.ts` floors (Q15). Claims are keys from a per-category
  list in a new claims module in `server/catalog`, drawn apart from facts. Dispatch time is derived
  (median days to ready over recent paid orders) and omitted with no data; returns preset and note are
  org-profile's (Q22, org-profile Q19).
- **D10 — Deals (Q12, Q13, Q20, Q36).** A new `promotionService` read returns the shop's running
  automatic offers and the code offers it ticked, each with copy from one formatter in
  `server/promotions`, its end time, the code, and a few-left flag (no count). The DAL calls it, never
  `storefrontService`. Badges come only from `resolveProductPrice`; the Deals filter is the existing
  `offerOnly`, as `?deals=1`.
- **D11 — Publish (Q4, Q31).** `PUT` on a new `look` route under `/api/org/[orgId]/storefront` takes
  theme, palette and the look version the editor saw, and compare-and-sets on it; a miss is 409 with
  who and when, and "Publish mine anyway" resends at the new version. The previous look is kept 30
  days and a `revert` route restores it. `OWNER` only; both audited (ADR-0021). Content saves are live
  at once; only the look waits for Publish.
- **D12 — Preview (Q32).** A portal-guarded, `noindex` preview page under the org's storefront renders
  the same sections for requested keys, without portal chrome. Picker cards and the full-screen preview
  embed it in same-origin iframes, so each frame's width drives its breakpoints. On that path only,
  `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN`. A tapped section posts its key to the
  parent (origin checked). An empty shop previews labelled sample goods declared in code.
- **D13 — Editor (Q9–Q11, Q21, Q22).** One sheet per section, from the registry's fields, saving
  through `PATCH /api/org/[orgId]/storefront`. It builds on org-profile U2, which makes that save
  partial and conditional on the `updatedAt` the editor saw; a miss drives "Changed by {Name}". The
  schema gains a hero line, claims (≤3 keys, optional detail each), opening hours and hidden themed
  sections. Facts stay org-profile's; their sheets link to Shop details. Accent and pillars are no
  longer offered, stay stored, and unthemed pages still read the accent.
- **D14 — Images and motion.** `next/image` with real `sizes` and a per-variant aspect token (R11);
  Open Graph takes the hero's preview rendition; reduced motion zeroes every motion token.

## Hazards
| Spec hazard | Answered by |
|---|---|
| Forked components | Answered by D1, D8 |
| A deal checkout will not honour | Answered by D10 |
| Typed proof | Answered by D9 |
| Unreadable palettes | Answered by D4 |
| Trapped buyer | Answered by D7 |
| Live page changed without consent | Answered by D6, D11 |
| A finished look that only works with photos | Answered by D8 |

## Packages
None. The font loader ships with `next`.

## UI approach
Screens, states and copy as signed off in [ux.md](ux.md).
- **Phone:** themed app shell, docked tab bar, the theme's grid density; picker cards stacked, palettes
  swiped; preview full screen (`TaskDialog`, ADR-0040 case 2); section sheet from the bottom. **`md:`**
  2×2 picker, framed preview with controls beside, sheet as side panel. **`lg:`** 4 cards across, phone
  and desktop previews side by side, each theme's desktop composition.
- **Rendering:** pages, layouts, sections on the server. Client leaves: tab-bar active state, code copy,
  hero carousel (today's `HomeHero`), `PaginatedProductGrid`, picker, preview frame, sheets.
- **Behaviour:** `orgStorefrontApiClient.ts` publishes and reverts via `useMutation`; sheets use
  `useServerForm` against `storefrontSettingsSchema`. Props are DTOs (D9, D10).

## Gates touched
| Gate | What this adds |
|---|---|
| `design-tokens`, `cn-tokens` | Palette, font utilities, `FAMILY`; every new token in `cn` |
| new palettes contrast test | D4, mutation recorded; `storefront-accent` stays for unthemed shops |
| `overlay-surfaces` | Section sheet joins `MAY_USE_SHEET` as a side panel (ADR-0040 case 3) |
| `route-reachability`, `portal-boundary` | Two look routes, caller `orgStorefrontApiClient.ts`, `withOrg`; preview page `requireOrgMember` |
| Rate limits (ADR-0063) | **No new public route**: themed pages are pages; scroll and search reuse `GET /api/products` (exempt); look routes are under `/api/org`. `src/lib/rate-limit/registry.ts` gains no line |
| `one-repository` | New slot table gets its own repository; `Promotion` column written only via `promotion.repository.ts` |
| `file-cohesion` | `storefront.dal.ts` reaches only catalog and promotions, within the free reach of two: no entry |
| `security-headers`, `storefront-public-dto`, `image-delivery`, `form-factors`, `rendering-strategy` | Preview framing (D12); new DTO keys allowlisted |

## Data model
All additive, nullable or defaulted; no backfill, no drops.
| Unit | Change |
|---|---|
| U2 [MIGRATION] | `OrgProfile`: `themeKey`, `paletteKey`, `lookVersion` (Int, 0), `lookPublishedAt`, `lookPublishedByUserId` (Restrict, ADR-0020), `previousThemeKey`, `previousPaletteKey`, `previousLookUntil` |
| U4 [MIGRATION] | `Promotion.showOnStorefront` Boolean, default false (Q20) |
| U6 [MIGRATION] | `OrgProfile`: `heroLine`, `claims` (Json, parsed), `openingHours` (Json), `storefrontHiddenSections` (Json), `contentEditedByUserId`. New `OrgStorefrontSlot` (org, kind hero/collection, position, category?, asset?, both Restrict) so photo usage stays a query over a referencing column (ADR-0058); usage predicates in `server/catalog/media-asset.service.ts` gain it |

## API / contract changes
**[CONTRACT]** — `docs/CONTRACTS.md` moves with each: `Storefront` gains `themeKey`, `paletteKey`;
new `StorefrontPageDto`, `StorefrontOfferDto`, `StorefrontLookInput`; `StorefrontSettingsInput` gains
D13's fields; `PromotionFormInput` gains `showOnStorefront`.

## Test plan
| Test | Proves |
|---|---|
| Registry integrity | Compositions name real sections and variants; three palettes per theme; scope per palette and palette per scope; ≤2 families per theme; themes differ in ≥3 non-colour roles (A1) |
| Name-logo-one-product render, per theme | No empty image box; pattern drawn (A4) |
| Badge vs quote | Badge price equals `promotionService.quote` for the line; ended offer drops badge and card (A3, A6) |
| Schemas | No proof field accepted; claims outside the category list refused (A7) |
| Deals, publish | Code shown only when ticked (Q20); stale look version 409; `STAFF` 403; revert after 30 days refused |
| Routes, chrome | `/about` 308 themed, `/shop` 307 unthemed; foreign `?shop=` draws marketplace chrome; `dark` inert under `[data-palette]` |

## Delivery (PRs)
1. **U1** tokens, palettes, fonts, contrast gate — no visible change. *Implemented 2026-11-01.*
2. **U2** sections and compositions [MIGRATION] — nothing renders them yet. *Implemented 2026-11-01.*
3. **U3** themed chrome, landing/shop split, redirects — only themed shops, and none exist yet. *Implemented 2026-11-01.* Review fixes: shop error and loading states, best selling on-sale only, dispatch skips cancelled orders.
4. **U4** deals and badges [MIGRATION] [CONTRACT]. *Implemented 2026-11-01.* `storefront.dal.ts` reaches catalog and promotions only, within the free reach, so `file-cohesion` needed no entry. Review fixes: the deals strip counts only the shop's own offers (a platform offer adds nothing, R7, Q12); the badge's percent is floored so it never overstates (A3).
5. **U5** picker, preview, publish, revert [CONTRACT] — **changes behaviour**: a shop can publish. *Implemented 2026-11-01.* The preview lives in its own route group, `(preview)`, so the portal's chrome never wraps it; "Suggested", "Tap any part to change it." and "Add a photo" ship with U6's editor and suggestion. First publish keeps the unthemed page for switch back (Q42).
6. **U6** point-of-need editor and theme suggestion [MIGRATION] [CONTRACT] — after org-profile U2;
   ships to production with U5. *Implemented 2026-11-01.* "Category" for claims and the suggestion is the shop's main
   product type (Q44); a hidden section stays tappable in the preview only (Q43); hours are one span plus closed days
   (Q45). The usage relation lives in `media-asset.repository.ts`, where the others are. `contentEditedAt` (its own additive migration) lets Stale name the editor only when theirs was the last save; a category a shop shows as a collection cannot be deleted.

## Open questions
None. Q30–Q36 logged as `Claude · reversible`.
