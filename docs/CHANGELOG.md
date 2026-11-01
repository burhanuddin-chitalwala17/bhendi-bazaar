# CHANGELOG

## Format
- **Append-only.** Never edit an old entry; corrections go in as new entries.
- Newest entries at the top.
- Entry header: `## [PR-NN] YYYY-MM-DD — Short title`
- Add `[CONTRACT]` when a DTO in [CONTRACTS.md](CONTRACTS.md) changed — the signal that client and server must move in lockstep.
- Add `[MIGRATION]` when the PR includes a Prisma migration, so a deploy knows to run one.
- One entry per merged PR. Cross-domain changes are recorded here; domain-internal changes go in that domain's own CHANGELOG.

- **Archive:** entries older than the current month live in [changelog/](changelog/), one file per month (read only when you need history; never append there). This file holds the current month.

## Entries

## 2026-11-01 — Merge main into org-portal: one courier webhook, timeouts beside rate limits

- **Courier webhook:** main moved the old handler to `POST /api/webhooks/shipping/courier` with `SHIPROCKET_WEBHOOK_TOKEN`;
  order-fulfilment unit 4 had replaced it at `/api/webhooks/shipping/tracking` with `SHIPPING_WEBHOOK_TOKEN`. One route
  stays: unit 4's handler at main's path, reading main's variable. `/tracking`, `server/shipping/webhook-auth.ts`,
  `tests/unit/shiprocket-webhook-auth.test.ts` and `SHIPPING_WEBHOOK_TOKEN` are gone; the URL-words check moved into
  `tests/unit/courier-token.test.ts`.
- **Routes:** main's `optionalActiveSession` (suspended accounts refused) now feeds the rate limiter's user id in
  addresses, bids, payment abandon, the promotions quote, reviews and order creation; main's old order limiter is dropped
  for the registry's.
- **Startup:** `src/lib/env.ts` keeps main's longer required list and `missingEnv` (read by `/api/health?deep=1`) and the
  boot refusal of an unlimited deployed environment; the missing list is logged as main's `[startup]` error.
- **Timeouts:** the bulk sheet's create and marker calls, and `apiDownload`, carry deadlines like main's other calls;
  email keeps both main's deadline and the idempotency key.
- **Gates main added, met:** seven routes this branch had given a session read for the rate limiter now read it through
  `optionalActiveSession` (`tests/unit/blocked-session.test.ts`): six with `onBlocked: "allow"`, since the read only names
  the caller, and the buyer's parcel cancel refusing a suspended account. Main's `GET /api/health` is exempt in the
  registry as the uptime probe. zod 4.6 needed the storefront schema's two `distinct` keys typed.

## 2026-11-01 — storefront-themes unit 6: point-of-need editor and theme suggestion [CONTRACT] [MIGRATION]

- **Migration `20261101171600_storefront_content` (additive):** `OrgProfile` gains `heroLine`, `claims`, `openingHours`,
  `storefrontHiddenSections` (Json, parsed on read) and `contentEditedByUserId` (Restrict, ADR-0020). New
  `OrgStorefrontSlot` (org, kind HERO/COLLECTION, position; category and asset both Restrict) with its own repository
  `server/catalog/org-storefront-slot.repository.ts`, so a hero or collection photo is a use the media library reads
  (`storefrontSlots` joins its use relations; `storefront-collection` its use kinds; ADR-0058).
- **Editor (D13; R9, R10; Q9, Q10):** in the full-screen preview a tapped section opens its sheet
  (`src/components/org/look/section-sheet.tsx`: bottom sheet on a phone, side panel from `md:`), asking only the fields
  the registry's new `SECTION_FIELDS` names: hero photos (≤3) and one line, collections (≤6 of the shop's categories,
  a photo each, search past 8), claims, opening hours, and "Hide this section" on collections, story and visit. Story and
  visit link to Shop details for the facts. Saves are live at once and redraw the preview; only the look waits for
  Publish. ux.md states: "Saved", "Saving…" after 3 s and never disabled, "Couldn't save. Your words are kept here.",
  "Changed by {Name} just now. Load theirs?" with Load / Keep mine, "Up to three. Remove one to add this.", "112 / 120"
  from 80%, "Uploading…", "{n} photo didn't upload." with Try again, "Use a photo, not a PDF.".
- **Save (D13):** `PATCH /api/org/[orgId]/storefront` is now a compare-and-set on the `updatedAt` the editor read, in
  one transaction with the slots; only fields sent change. A claim must be on the shop's list, a collection a category
  it sells, a photo one of its own ready pictures. The accent is no longer offered (still stored and read by unthemed
  pages); the Shop page's editor sends its version too.
- **Claims and suggestion (Q19, Q21, Q44, new):** `server/catalog/storefront-claims.ts` declares the claim keys, labels and
  per-product-type lists; the shop's kind is its main product type. Each theme declares the product types it is
  suggested for; the picker marks that card "Suggested for {kind}".
- **Buyer page:** hero photos, line, picked collections (else the categories it sells in), claims, today's hours in
  India (Q45, new) and hidden sections reach the themed page; a hidden section's words leave the payload. A cover from
  before the editor still fills the hero (Q11). A themed shop's link preview is its first hero photo's preview rendition
  (D14). The preview alone draws "Add a photo" on an empty hero and a hidden section as a line to tap (Q43, new);
  "Tap any part to change it." shows once.
- **Contract:** `StorefrontSettingsInput`, new `StorefrontSettingsDto`, `StorefrontPageDto`, `StorefrontLookState`,
  `MediaUseDto`; `docs/CONTRACTS.md` moves with them. No new public route, so the rate-limit registry is unchanged.
- **Tests:** integration `storefront-editor.test.ts` (stale save names the member; claims off the list refused and
  labels shown; suggestion; unsold collection and foreign photo refused; slots are library uses and block retiring;
  hidden content left out; a section's save leaves the rest); unit `storefront-editor.test.tsx` (no proof key, fourth
  claim, line length, limits, claims read, suggestion, hours in India, preview-only chip and hidden line, sheet's
  Stale / Refused / Retryable / counter states). Mutation-tested, each caught: the version in the save's `where`; the
  claim-list and sold-category checks; `storefrontSlots` as a use; `readClaims`' list filter; the strict schema; the
  preview-only chip; story subtraction when hidden.
- **Review fixes:** the Shop page's editor resets its form to the version each save returns, so a second save without a
  reload is not refused as stale (unit test saves twice). Migration `20261101171700_storefront_content_edited_at` adds
  `OrgProfile.contentEditedAt`, written as one instant with `updatedAt`, so "Changed by {Name}" names the editor only
  when theirs was the last save, else "another member" (integration: Shop details then sheet). Deleting a category a
  shop shows as a collection is refused with a named reason instead of the foreign-key error. Each mutation-tested.

## 2026-11-01 — storefront-themes unit 5: picker, preview, publish, switch back [CONTRACT]

- **Publish (D11; R4, A2, A9; Q4, Q31):** new `server/catalog/storefront-look.service.ts` publishes a theme and palette at
  the look version the picker read: a compare-and-set in `orgProfileRepository.publishLookIfVersion` that bumps the
  version, so of two members publishing at once one wins and the other gets 409 "{Name} published {theme} {n} min ago."
  (with "See it" / "Publish mine anyway", which resends at the new version). Owner only ("Only the shop's owner can change
  its look.", 403); audited after the write (`ORG_LOOK_PUBLISHED`, `ORG_LOOK_REVERTED`, ADR-0021). The look replaced is
  kept 30 days; **switch back** restores it at the same compare-and-set and refuses after the 30 days. A shop's first
  publish keeps its page from before any theme, which switch back restores as "your old page" (Q42, new).
- **Routes:** `PUT /api/org/[orgId]/storefront/look`, `POST …/storefront/look/revert`, both `withOrg`, strict Zod schemas;
  caller `orgStorefrontApiClient.ts`. No public route, so the rate-limit registry is unchanged.
- **Preview (D12; Q32):** a new route group `src/app/(preview)` holds `/org/{orgId}/storefront/preview`, portal-guarded
  (`requireOrgMember`), `noindex`, no portal chrome: the themed shell and sections for the requested keys, landing or shop
  view, read by `storefrontDAL.getStorefrontPreview` (the service's `storefrontPage` takes the look to draw). An empty shop
  previews labelled sample goods declared in `src/components/storefront/preview/sample-goods.ts`. Inside the frame a link
  goes nowhere and a tapped section is posted to the parent, our origin only (the unit 6 editor listens). Framing: on
  that path alone `frame-ancestors 'self'` (middleware) and `X-Frame-Options: SAMEORIGIN` (a second `next.config.ts` entry
  after `DENY`); everywhere else unchanged.
- **Picker (ux.md picker, preview & publish):** `/org/{orgId}/storefront/look`, reached from the portal's Shop page: four
  cards, each a live scaled iframe of the shop's own page with the theme's pattern until it arrives ("Preview unavailable"
  / "Try again" when it does not), palette dots, "Live now", "Switch back to {previous}". The full-screen preview is a
  `TaskDialog` (ADR-0040 case 2) with palettes, Landing / Shop and "Publish this look"; from `lg:` a desktop frame sits
  beside the phone. Publish and switch back confirm in a `FormDialog`, show "Publishing…" with a spinner after a second
  and never disable; failure reads "Not published. Your shop still shows {current}." Success toasts "Your new look is
  live." and offers "Share your shop". A member who is not the owner sees the refusal and "Back"; a failed read is the
  page's error ("Couldn't load your themes. Check your internet.").
- **Left to unit 6 (its Delivery line):** "Suggested for {category}", "Tap any part to change it." and the "Add a photo"
  chip, which belong with the section editor and the theme suggestion.
- **Contract:** new `StorefrontLookInput`, `StorefrontRevertInput`, `StorefrontLookState`; `docs/CONTRACTS.md` moves with it.
- **Tests:** integration `storefront-look-publish.test.ts` (version 0 start; STAFF 403; publish live, version, 30 days,
  audit; stale 409 with name and theme; resend wins; switch back and its audit; refused after 30 days); unit
  `storefront-look-picker.test.tsx` (schemas, copy, cards, palettes, publish, conflict, failure, never disabled, switch
  back, sample goods), `storefront-look-frame.test.tsx` (pattern, unavailable and retry, link stopped, origin-only post),
  `security-headers.test.ts` (preview path only, config order, middleware asks the path).
- **Mutations recorded:** repository CAS without `lookVersion` → 3 integration red; owner check dropped → 2 red; 30-day
  expiry dropped → red; palette-of-theme refine → `true` → red; `frame-ancestors` always `'self'` → 2 red; framed path
  widened to `/storefront` → 2 red; link `preventDefault` dropped → red; `postMessage` to `"*"` → red. All restored.
- **Review fixes:** the error page's "Try again" calls Next 16.3's `retry` (re-fetches; `reset` only re-renders); the frame
  guard also stops form submits (the themed header's search); an empty shop gets "Add a product" above the cards; a switch
  back after the 30 days is **410** (not 409), shown with no resend and no "See it"; at `md:` the preview's controls sit
  in a column beside the phone frame. Tests: submit stopped, resend carries the refreshed version, 410 offers no resend.

## 2026-11-01 — order-fulfilment Q38 re-signed: admin refund copy

- The owner re-signed the refund copy changed at build (unit 6): the confirm sheet's "to the way the buyer paid" with
  "Not now", "Try again" on the gateway-refused row, and the 409 refusal in our own words. Q38 in
  `docs/specs/own-store/order-fulfilment/decisions.md` records it. No behaviour change.

## 2026-11-01 — storefront-themes unit 4: deals and badges [MIGRATION] [CONTRACT]

- **Deals section (D10; R7, A6; Q12, Q13, Q20, Q36, Q41):** new `server/promotions/storefront-offers.ts` decides which of a
  shop's offers show and words them from the offer ("20% off · All Sarees", "₹100 off orders over ₹999", "Ends Tue 3 Nov" /
  "Ends today", by India's clock); running automatic offers and only the codes the shop ticked, soonest ending first, six at
  most, "Few left" at ten or fewer uses with no count, a percentage no deeper than the shop's ceiling (as the engine clamps
  it), and no card for a sale price (Q41, new). Read through `promotionService.storefrontOffers` over a new
  `promotionRepository.listRunningForOrg`; `storefront.dal.ts` asks it, never `storefrontService`, and adds up to eight
  priced goods on offer. New `ThemedDeals` (`src/components/storefront/themed/deals.tsx`) in its three variants — campaign,
  banners, strip — with "Shop the deal" to `/shop?deals=1` and a client `CopyCode` leaf ("Code {CODE} · tap to copy" →
  "Copied"); a shop with no offer and nothing reduced shows no section.
- **Badges (A3):** every themed card shows "{n}% off" read off the resolved price and list price (new `percentOff` in
  `src/domain/product.ts`, which the marketplace card now shares); none on a sold-out card.
- **Show on my shop (Q20) [MIGRATION]:** `20261101170200_promotion_show_on_storefront` adds `Promotion.showOnStorefront`
  (default false). The shop's offer form shows the tick for a coupon; the service stores it only for a shop's code.
- **Contract:** `PromotionFormInput` gains `showOnStorefront`; `StorefrontPage` gains `offers` and `dealProducts`; new
  `StorefrontOfferDto`. `docs/CONTRACTS.md` moves with it.
- **Tests:** new `storefront-offers.test.ts` (what shows, the words, India day, ceiling), deals and badge cases in
  `storefront-themed-sections.test.tsx` (every theme), `promotion-schema.test.ts` (default off, platform strips it),
  integration `storefront-deals.test.ts` (another shop's and unticked offers absent; tick stored only on a code; badge equals
  `promotionService.quote`; a stopped offer leaves card and badge).
- **Review fixes:** the strip's goods count only the shop's own offers (new `ownOffersOnly` on `ProductFilter`, passed to
  `offerCoverage` as `ownedBy`), so a platform offer gives no shop a deals section (R7, Q12; integration case added); the
  badge's percent is floored, never rounded, so 12.5% reads "12% off" (A3; unit case added).
- **Mutations recorded:** tick check dropped → red; exhausted filter dropped → red; few-left `<=` → `<` → red; ceiling clamp
  dropped → red; sale-price filter dropped → red; midnight end not moved back → red; sort removed → red; deals slice always
  shown → red; badge on sold-out → 4 red; schema default true → red; service ignoring trigger → integration red; repository
  without the org filter → 2 integration red; `ownedBy` filter dropped → integration red; floor → round → unit red. All restored.

## 2026-11-01 — seller-onboarding unit 6: share the shop's link

- **Share sheet (R10, A2; D13):** `src/components/org/share/share-shop-sheet.tsx`, on the hand-off sheet (bottom
  sheet; popover from `lg:`), titled "Share your shop": the link (truncated mid), the card a chat will show, and
  "Share on WhatsApp" (a `wa.me` link with "Visit {Shop name} online: {link}"), "Copy link", "See as a buyer". Copy
  says "Link copied" and "Copied. Paste it in any chat."; a failed copy says "Long-press the link to copy it."
- **First share recorded (Q3, Q32):** `useShareShop` calls `POST …/setup/shared` on the first WhatsApp tap or the first
  copy that reached the clipboard; a failed record is silent and the next tap retries; a shop that has shared asks
  nothing. On Home the toast says "Shared · {n} of 5 done" and the list refreshes; elsewhere it says "Shared".
- **Openers:** Home's setup step 5 opens the sheet in place with its hint on top (it no longer leaves for the Shop
  tab), Home's link gains "Share", "All caught up" opens it, and the toast after the first product carries "Share".
  The Shop tab's link card opens the same sheet instead of the generic share dialog, and its copy counts too.
- **One preview (Q33):** `src/lib/store-preview.ts` builds the store page's Open Graph title, description and image;
  the store page's metadata and the sheet both read it (no change to the metadata). `share-shop.dal.ts` reads it for
  Home and the Shop tab, falling back to the shop's own details when the public read fails.
- **Status:** seller-onboarding spec and TRD → Implemented (units 1–6).
- **Docs:** ARCHITECTURE.md test-file count.
- **Tests:** `tests/unit/share-shop-sheet.test.tsx`, `tests/unit/shop-hub.test.ts`, `tests/unit/hint-sheet.test.tsx`.
  Mutation-tested: dropping the already-shared guard, marking the share recorded before the server answers, sending
  the message unencoded, recording a failed copy, sending step 5 back to the Shop tab, and letting a failed public
  read cost the link each fail a test; so do trusting only the mount-time "shared" (a sheet kept mounted across the
  refresh said "6 of 5 done") and dropping the product toast's "Share".
- **Cost:** the preview's hero image is one request-cached public-profile read per Home and Shop-tab render (TRD D13).

## 2026-11-01 — storefront-themes unit 3: themed chrome, the landing/shop split, redirects [CONTRACT]

- **Routes (D6; Q3, Q19, Q35; R13):** `src/app/(store)/store/layout.tsx` keeps only the wishlist; a new
  `[handle]/layout.tsx` draws a themed shop's chrome or the marketplace's (`src/components/layout/marketplace-chrome.tsx`,
  which the directory now wraps itself in). Themed: `/store/{handle}` is the landing page (`ThemedSections` over the
  page DTO), new `/store/{handle}/shop` lists the goods in the theme's card and density (category chips, Deals as
  `?deals=1` on `offerOnly`, search within the shop, sort, "Visit {Shop name}"), `/about` 308s to the landing page, and
  a link into today's filtered grid 307s to `/shop`. Unthemed: today's pages unchanged, `/shop` 307s home; a retired
  handle on `/shop` follows to the moved shop page. `src/app/sitemap.ts` lists a themed shop's `/shop` instead of `/about`.
- **Chrome (D7; R5, A5, Q6, own-store Q22, Q23):** new `src/components/storefront/themed/chrome/` — `ThemedShell` (theme
  and palette scopes plus the theme's faces over header, page, footer and tab bar), a header (mark and name to the
  landing page, logo alone past 24 characters, search within the shop, the shared cart count), a phone tab bar (Home ·
  Shop · Deals · Cart · More; More holds the account, orders and "Shop all of Bhendi Bazaar"), and a footer with the
  shop's links and the platform band ("Sold on Bhendi Bazaar", Contact us, policies). Every themed product link adds
  `?shop={handle}` (`storefrontProductHref`); `src/middleware.ts` forwards it with the slug as request headers
  (`src/lib/storefront-chrome.ts`, always cleared first) and the `(main)` layout draws that shop's chrome only when the
  product is the shop's (`productsRepository.orgIdForSlug`). Leaving that product refetches the tree, since a layout is
  not re-rendered on a client navigation (Q40). `PaginatedProductGrid` takes an optional themed card style.
- **Page DTO (D9; Q34, Q38, Q39):** `StorefrontPageDto` from `storefrontService.storefrontPage`, null until a look is
  published; best selling by units in paid orders over 90 days (`orderService.bestSellingProductIdsForOrg`, a grouped
  count in `order.repository.ts`), dispatch time as the median from paid to ready over recent parcels
  (`server/checkout/dispatch-time.ts`, through shipping's `readyTimesForOrg`), left out under three parcels. The DAL
  prices the goods (`getStorefrontPage`) and adds new in, categories and `productCountFor`. Hero line, claims, hours,
  chosen collections and hidden themed sections stay empty until unit 6; the deals section until unit 4.
- **Contract:** `Storefront` gains `themeKey`, `paletteKey`; `ShopListing` gains `themed`; `ProductFilter` gains
  server-resolved `ids`; `PUBLIC_PROFILE_SELECT` reads the look columns. `docs/CONTRACTS.md` moves with it.
- **Tests:** new `storefront-themed-routes.test.ts` (308/307 redirects, filtered-link forward, Deals as `offerOnly`,
  sitemap), `storefront-chrome.test.ts` (forwarded header cleared and validated; a foreign product draws the marketplace's
  chrome), `storefront-themed-chrome.test.tsx` (A5 tab bar and More, header, footer band, `?shop=` on cards, "Visit
  shop"), integration `storefront-landing.test.ts` (unpaid, refunded, cancelled, stale and other shops' sales do not rank;
  dispatch floor and median; no DTO before publish or for a retired key). Censuses moved: `org-scoping` (orgIdForSlug
  public), `product-visibility` (25 → 27 reads, both spread `AVAILABLE` and `FROM_ACTIVE_ORG`), `storefront-public-dto`.
- **Mutations recorded:** paid filter dropped from best selling → 2 red; order-status filter dropped → 2 red; dispatch
  floor 3 → 1 → 2 red; forwarded headers not cleared → spoof test red; chrome shop without the org check → red; `/about`
  as 307 → red; unthemed `/shop` redirect removed → red; sitemap `themed` ignored → red; `offers` not mapped to `deals` →
  red; "Shop all of" removed from More → red; card without `?shop=` → red; platform band copy changed → red. All restored.
- **Review fixes:** a malformed or non-ASCII product slug forwards no chrome headers instead of a middleware 500; best
  selling counts only goods still on sale (an archived one no longer crowds the shelf); dispatch time skips parcels of
  cancelled or expired orders (the order statuses passed in by checkout). New `[handle]/error.tsx` ("Something went wrong.
  Try again.", `retry`) inside the shop's chrome, and `/shop` streams its goods under a `ThemedGridSkeleton` in the
  theme's card shape, shown after 300 ms. Mutations: archived filter dropped → red; cancelled-order filter dropped → red.
- `docs/ARCHITECTURE.md`: 295 → 299 test files. Decisions Q3, Q6, Q33, Q34, Q35 → implemented (unit 3); Q39, Q40 logged
  and implemented. Suites: `tsc`, `vitest tests/unit`, the storefront and parcel integration files, `lint:boundary`,
  `docs:check`.

## 2026-11-01 — order-fulfilment Q37 accepted: the cancel give-back seam

- The owner accepted the `server/checkout/cancel-give-back.ts` entry in `tests/unit/file-cohesion.test.ts` (ADR-0056):
  one seam reaching payments, payouts and promotions, so a cancel gives back all three or none. Q37 in
  `docs/specs/own-store/order-fulfilment/decisions.md` records the acceptance. No behaviour change.

## 2026-11-01 — seller-onboarding unit 5: pickup address over the form, reviews on the product

- **Pickup address sheet (R8, A4; D11; Q12, Q26):** `src/components/org/pickup-address-sheet.tsx` wraps the existing
  `LocationForm` in the hand-off sheet (bottom sheet; 28rem side sheet from `lg:`) titled "Add pickup address". The
  product form's "Add location" / "Add another location" now open it instead of a dialog (its prompt copy stays);
  the saved address comes back as a stock row and the product form underneath keeps what was typed. The Shop hub's
  "Pickup addresses · none yet" row opens it in place and refreshes. ux.md copy: "Save address", "Saving…",
  "Still saving…" after 3 s, toast "Pickup address added", and "Couldn't save. Your form is safe." with "Try again"
  for a network drop or server fault; field errors stay on their fields. The button is never disabled — a press
  while saving sends nothing. `LocationForm` gains optional `messages` and `actions`; the locations page is unchanged.
- **Duplicate name (Q29):** `orgAddressService` refuses an add, or a rename, onto a name the shop already has, any
  case, as a `ConflictError` on `name`: "You already have '{name}'. Use another name." No index (Q29).
- **Reviews in context (R9; D12; Q13):** the portal product page gains a read-only Reviews section from
  `reviewsDAL.firstPage` (summary, newest first, "See all reviews" when there are more), with ux's empty line and its
  own "Try again" on a failed read. Home's "new reviews" line links to it through the shared `PRODUCT_REVIEWS_ANCHOR`.
- **No parcel opener (Q31):** D11's opener list drops the parcel: a parcel ships from the address that held its
  stock, so it never lacks one. The Shop hub opens the sheet only for a shop with no address at all; a shop whose
  addresses are all paused keeps the link to Pickup addresses, to switch one back on.
- **Streaming:** the product page's Reviews section has its own `Suspense` and skeleton, so it never holds the page.
- **Gates:** `overlay-surfaces` drops `ProductOrgShippingFields.tsx` from the dialog ratchet (it no longer uses one).
- **Status:** spec and TRD stay Accepted; unit 6 remains.
- **Tests:** `tests/unit/pickup-address-sheet.test.tsx`, `tests/unit/product-reviews-section.test.tsx`,
  `tests/integration/pickup-address.test.ts`. Mutation-tested: dropping the duplicate-name check, its case-insensitive
  match, or its own-row exclusion; letting a second press re-send; passing a server fault's message through; never
  switching to "Still saving…"; and a section id that is not Home's anchor each fail a test.

## 2026-11-01 — seller-onboarding unit 4: hints the seller opens, and "?" on every portal page

- **Hints (R4, A5; D9):** each setup step on Home is now a button that opens its hint — 1–3 cards, one at a time with
  dots and "{i} of {n}", "Next", and a last card whose button starts the task ("Add product", "Add pickup address",
  "Add logo and line", "Share your shop"), still carrying `from=home`. Nothing opens by itself; a hint closed mid-way
  reopens at card 1. Copy is ux.md's deck, in `src/components/layout/portal-hints.ts` beside `PORTAL_NAV`.
- **"?" (R5; Q11):** `PageHeader` takes an optional `help` key (a `PORTAL_NAV` key) and renders "?", which opens the
  page's name, its purpose line from the navigation and, for Products, Pickup addresses, Shop details and Shop, the
  matching step's cards, ending "Got it". `help` is typed `PortalNavKey`, so an unknown key does not compile.
  Every portal page carries it — sub-pages take their section's key (a product form or bulk sheet "products", an order
  "orders", a channel's listings, stock, family and settle pages "channels"); `SectionHeader` and the shared product
  containers pass `help` through, and the admin console passes none.
- **Hand-off close:** the sheet's close control is the shadcn `Button` inside `SheetClose asChild`, labelled from
  `HINT_COPY.close`.
- **Hand-off surface (D10; ADR-0040 case 4):** `src/components/shared/overlays/handoff-sheet.tsx` — a bottom sheet
  below `lg:`, from `lg:` a popover beside its control (hint, share) or a 28rem side sheet (address, for unit 5). One
  `MAY_USE_SHEET` entry.
- **Status:** spec and TRD stay Accepted; units 5–6 remain.
- **Tests:** `tests/unit/portal-hints.test.ts`, `tests/unit/hint-sheet.test.tsx`. Mutation-tested: a fourth card, a
  three-sentence card, a navigation page without `help`, a sub-page without `help`, the next step's hint opening on render, "?" opening on render,
  and a card index kept across reopening each fail a test.

## 2026-11-01 — storefront-themes unit 2: sections and compositions [MIGRATION]

- **Registry (D1, D8; Q8, Q9):** `server/catalog/storefront-themes.ts` gains the one section library (`SECTION`,
  `SECTION_VARIANTS`: hero 4, collections 3, deals 3, best selling 3, new in 2, why buy 3, story 3, reviews 2,
  visit 2), `HIDEABLE_SECTIONS` (collections, story, visit — the shop's own words and picks), `CARD_STYLE` and each
  theme's `COMPOSITIONS` in the spec's section order. The footer is chrome (D7, unit 3), not a composed section.
- **Sections (D8; R2, R10, R11, Q17, Q23, Q34):** new `src/components/storefront/themed/` — server components for
  hero, collections, a shared product shelf (grid, rail, rails by category), why buy, story, reviews, visit, one
  product card in four styles, and `ThemedSections`, which renders a theme's composition and closes up empty
  sections. `page-data.ts` holds the slice functions (best selling needs 4, shelves cap at 8, collections at 6;
  since-when and the returns preset never open "Why buy from us" alone; claims drawn apart from facts). A missing
  photo draws the theme's pattern: new `--pattern-image`/`--pattern-size` per `[data-theme]` and
  `bg-theme-pattern` (registered in `cn`). Empty shop: "{Shop name} is setting up. Check back soon." The deals
  section renders nothing until unit 4 (D10). Nothing mounts any of it yet (unit 3).
- **Schema (D11; Q4, Q19, Q31):** migration `20261101170100_storefront_look` adds `OrgProfile.themeKey`,
  `paletteKey`, `lookVersion` (default 0), `lookPublishedAt`, `lookPublishedByUserId` (Restrict, ADR-0020),
  `previousThemeKey`, `previousPaletteKey`, `previousLookUntil`. Additive, no backfill; nothing writes them yet. The
  publisher FK is indexed (`OrgProfile_lookPublishedByUserId_idx`) so Restrict does not scan `OrgProfile`.
- **Review fixes:** hero text over a photo uses `bg-photo-scrim` at the strength the D4 contrast gate tests (no
  `/60` modifier); the rating count is grouped ("1,212 reviews"); the Edge card's spec line shows the category's
  name or nothing, never a slug. Q37 rewords signed-off copy and is flagged for the owner to confirm.
- **Naming:** the section is keyed `bestSelling` and titled "Best selling": "bestsellers" trips the retired-word
  gate (`tests/unit/vocabulary.test.ts`), and a word inside a compound is not worth an allowlist edit.
- **Tests:** `storefront-themes-registry.test.ts` (compositions name only declared sections and variants, each once,
  hero first; every theme carries goods, deals, proof and visit; no undrawn variant; four card styles; themes
  differ pairwise in ≥3 section variants — A1; hideable set pinned). New `storefront-themed-sections.test.tsx`
  (A4 per theme: name, logo, one product → pattern in the hero, no blank section, no "undefined"; product without a
  photo → pattern; empty shop copy; hidden sections; Q34 floor; why-buy wording and claims apart). New integration
  `storefront-look-columns.test.ts` (unthemed at version 0; publisher cannot be deleted).
- **Mutations recorded:** a composition variant cast to `"carousel"` → two registry tests red; pattern test id
  removed → 8 render tests red; `MIN_BEST_SELLING` 3 → red; empty sections kept as wrappers → 4 red; hero count
  always "products" → the singular test red. All restored.
- `docs/ARCHITECTURE.md` counts: 113 → 114 migrations, 293 → 295 test files. Decisions Q8, Q17 → implemented
  (unit 2); Q37 (returns read as the preset label) and Q38 ("1 day", "today") logged and implemented. Suites: `tsc`, `vitest tests/unit`, the new integration file, `lint:boundary`, `docs:check`.
## 2026-11-01 — own-store/bulk-sheet unit 5: the team uploads a shop's sheet, recorded once [CONTRACT]

- **Admin twins (D11; R9; Q17, Q18):** `GET /api/admin/orgs/:id/products/bulk/sample`, `POST …/validate`, `POST
  …/marker` and `POST …/products/bulk` behind `requirePlatformAdmin`, scoped to the path's shop (404 otherwise); the
  same build, check and marker as the shop's. Create needs `reason` (`teamReasonField`, "Say why — the shop will read
  it.") and takes `fileName`; a deactivated or blocked shop is refused ("{Shop} is deactivated. Reactivate it to add
  products."). After commit one `PRODUCT_TEAM_BULK_UPLOADED` entry on the shop (`resource: "Org"`) holds reason, file
  name, counts and product ids; it is written through `createProducts`' `onImported`, before the sale prices, so a failed
  markdown write still leaves it; a failed audit write never fails the import (ADR-0021). `server/catalog/bulk/bulk-team.service.ts`.
- **Edits through the version (D10):** `importBulk` names the uploader as editor on every row, sets or clears
  `teamEditedAt`, and moves an updated product's `version`, so an open form rebases. The shop's own create passes its
  member; create's checks are one `validateCreateRows` both routes call.
- **Status:** spec and TRD stay Accepted until A7 is timed with the owner's father.
- **Screen:** `/admin/orgs/[orgId]/products/bulk`, reached by "Add many for this shop", is the shop's wizard with the
  banner and reason above every step; the reason is checked before any photo goes up; done reads "Created {a} and
  updated {b} for {Shop}. Recorded in the activity log." No location or a deactivated shop shows ux.md's line instead.
- **Fix:** bulk photos are filed under `org/<code>/bulk/` (`bulkPhotoPath`); `products/<code>/bulk/` was refused by
  both token routes since stored files moved under their owner.
- **Tests:** `tests/unit/bulk-sheet-team.test.ts`, `tests/integration/bulk-sheet-team.test.ts`, `bulk-files.test.ts`.
  Mutation-tested: dropping either half of the deactivated-or-blocked refusal, moving the audit after the sale prices, the team mark, the version move, the all-or-nothing return, the
  required reason, and the old photo prefix each fail a test.

## 2026-11-01 — order-fulfilment unit 6: refund owed for lost, damaged and returned parcels; the refund button [CONTRACT]

- **Refund owed for every cause** (R13, Q25; D16): a parcel moving into `lost`, `damaged` or `rto_delivered` now
  writes its one `Refund` row by the cancel's rule and cap — `oweRefund` in `server/checkout/cancel-give-back.ts`,
  called from `parcel-moved.ts`. A repeated courier update writes nothing (unique `shipmentId`).
- **The refund button** (R14, A9; D17; Q12): `server/checkout/refund-start.ts` `startRefund` behind
  `POST /api/admin/refunds/[id]/start`. Payments claims the row conditionally (OWED, UNCONFIRMED, FAILED, or
  REQUESTED older than 2 min → REQUESTED), then asks Razorpay once with `receipt` = the row id and a 10 s timeout
  (`createRefund`, `findRefundByReceipt` in the Razorpay adapter). A row ever sent before is first looked up by its
  receipt and the found refund adopted; a failed lookup stays UNCONFIRMED rather than asking blind. Success →
  STARTED with the gateway id and the buyer's "Refund of ₹{x} started" notice on the same transaction; a 4xx →
  FAILED with Razorpay's reason; a timeout or 5xx → UNCONFIRMED. The answer is recorded only against the claim that
  asked, so a late answer cannot overwrite a retry. Who pressed is audited (`REFUND_START`), and names the refusal.
- **Screens** (ux.md "admin refunds"): `/admin/orders/refunds` (admin nav "Refunds"): not started first, oldest
  first, then started; "₹1,240 owed · {parcel} · cancelled by shop / lost / damaged / returned"; "Owed for {n} days"
  amber past 2; "Started 3 Nov · rfnd_…"; the confirm sheet; Unconfirmed and Failed rows with Open in Razorpay and
  Try again; 50 a page; cards, a table at `lg:`. The buyer's order shows "Refund of ₹{x} started …" on a lost,
  damaged or returned parcel once started. No button is disabled.
- **Review fixes:** a 200 carrying a refund Razorpay already marked failed is refused, not started; an order with
  no captured payment, or a server without Razorpay keys, is a `409` in our words before the row is claimed (Q38);
  the admin nav "Refunds" shows the not-started count (`PortalNavItem.count`); the build-time copy changes are Q38,
  pending the owner's re-sign.
- **[CONTRACT]** `RefundStartOutcome`, the start route, `RefundRow`. `CONTRACTS.md` updated. No migration: unit 5's
  `Refund` table holds every column.
- **Tests:** `tests/integration/refund-start.test.ts` (Q25 lost, damaged, returned; R14 list and start with one
  email and the buyer's line; A9 timeout then adopt; failed lookup; two presses at once; refusal then retry; stale
  request; a late answer after a retry; 404); `tests/unit/refund-gateway.test.ts` (receipt and amount; timeout and
  dropped connection unknown; 5xx unknown; 4xx reason; receipt lookup skips failed refunds; failed lookup throws).
  Mutations, each restored: claim accepting STARTED (1 failed); receipt lookup skipped (3 failed); Q25 causes not
  owed (1 failed); 5xx read as a refusal (1 failed); stale window ignored (2 failed); settle not tied to its claim
  (1 failed).

## 2026-11-01 — own-store/bulk-sheet unit 4: problems marked in the shop's own file [CONTRACT]

- **Marker (D7; R6, A4; Q11, Q12, Q30):** `POST /api/org/:orgId/products/bulk/marker` takes the same file again,
  re-runs the whole check and answers the shop's own workbook (`server/catalog/bulk/sheet-marker.ts`): each problem
  cell filled red with a note, the row's Problems cell holding its lines joined by " · ", nothing else written; a
  file marked before has only our own red and note lines cleared — a red cell is ours only if its note holds a line
  its row's Problems listed, since our red is also Excel's "Bad" style. A .csv comes back as an .xlsx with Problems first.
  Re-uploading the marked file reads the same rows and stamp.
- **One check (D8, D9):** `checkProductSheet` (`bulk-check.service.ts`) is what validate and the marker both run;
  all-or-nothing is unchanged (Q19). A row the shape refuses is still checked against the catalogue, so "Price
  missing · Colour 'Emrald' isn't in the list…" arrive together; a cell already refused is not named twice.
- **Screen:** "Download your sheet with problems marked" is the docked action when rows have problems, with "Fix
  the red cells and upload the same file again." above the list; never disabled — the tap shows "Marking your
  sheet…" at once, a second tap says so again, and a refusal about the file shows its own words (retry copy only for
  a network or server fault).
- **Tests:** `tests/unit/bulk-sheet-marker.test.ts`, `tests/integration/bulk-sheet-marker.test.ts`. Mutation-tested:
  clearing any fill, not clearing last round, not writing Problems, not shifting a .csv, not checking drafts, and
  naming a refused cell twice, and clearing a red cell whose note is not ours each fail a test.
## 2026-11-01 — order-fulfilment unit 5: cancel, fee and its setting, cancellation count, refund owed on cancel [CONTRACT] [MIGRATION]

- **One cancel, three doors** (R10, R11, R15, A7, A8; D12; Q9, Q13, Q28, Q31): `server/checkout/fulfilment-cancel.ts`
  `cancelParcel` behind `POST /api/org/[orgId]/shipments/[id]/cancel` (shop, from `packing`, reason required),
  `POST /api/admin/shipments/[id]/cancel` (admin, until `picked_up`) and `POST /api/orders/[orderId]/shipments/[id]/cancel`
  (signed-in owner, from `packing`, reason optional, `ORDER` rate limit). Where each may cancel from is
  `CANCELLABLE_FROM`, checked inside the locked move (`applyStatus` gains `onlyFrom`), so a cancel racing "ready"
  or a pickup loses with ux.md's words. Unpaid orders stay refused; another shop's parcel, another buyer's or a
  guest's order is 404.
- **Every give-back once** (R12, R12a, A6; D13, D14, D16; Q10, Q11, Q20, Q33): restock and reversal stay in the move;
  `parcel-moved.ts` calls one seam, `cancel-give-back.ts` (Q37), which releases the parcel's share of each offer's budget (`PromotionBudgetRelease`, cumulative floors
  over the shop's parcels, `server/checkout/parcel-shares.ts`), gives the coupon back only when the summary has just
  made the order cancelled, records the refund owed (lines less discount share plus shipping, capped at what was
  captured; `server/payments/refund.*`), and on the shop's own cancel a `CANCELLATION_FEE` entry of −fee, copied. The
  buyer and the shop are emailed ("Order BB-… cancelled", "Parcel BB-…-SH1 cancelled", the fee line only on the
  shop's own). A cancel now locks the order's offers before its restock (D2); expiry writes an order-level release row.
- **Carry-forward** (R12b; D15; Q27, Q34): `createSettlement` refuses a selection that leaves the shop's unsettled
  negative entries behind, or totals ₹0 or less.
- **Fee setting and count** (R12a, A12; D14; Q29): `/admin/settings/fulfilment` (admin nav "Settings") — "Shop
  cancellation fee (₹)", compare-and-set on a version, audited (`CANCELLATION_FEE_CHANGED`); the count table lists
  each shop's own cancellations in 30 days with its fees, 50 a page. `PUT /api/admin/settings/fulfilment`.
- **Screens** (ux.md shop cancel sheet, admin cancel sheet, buyer cancel sheet, buyer order): one reason list
  (`components/order/cancel/`); the shop's "Cancel parcel" on its card (a ready one explains, with Contact us), the
  cancelled card's fee line; "Cancel parcel" on the pickups queue, the not-packed list and the order console (a
  booked one's row keeps the amber "Cancelled. Now cancel AWB {awb} on Shiprocket." with Open Shiprocket); the
  buyer's "Cancel order" / "Cancel these items" with the amount, the refund line, "Your {code} coupon can be used
  again.", and the timeline's "Cancelled · refund on its way", plain "Cancelled" when nothing was owed. A ₹0 fee
  drops the fee clause from the shop's sheet. No button is disabled.
- **[MIGRATION]** `20261101163500_cancellation_fee_kind` (enum value alone, so the next can index it) and
  `20261101163600_order_fulfilment_cancel`: `PromotionBudgetRelease`, `Refund` (+ `RefundState`), `FulfilmentSettings`
  seeded at ₹50, the one-fee-per-parcel partial index. Additive.
- **[CONTRACT]** `shopCancelSchema`, `buyerCancelSchema`, `fulfilmentFeeSchema`, the three cancel answers,
  `FulfilmentSettingsView`, `ParcelTimelineDto.refundStarted`, the buyer `Shipment.org.name`, the settlement refusals.
  `CONTRACTS.md` updated.
- **Tests:** `tests/integration/parcel-cancel.test.ts` (A6 shop cancel and twice; buyer no fee; two-parcel coupon;
  concurrent double cancel; the cancel/pickup race; R10 refusals; A8; scope; A12 with a stale save; D15);
  `tests/unit/parcel-shares.test.ts` (shares, budget split and refund cap over 300 random splits each);
  `tests/unit/parcel-cancel.test.tsx` (A7, the sheets' states, reason and fee inputs, cancel emails, buyer timeline).
  `offer-budget.test.ts` asserts the expiry's release row and cleans it. Mutations, each restored: `onlyFrom` guard
  removed (1 failed); fee on any actor's cancel (2 failed); coupon back on every cancel (1 failed); refund cap removed
  (2 failed); settlement debt check removed (1 failed); settlement floor removed (1 failed); fee save without the
  version (1 failed); buyer ownership check removed (1 failed); budget split across shops (1 failed).
- **Gate edits:** `file-cohesion` `RECORDED` gains `server/checkout/cancel-give-back.ts` (payments, payouts,
  promotions), narrowed at review from a five-domain `parcel-moved.ts`; it awaits the owner's acceptance (Q37); `rate-limit/registry.ts` gains the buyer's cancel.

## 2026-11-01 — own-store/bulk-sheet unit 3: the stamp, the old-sheet warning and refusal, problems by row, counts [CONTRACT]

- **Stamp (D4; R4, A3; Q10, Q27):** the hidden `Lists` tab ends with a `__stamp` column — made-on date, a SHA-256
  fingerprint of every tab's column keys and every list's words, the ticks — and Instructions reads "Made {date}
  · version {first six}". `server/catalog/bulk/sheet-stamp.ts` judges an upload against the sheet the same ticks
  make today: same fingerprint silent; different but every key known and every required column present, stale;
  otherwise refused naming the column as the file heads it. An unstamped .xlsx is warned with its own creation
  date (Q28); a .csv is read as before. `bulkSheetService.judgeUpload` is the one judge (Q18 for U5).
- **Screen (D8; R7, R8):** the validate answer gains `plan` (creates, updates) and `sheet`; a refused sheet is not
  read further. `CheckReport.tsx` shows "This sheet is from {date}…" with "Continue with this sheet" / "Download a
  fresh sheet", "This sheet is too old to read: the '{column}' column has changed.", "{n} problems in {r} rows ·
  nothing created yet" grouped by row and tab, 20 then "Show all", filterable by column, and "All {n} rows look
  good · {a} new, {b} updates" with "Create {a} · update {b}"; done reads "{n} products on sale · {a} new, {b}
  updated". "Check the sheet" is no longer disabled while busy; a tap says what is happening.
- **Problems (U1's handoff):** every `RowError` carries `tab` and, on validate, `column` (`row-errors.ts`); a SKU
  repeated reads "SKU {code} is used twice — rows {a} and {b}", naming tabs when they differ; an archived SKU reads
  "SKU {code} belongs to an archived product. Restore it, or use another code."; over 300 rows reads "Your sheet
  has {n} rows. Upload 300 or fewer at a time — split it into two sheets."
- **Tests:** `tests/unit/bulk-sheet-stamp.test.ts`; `bulk-upload`, `bulk-sheet-download` integration extended.
  Mutation-tested: fingerprint compare always equal (4 fail), unknown key not refused (1), missing required not
  refused (1), optional column treated as required (1), unstamped .xlsx not warned (1), cross-tab rows unnamed (1),
  row errors without their tab (1), the route's refusal branch dropped (1).
- **Review fixes:** a new file or "Download a fresh sheet" clears the old report, so a refused sheet is no dead
  end; the file's own problems count no row and offer "Pick another file"; a product-type problem is named by the
  Category column; the check's loading line stays "Reading your sheet…" (ux.md updated: the count is not known
  until the one round trip ends); the validate route's refusal is tested end to end.

## 2026-11-01 — product-form unit 6: the shop sees what the team changed [CONTRACT]

- **Badge** (R12, A7; D13; Q14): "Edited by Bhendi Bazaar team · {date}" on the shop's product page
  (with "See what changed") and its list row while `teamEditedAt` is set; the shop's next save clears
  it (U4's column), the history stays.
- **History** (D13): a server read on `/org/[orgId]/products/[id]` of the product's
  `PRODUCT_TEAM_*` audit entries, newest first, one line each — "Bhendi Bazaar team · 30 Oct, 4:12 pm
  · Price ₹2,499 → ₹2,299 · 'reason'"; a team create reads "Added this product". Empty renders nothing;
  loading shimmers; a failed read says "Couldn't load the history." with "Try again"; newest five, then
  "Show all changes"; a long line clamps behind "More". Copy in
  `src/components/product/team/team-edit-copy.ts`.
- **Home line** (Q23): "Our team changed {n} product(s)" in Needs you now, opening the one product's
  history or the products list; counts available products only (an archived one the shop has acted on).
- **[CONTRACT]** `ProductTeamEditDto` (no admin identity); `ProductForTable.teamEditedAt`;
  `HomeAttentionDto.teamEdits`. The audit read `listResourceActions` selects no admin columns.
- **Tests:** `tests/unit/product-form-team-history.test.tsx` (line, badge, stock/opaque wording, create,
  no identity, malformed and other-org entries left out, Empty, Show all, More, retry, Home line);
  `tests/integration/product-team-history.test.ts` (A7 history money first without the admin; another
  shop reads nothing; archive entries are not history; Home count, clear on shop save, archived not
  counted). Mutations, each restored: DTO spreading the stored entry (2 failed); org check dropped
  (2 failed); `safeParse` turned into `parse` (1 failed); count without `teamEditedAt` (1 failed);
  count without `AVAILABLE` (1 failed); history without the five-line cut (1 failed). The action filter
  in `listActionsForResource` survives its mutation: the metadata parse also leaves archive entries out,
  so it is held twice. `product-visibility` census for `product.repository.ts` 25 → 27 (the summary's
  count and first, both filtered).
- Q14, Q23 → implemented (unit 6). Spec and TRD → Implemented.

## 2026-11-01 — own-store/bulk-sheet unit 2: dropdowns of words on a Lists tab, word matching [CONTRACT]

- **Dropdowns (D3; R2, A2; Q6, Q7):** every list column — category as a path ("Women › Abayas"), kind, family,
  brand, each answer, yes/no — reads its words from a `veryHidden` `Lists` tab by range (was: an `Answers` tab
  for facts only, categories as slugs inline). Category and kind lists are per tab. Family warns on a new name;
  every other list stops with "Pick from the list in this column." List help lines and an Instructions "Lists
  guide" serve phone apps that ignore dropdowns. A Brand column appears when the shop has brands.
- **Matching (D6; R5; Q8):** `server/catalog/bulk/word-match.ts` matches a typed word to a label or key ignoring
  case, spaces and punctuation (a word two values share matches neither) and names the closest by edit distance.
  A category matches a full path or a slug, never a bare name (`categoryMatcher` in `sheet-tabs.ts`). The dry
  run now checks category, kind, brand, every answer and yes/no — a miss reads "{Column} '{value}' isn't in the
  list — pick from the dropdown. Did you mean '{closest}'?" and creates nothing. An answer outside its list is a
  problem, no longer kept as `unlisted` (was categories D8's keep-and-flag); a yes/no that is neither is no
  longer read as no. Families match by the same rule. A bare name two categories share matches neither, even
  where it is one's slug. A row's brand is written as `brandId` only when the sheet has a Brand column — a blank
  cell clears it, no column (an old sheet, a CSV) leaves an updated product's brand as it was.
- **Reading (D5):** each row keeps its cells' addresses; `RawSheet.createdOn` holds an .xlsx's creation date for
  U3's unstamped warning (Q28). Create payload: `categorySlug` is the cell as typed; optional `brandName`.
- **Tests:** `tests/unit/bulk-sheet-lists.test.ts`; `bulk-vocabulary`, `bulk-upload`, `bulk-sheet-download`
  integration extended. Mutation-tested: unlisted answer kept (4 fail), yes/no defaulted to no (1), category by
  slug only (1), ambiguous word last-wins (1), closest without a threshold (1), family stops (1), brand miss
  silent (2), kind by key only (1), punctuation kept (3), dry run skips the vocabulary (1), addresses dropped (1), brand
  written without a Brand column (1).

## 2026-11-01 — product-form unit 5: the team adds and fixes a shop's product, with a reason, on record [CONTRACT] [MIGRATION]

- **Admin edit and add for a shop** (R10; D12; Q12): `/admin/products/[id]` gains "Edit for shop" and
  the shop's admin page "Add product for this shop"; both open the shop's own form
  (`/admin/products/[id]/edit`, `/admin/orgs/[orgId]/products/new`) with the banner "Editing for {Shop}.
  The shop will see 'Edited by Bhendi Bazaar team'." and "Why are you changing this?". The save reads
  "Save for shop" / "Put on sale for shop"; success toasts "Saved. {Shop} will see what changed." (a
  create goes to the product). An archived product shows "This product is archived. Restore it to
  edit." with "Restore"; a shop with no pickup address shows "{Shop} has no pickup address yet. Add one
  for them first." The team keeps no device draft (one device serves many shops) and adds no location.
- **Team saves** (R11, A7; D11; Q13, Q21, Q22): `server/catalog/product-team.service.ts` calls the same
  `productsService` create and edit with the admin as editor (`teamEditedAt` set, the version bumped,
  the conflict rebase unchanged), the org always the product's or the path's. Then one
  `recordAdminAction` entry — `PRODUCT_TEAM_CREATED` / `PRODUCT_TEAM_UPDATED`, metadata `{ orgId,
  reason, changes }`, each change `{ field, at?, before, after }` with money first, then stock, then the
  rest (`server/catalog/product-team.ts`, paise). A failed record never fails the save (ADR-0021).
- **Routes** (D12), all `requirePlatformAdmin`: `POST /api/admin/orgs/[id]/products`,
  `PATCH /api/admin/products/[id]`, `POST /api/admin/products/[id]/restore`, and the shop-scoped
  twins the form calls — `products/readiness`, `listing-values`, `families`, `upload/token`,
  `upload/confirm` under `/api/admin/orgs/[id]/`. The listing client takes a prefix
  (`listingApiPrefix`), so the form's reads follow its portal.
- **[MIGRATION]** `20261101152500_admin_log_resource_index`: `AdminLog` index on (resource,
  resourceId) for U6's history read. Additive.
- **[CONTRACT]** `teamProductFormSchema` / `teamProductEditSchema` = the shop's schemas + required
  `reason` (3–200, trimmed; "Say why — the shop will read it."); `ProductDetails` gains read-only
  `archivedAt`. `CONTRACTS.md` Products section updated.
- **Tests:** `tests/unit/product-team.test.ts` (money-first diff, keyed facts, create against nothing,
  reason required); `tests/unit/product-form-team.test.tsx` (banner, "Save for shop", no `disabled`,
  empty reason sends nothing, reason and `seenVersion` sent, no draft);
  `tests/integration/product-team-edit.test.ts` (A7 one entry with reason and price first, the mark;
  body org ignored; saves when the audit fails; archived refused then restored; team create).
  Mutations, each restored: archived check removed (1 failed); body org allowed over the product's
  (1 failed); audit written without the never-throw wrapper (1 failed); create without the team editor
  (1 failed); money moved after the rest (2 failed); reason min 0 (3 failed); schema without the reason
  on the client (2 failed); team draft kept (1 failed); an admin product route writing through
  `admin.product.service` directly (portal-boundary, 1 failed).
- **Gate edits:** `portal-boundary` "the admin tree no longer mutates products" becomes "every admin
  product write is a team save" (the TRD's D12 supersedes it; `(admin)/admin/products/new` still must
  not exist). `product-form-readiness` and `product-form-category-change` mocks keep the real
  `listingApiPrefix` and assert the `/api/org/org-1` prefix.
- Q12, Q13, Q21, Q22 → implemented (unit 5).
- **Review fixes:** the after-snapshot and diff run inside the audit's never-throw guard, so a read
  failing after the commit cannot 500 a saved product (ADR-0021); stored facts and measurements are
  read through `parseStoredFacts`/`parseStoredMeasurements` (ADR-0051); stock changes are keyed
  `name (orgAddressId)` so two same-named locations stay apart; `teamProductEditSchema` drops `orgId`
  instead of the route faking one (the sale-price rule shared via one tuple); the team badge's ux.md
  line now reads `· {date}`, as built; a stepped team create without a reason is tested.
- **Parked Q37:** the ux "Empty" row's "Add location" needs an admin address write path the TRD's D12
  does not list; the empty state links back to the shop meanwhile.

## 2026-11-01 — order-fulfilment unit 4: signed courier updates, conflicts, delivery emails [CONTRACT] [MIGRATION]

- **Signed webhook** (R8, A4; D9, Q7): the courier webhook moved to `POST /api/webhooks/shipping/tracking` (the old
  `/shiprocket` path is deleted; community reports say Shiprocket refuses a URL naming it). It requires `x-api-key`
  equal to the new `SHIPPING_WEBHOOK_TOKEN`, compared over SHA-256 digests with `timingSafeEqual`
  (`server/shipping/courier-token.ts`) before the body is read; missing, wrong or unset is 401. A failure applying an
  update is now 500 so Shiprocket retries (Q32), not 200. Same-origin exemption, rate-limit registry and
  route-reachability follow the new path. **Ops:** set the token in every deployment and register the new URL with it.
- **Courier updates** (R9, A5; D10): `server/checkout/courier-update.ts` moves the parcel through `moveParcel` (a
  repeated "Delivered" moves once, under the order lock). Shiprocket's "PICKED UP" was unmapped and now maps to
  `picked_up`. The buyer is emailed "Delivered: order {code}" once per parcel (`NOTICE_KIND.DELIVERED`). A differing
  `etd` (Shiprocket's sample field, its India day) replaces the ETA by compare-and-set while the parcel travels, writes
  an `eta_changed` timeline row ("New delivery date: {eta}" for the buyer, "ETA {old} → {eta}" for the admin, no shop
  line, as ux.md has it) and emails the buyer "New delivery date: {eta}" once per change.
- **Conflicts** (R8, A13; D10, Q32): an AWB no parcel carries, or a courier move on a cancelled parcel (decided from
  the locked move's outcome; the courier echoing our cancel is not one), is a `CourierConflict` row, answered 200.
  Admin pickups gains a "Conflicts" tab with the open count: open first, a cancelled parcel's row in red, one row per
  AWB with "{n} updates", "Show details" for the raw body, "Find parcel" / "Open Shiprocket", "Dismiss" (dismisses
  the AWB's open rows; "Dismissed." toast; resolved rows greyed "Dismissed by {name}"), 50 more per "Load more",
  "Couldn't load conflicts." on error. `POST /api/admin/courier-conflicts/[id]/dismiss`. "Hide details" added to ux.md.
- **[MIGRATION] `20261101150100_courier_conflicts`**: the `CourierConflict` table and two indexes. Additive.
- **[CONTRACT]** CONTRACTS.md: the webhook's path, token and answers; the dismiss route.
- **Mutations** (each made a test fail, then restored): M1 the unset-secret check dropped; M2 any token accepted; M3
  the route's token check removed; M4 the failure answer made 200; M5 the cancelled-parcel conflict removed; M6 the
  courier's cancel echo made a conflict; M7 an unknown AWB dropped unrecorded; M8 the same-day ETA skip removed; M9
  the delivered email removed.
- **Review fixes:** the Conflicts tab counts distinct open AWBs, as the list folds them; "Find parcel" opens Ready (an
  unknown AWB is most often a parcel booked on Shiprocket but never here); a numeric AWB must be a safe integer, so a
  rounded one is refused with 400 rather than filed as a false conflict. M10: the count reverted to raw rows fails A13.
  Tests: `tests/integration/courier-updates.test.ts`, `tests/unit/courier-token.test.ts`.

## 2026-11-01 — own-store/bulk-sheet unit 1: the download page, Instructions, a tab per type, the example row, Video help [CONTRACT]

- **Get the sheet (D1, D12; R1; Q2, Q16, Q29):** `/org/[orgId]/products/bulk` is now four steps (Get the sheet ·
  Fill it · Upload · Check and create). Step 1 ticks categories by path, grouped by the tab each makes
  (`groupForTicking`), prefilled from the categories the shop sells in, searchable and collapsed past 60; read
  through `src/data-access-layer/org/bulk-sheet.dal.ts` → `bulkSheetService.choices`. "Last downloaded" is kept
  per shop in the device's storage, read safely. Nothing ticked is refused on tap, never disabled; no pickup
  address shows "Add location". Entry renamed "Add many at once".
- **The workbook (D1, D2; R3, R11, A1; Q3, Q5, Q9, Q25):** `GET …/products/bulk/sample` takes `?categories=`
  (was `?types=`). `planSheetTabs` makes one tab per type the ticks resolve to, Other last; each tab's category
  dropdown offers only its own. Instructions first (five steps, colour key, photo and video lines, made-on date).
  Each tab: column A Problems, orange required headings, a hidden key row, a help line, one greyed example whose
  name reads "EXAMPLE — this row is skipped"; headings and Problems frozen. The Types and How to fill tabs are gone.
- **Reading it back (A5):** `parseSheet` reads every visible tab with the key row by key, past the help line,
  skipping the example while its marker stays and never reading Problems; a sheet with only the example answers
  "Your sheet has no products yet — the example row is skipped." A .csv or older .xlsx reads by heading, as before,
  and never from Instructions. A tab is known by `name` and `price` on its key row, so deleting Problems breaks
  nothing. Each row carries its `tab`; create and SKU plans key rows by index (tabs share row numbers), and the
  create payload carries each row's sheet `rowNumber`/`tab` for messages. Problems do not yet name the tab (U3:
  `RowError.tab`) and dropdowns still offer slugs (U2).
- **A8:** a non-link Video cell reads "Not a YouTube link: "{value}" — add a video file from the product form after upload".
- **Tests:** `tests/unit/bulk-sheet-tabs.test.ts`, `bulk-sheet-columns`/`bulk-sheet-build` rewritten for the tab
  shape, `tests/integration/bulk-sheet-download.test.ts`. Mutation-tested: example skip removed (2 fail), Problems
  read as data (2), help row read (3), empty refusal removed (1), type grouping removed (15), A8 suffix dropped (1),
  keyed-tab check back to cell A2 (1).
## 2026-11-01 — order-fulfilment unit 3: booking, label, date change, India-time timeline [CONTRACT] [MIGRATION]

- **Booking** (R5, R6, A3; D11; Q4, Q23): `POST /api/admin/shipments/[id]/booking` → `bookPickup`
  (`server/checkout/fulfilment-booking.ts`), one `moveParcel` into `pickup_booked` that carries pickup date, ETA,
  courier, AWB, tracking and label links (`applyStatus` writes them with the status). The partial unique index on the
  AWB decides a clash, even two admins at once; the holder is then named ("This AWB is already on {code}." on the AWB
  field). Refusals: not ready, "The buyer cancelled this parcel. Cancel it on Shiprocket too.", "Already booked by
  {name} at {time}." (the admin's name is kept on the timeline row). `parcel-moved.ts` writes the buyer's "Your order
  ships {day}" (dates, tracking link; buyer email from `buyer-contact.ts`) and the shop's "Pickup booked for {day}"
  (links to the parcel page, never the label, Q26). The order confirmation's "Estimated Delivery: N/A" now reads
  "We'll email the delivery date once your parcel is booked."
- **Date change and picked up** (R5): `PATCH` on the same path → `changePickupDates`, compare-and-set on the date the
  panel opened with (and the ETA as read); one `pickup_moved` timeline row and a shop email per change, the buyer's
  only when the delivery day moved (`Notice.ref` = the row, so a second change emails again). Saving the dates as
  booked writes and sends nothing. The form is keyed by the booked dates, so a second change from the same row
  sends the new date as seen. Days are real calendar days ("2026-02-30" is a field error). "Changed to {day} by {name} at {time}." when someone moved it first. `POST
  …/picked-up` → `markPickedUp` (Q4), emailing the shop "{code} picked up".
- **Label** (R6; D7, Q26): `GET /api/org/[orgId]/shipments/[id]/label` streams the stored link for the parcel's own
  shop only while booked; https, a Shiprocket host allowlist checked at booking too (`server/shipping/label.ts`,
  INTEGRATIONS.md, unverified), no redirects, 10 s. The shop card shows "Pickup booked for {day} · {courier} · AWB
  {awb}" and "Download label".
- **Timeline** (R7, A14; D5): `ParcelTimelineDto` from `parcelTimelines` (`server/checkout/parcel-timeline.ts`), dates
  in India time (`indiaTime`, `calendarDay` in `server/shared/india-time.ts`; `@db.Date` days read as themselves).
  One `ParcelTimeline` component (`src/components/order/timeline/`) words it per reader from ux.md's table, on the
  shop parcel page, the buyer's order page ("Arrives by {day}", "Track parcel", "Arriving in {n} parcels") and the
  admin order console. The buyer's cancelled line gains its refund state with unit 5.
- **Admin pickups** (ux.md "admin pickups"): tabs Ready (default) · Booked · Not packed, with counts; Ready oldest
  first, amber "Waiting {n} h · Ready for {n} h — book today" past 24 h; Booked by pickup day, red "Pickup was due
  yesterday · No courier update since booking."; 50 per page ("Showing 51–100 of 120", Previous / Next), filtered
  by shop or city from the row; "Book pickup", "Change pickup date", "Mark picked up" there and on
  the order console. Book and re-date use `FormDialog` (bottom sheet on phone, dialog from `md:`) with
  `useServerForm` and native date inputs, rather than the TRD's side sheet and `ResponsivePicker` — no new
  `MAY_USE_SHEET` entry. Copy added to ux.md where it had none: "Enter the delivery date.", "Enter the courier.",
  "Label link must be the link Shiprocket gives you.", "Pickup was due {n} days ago", the picked-up toast.
- **Deleted** (Q30, Q36): the tracking route, `ShipmentTrackingForm` and its client and schema;
  `PATCH /api/admin/orders/[id]`, `adminOrderApiClient`, `updateOrderStatus`, `updateOrderStatusSchema`,
  `orderRepository.transition`/`setNotes`, `ORDER_TRANSITIONS`, `OPERATOR_SETTABLE_STATUSES`. The orders table shows
  the status read-only.
- **[MIGRATION] `20261101100200_parcel_booking`** drops one index (`Notice_shipmentId_kind_audience_key`, replaced by
  one that adds `ref`; no data goes): adds `Shipment.pickupDate`, `labelUrl`; `estimatedDelivery` becomes `DATE`
  (nothing wrote it before); blank AWBs become null, a duplicate AWB stops the deploy, then a partial unique index;
  `ParcelEvent.pickupDate`, `estimatedDelivery`, `actorName`; `Notice.ref`.
- **Mutations** (each made a test fail, then restored): M1 the AWB-clash catch removed (two cases fail); M2 the
  seen-date condition dropped from `movePickupDates`; M3 the org check dropped from `labelLinkFor`; M4 the label host
  check made always-true; M5 "delivery after pickup" made `>=`; M6 the booked-only check dropped from `labelLinkFor`;
  M7 the form's key removed (second change sends the first date); M8 the no-op skip removed (server and client); M9
  the buyer notice sent on a pickup-only move.
  Tests: `tests/integration/parcel-booking.test.ts`, `tests/unit/parcel-booking.test.tsx`.

## 2026-11-01 — product-form unit 4: edit overview, drafts, leave sheet, version and conflict rebase [CONTRACT] [MIGRATION]

- **Edit overview** (R7; D1): editing opens at five section cards (Photos and video, What it is,
  Price & stock, Details, Review), each a one-line summary, its error count and, on Details, "{Channel} will
  ask: {fact}". A card opens that section alone (full screen on a phone, beside the cards from `md:`,
  buyer preview at `lg:`); one "Save changes" saves the product, "Saving…" while it does, never
  disabled, a second tap ignored. Toast "Saved. Live on your store now." and back at the overview. The
  sections are U1's `ProductSections`, so create and edit cannot drift. The editable long form is gone;
  the read-only view stays.
- **Version compare-and-set** (R9, A6; D6, D7; Q11, Q35) **[MIGRATION]**
  `20261101140400_product_edit_version`: `Product.version` (default 0), `lastEditedById` (Restrict),
  `lastEditedAt`, `teamEditedAt`; additive, no backfill. `updateProduct` opens its transaction with a
  guarded `updateMany` on (id, org, version) that bumps it and names the editor; count 0 is a
  `ConflictError` on path `seenVersion` before stock, media or fields move. The wording
  (`server/catalog/product-edit.ts`): "Bhendi Bazaar team changed this product 2 min ago. We loaded the
  latest and kept your changes — check and save." — the team, never an admin's name.
- **Rebase** (D8): on that 409, or the stock 409, `useEditRebase` refreshes the page's props, resets to
  the latest product and lays the seller's changed fields back over it, marked "Your change kept:
  Price". After a sale the stored stock wins: "2 sold while you were editing. Stock is now 8."
- **Drafts and the leave sheet** (R8, A5; D9, D10; Q10): `useFormPersist` stores a saved-at time and a
  `seenVersion`, writes only once something changed, and offers a draft older than 7 days ("We kept what
  you typed on 22 Oct. Use it?" · "Use it" / "Start fresh") instead of restoring it; a recent one comes
  back with "We kept what you typed at 4:12 pm." · "Discard". Edit drafts are per product and keep
  their version, so a stale one is refused and rebased; stock is never drafted. A copy-from start is
  never restored. `useLeaveGuard` opens "Leave without saving?" · "Your changes to {sections} will be
  lost." · "Keep editing" / "Leave" on close, same-origin links and the back gesture, create and edit.
- **[CONTRACT]** `productEditSchema` (`productFormSchema` + required `seenVersion`) on
  `PATCH /api/org/[orgId]/products/[id]`; the org `ProductDetails` gains `version`, `lastEditedAt`,
  `lastEditedBy` (name) and `teamEditedAt`. `CONTRACTS.md` Products section updated.
- **Tests:** `tests/unit/product-form-edit.test.tsx` (R7 cards and one open section; A8 no `disabled`
  over every section; A5 leave sheet on back and none when clean; draft restore with its own
  `seenVersion`, stale "Use it?"; A6 refusal reopens the latest with the price re-applied and marked
  and saves at the new version; stale stock; conflict wording). `tests/integration/product-edit-version.test.ts`
  (A6 on a real schema: a second save from version 0 writes no field and no stock, names the member;
  a team save marks and the shop's next clears). `offer-ceiling` and `product-edit-keeps-facts` follow
  the new signature and the overview. Mutations, each restored: the `version` clause dropped from the
  guarded update (2 failed); the count-0 check never firing (2 failed).
- **Gate edits:** `product-visibility` CENSUS for `product.repository.ts` 24 → 25 reads: `versionConflict`
  sees archived products on purpose (it only words a refused save of the product being edited).
  `src/lib/format.ts` gains `formatTime` ("4:12 pm") for the draft line, so the locale gate holds.
- Q10, Q11 → implemented (unit 4); Q35 → decided (form save implemented in unit 4; team and sheet saves bump version later).

## 2026-11-01 — seller-onboarding unit 3: Home, the five-step setup list, return to Home [CONTRACT] [MIGRATION]

- **Setup list (D5; R3, A1, A6; Q2, Q3, Q19):** `deriveOnboarding` takes products on sale, a pickup-ready
  location (active, street, contact), logo and tagline, the first share and the hide mark; it returns five
  steps in Q19's order, `doneCount`, `next`, `complete`, `hidden`. Channel readiness left the list (Q4).
- **Two marks (D6; Q6, Q23):** `Org.setupHiddenAt`, `Org.firstSharedAt`, written by `orgRepository` with
  conditional raw updates (a repeat writes nothing; `updatedAt`, the contact version, is untouched). Routes
  `POST`/`DELETE /api/org/[orgId]/setup/hidden`, `POST …/setup/shared` (`withOrg`), called by `setupApiClient`.
- **Home (D7; R2; Q5, Q14, Q22, Q24, Q25):** `/org/[orgId]` reads through `src/data-access-layer/org/home.dal.ts`,
  one try/catch per line: shop name and link, "Needs you now" (orders to pack, new reviews in 7 days — the product
  when all on one —, the first channel needing attention, photo proposals awaiting a decision, a live auction
  ending within 24 h; zero hides, a failure keeps its own retry, three shown then "See all {n}"), the setup list
  (hide with Undo toast, a hidden list keeps its "Show" row where More → Setup list lands, done collapses to
  "Your shop is set up."), then the numbers (Q14's line before the first paid order, 4-up from `lg:`, "Updated
  {n} min ago" + Refresh past 15 min). Skeleton while reading. `onboarding-card.tsx` deleted; the channel banner
  moved to a Home line. New counts: `reviewService.newForOrg`, `enhancementService.countAwaitingDecision`.
- **Return to Home (D8; R7):** `RETURN_TO` (`src/components/org/home/return-to.ts`) parses `from` against a closed
  set; product create, a new pickup address and Shop details (once logo and line are both in) go to
  `/org/[orgId]?done=<step>`, and Home toasts "Product added · {n} of 5 done" etc. Product form wired here (Q
  "whichever lands second").
- **[MIGRATION] `20261101130300_org_setup_marks`**: two nullable columns, no backfill; drops nothing.
- **Review fixes:** Home passes the parcels and paid-orders figures it read to `DashboardWidgets` (`prefetched`),
  so the grid does not query them twice; "See all {n}" counts lines (Q30), ux.md's example corrected.
- **Gates:** `file-cohesion` RECORDED gains `home.dal.ts` (analytics, bidding, catalog, channels, content).
  Tests: `tests/unit/org-onboarding.test.ts`, `tests/unit/return-to.test.ts`, `tests/unit/home-attention.test.ts`,
  `tests/integration/seller-onboarding-home.test.ts`.
- **Mutations** (each made a test fail, then restored): M1 hide's `IS NULL` condition removed; M2 first-share's
  `IS NULL` removed; M3 unhide's `IS NOT NULL` removed; M4 the contact-name check dropped from pickup-ready;
  M5 the visible-review filter dropped from the new-review count; M6 `parseReturnTo` accepting any string.
- Decisions Q2, Q3, Q4, Q5, Q6, Q14, Q19, Q23, Q24, Q25 → implemented (unit 3).

## 2026-11-01 — storefront-themes unit 1: theme tokens, twelve palettes, fonts, the contrast gate

- **Registry (D1; R1–R3, Q18):** new `server/catalog/storefront-themes.ts` declares the closed theme set (Edge, Darbar,
  Bloom, Daily), three palettes each with a fixed tone, faces per role, phone columns, and `readStorefrontLook`, which
  parses stored keys (unknown theme → unthemed; a palette from another theme → the theme's first). Nothing calls it yet.
- **Tokens (D2):** `src/app/globals.css` gains storefront roles — `text-headline/-title/-body/-tag/-price` (each
  size a `clamp()` with a rem floor), `tracking-headline/-tag`, `py-section`, `px-gutter`, `gap-grid`, `max-w-store`,
  `shadow-tile`, `font-display`, `font-label`, `duration-theme`, `ease-theme` — and four `[data-theme]` scopes from
  the spec's theme cards. `--radius-card`/`--radius-field` move out of `@theme inline` so a scope can repoint them
  (values unchanged outside a theme). Reduced motion zeroes `--motion-duration`. All registered in `cn`.
- **Palettes (D3; Q5):** twelve `[data-palette]` scopes over 60 new primitives (13 new families in `FAMILY`), each
  repointing every colour role, status colours included, plus new `deal` and `feature` roles and `color-scheme`.
  The `dark` variant now skips `[data-palette]` subtrees. `--color-photo-scrim` / `--color-on-photo` for hero text.
- **Fonts (D5; Q7, Q30):** new `src/components/storefront/theme-fonts.ts` loads Space Grotesk, Geist Mono, Jost,
  Cormorant Garamond, DM Mono and Mulish through `next/font/google`, `preload: false`, `display: swap`; Bloom reuses
  the root's DM Sans. Not yet mounted (U3), so no page changes and CSP is untouched.
- **Gates:** new `storefront-palettes.test.ts` (D4: every text role 4.5:1 and control edge 3:1 per palette, tone
  agrees with ground, `dark:` inert, scrim text over white and black photos) and `storefront-themes-registry.test.ts`
  (A1: themes differ pairwise in ≥3 non-colour roles; scope per key and key per scope; ≤2 families; fonts not
  preloaded; key parsing). `cn-tokens` and `design-tokens` extended. The scrim test failed first at 70% (2.99:1 on
  white); raised to 85%.
- **Mutations recorded:** `--umber-450` lightened to L 0.6 → three Darbar palettes red; `dark` variant unguarded →
  red; scrim back to 70% → red; lilac scope renamed → red; Mulish `preload: true` → red; Daily given Edge's values
  for all but two roles → A1 red; Edge headline `6vw` → red; `cn` without `tile` → red; reduced-motion 1ms → red.
  All restored.
- **Review fixes:** the `dark` guard sits inside `:where()` so `dark:` utilities keep their old specificity; status
  roles and `primary` on the page ground joined the gate, and the primitives that failed were darkened; `text-deal`
  and `text-feature` are not registered — those roles are fills only.
- `docs/ARCHITECTURE.md` test-file count 264 → 266. Decisions Q5, Q16, Q30 → implemented (unit 1); Q7 stays decided until U3 mounts the faces on storefront routes only. Suites:
  `tsc`, `vitest tests/unit`, `lint:boundary`, `docs:check`.
## 2026-11-01 — order-fulfilment unit 2: ready, trimmed buyer details, nudges, 36 h flag [CONTRACT] [MIGRATION]

- **Ready** (R3, A1; D6): `POST /api/org/[orgId]/shipments/[id]/ready` → `markParcelReady`
  (`server/checkout/fulfilment.service.ts`), through `moveParcel` with `paidOnly`. Another shop's parcel or an
  unpaid one is 404; a cancelled one is ux.md's "This parcel was cancelled by {who} on {date}. Don't send it."
  (India day, `server/shared/india-time.ts`); one already moved is "This parcel is already …". The shop parcel
  page shows only the shop's parcels, "Ready for pickup" docked above the tab bar (in the card header at `lg:`),
  the confirm sheet ("Is everything packed and sealed?" / "Yes, it's ready"), the toast, the retry toast,
  the first-order hint and "Show all {n} items" past 30 lines (`src/components/org/parcels/`). Never disabled.
- **Trimmed buyer** (R3, A10; D7; Q22): org reads are `ShopOrderView`/`ShopParcelView`
  (`server/checkout/shop-parcel.types.ts`) through `adminOrderRepository.listShopOrders`/`getShopOrder`; the
  address is trimmed to name, city, pincode by `toShopBuyer`. The shop list has tabs To pack · Ready · On the
  way · Done · Cancelled (one row per parcel, "Parcel 1 of 2 · Ready"), "Search order number", Load more by
  20, "Updated {n} min ago" with Refresh past five minutes, and ux.md's empty, first-use and error lines. The
  admin org console's Orders tab uses the same list. Deleted (Q36): the org transition route, its button and
  client, `transitionForOrg`, `OrgOrderView`, `org-orders-table`/`-filters`. The admin tracking form now needs
  the shop's "ready" (409 otherwise) instead of the order-wide "packed".
- **Notices** (R4, A2; D8; Q8): `Notice` (notifications), unique on (parcel, kind, audience), written on the
  move's transaction by `noticeService.write`; only a new row enqueues `notify.send`. The handler
  (`notifications.jobs.ts`) skips a sent row and keys Resend on the notice id. `parcel-moved.ts` writes the
  admin's "Parcel ready to book — {shop}, {city}" when the shop (not an admin) marks ready.
- **Nudges and the 36 h flag** (R3a, A11; D18; Q24): `fulfilment.sweep` (`server/checkout/fulfilment.jobs.ts`,
  hourly, the 4th of 4 schedules) writes "1 parcel waiting to be packed" at 12 h and 24 h after `paidAt` (a parcel
  already past 24 h gets only the 24 h one) and "Waiting 24 h: parcel {code}" for a parcel ready 24 h. New
  `/admin/orders/pickups` (admin nav "Pickups") holds the "Not packed" tab: paid parcels unready 36 h on, oldest
  first, filter by shop, the shop's city and phone, "Shop emailed at 12 h and 24 h" / "+ you emailed {n} h ago",
  "Paid 3 days ago, not ready." red past 72 h, and "Email shop" (`POST /api/admin/shipments/[id]/email-shop`,
  once per parcel, toast "Email sent to {shop}.").
- **[MIGRATION] `20261101100100_fulfilment_notices`** drops nothing: adds `Order.paidAt` (stamped by
  `confirmPaid`; backfilled from `createdAt` for paid orders) and `Notice`, and pre-fills sent notices for parcels
  already waiting so the first sweep emails no one. A `packing` parcel of a paid order the shop had already
  marked `packed` moves to `ready_for_pickup` (seeded `system` ParcelEvent, `ready`/`ready_24h` pre-filled), so
  the stricter tracking form does not send it back to the shop.
- **Review fixes**: both shop order pages run their own `requireOrgMember` and render ux.md's Refused ("You
  don't have access to this shop's orders." · "Go to my shops") on 403; "Email shop" finds its one parcel by id
  and the "Not packed · N" count is uncapped (`countNotPacked`); the not-packed list is a table at `lg:`
  (`not-packed-list.tsx`); the second-press refusal is added to ux.md's matrix.
- **Mutations** (each made a test fail, then restored): M1 shop scope dropped from `markParcelReady`; M2 `paidOnly`
  check removed; M3 `insertOnce` answers a row on a duplicate; M4 the shop-only condition on the ready notice
  removed; M5 the buyer trim bypassed; M6 the sent-row skip removed; M7 the 12 h window's lower bound removed;
  M8 the 36 h threshold set to zero; M9 `paidAt` not stamped; M10 the tracking route's `packing` refusal
  disabled (the D6 tracking-form case fails). Tests: `tests/integration/parcel-ready.test.ts`,
  `tests/unit/parcel-ready.test.tsx`.

## 2026-11-01 — seller-onboarding unit 2: the create screen shows the link it makes

- **Create screen (D4; R1, A1; Q21, Q27):** `/org/new` previews "Your link: {host}/store/{handle}" as the name is typed,
  using the server's own `handleCandidates` in the browser (so a reserved word skips to `-2` exactly as the insert does);
  a long handle is cut in the middle. The host comes from `appUrl()`, never a constant. Words live in
  `src/components/org/open-shop-copy.ts`. Body and route unchanged (`POST /api/orgs`, `ACCOUNT`, org-profile U1's schema).
- **States (ux Create your shop):** a spinner on "Opening your shop…" (still tappable, still one shop); "Still opening…
  don't close this page." after 3 s; a dropped connection or a 5xx shows "Couldn't open your shop. Check your internet and try again." with "Try again"
  (never the server's generic message), a refusal shows its
  message without one; field messages unchanged. From `md:` the form sits in a centred 28rem card (ux Phone / tablet / desktop).
- **Signed out (ux Refused):** the page says "Sign in to open your shop." and opens the sign-in sheet, which refreshes the
  page in place. `src/middleware.ts` gains `signInAtEdge`, which lets exactly `/org/new` past the sign-in redirect; the
  page still calls `requireSession`, and a blocked account is still refused.
- **Gates:** `open-shop.test.tsx` (preview, reserved word, long link, slow, retry, 5xx copy, terminal error), new
  `open-shop-page.test.tsx` (signed-out prompt, signed-in form on the app's origin, blocked refused, edge exemption).
- **Mutations recorded:** every failure made retryable → terminal-error test red; preview built by a local slugify instead
  of `handleCandidates` → reserved-word test red; edge exemption widened to a `/org/new` prefix → edge test red; the page
  swallowing every session error → blocked-account test red; slow timer at 30 s → slow test red. All restored.
- Decisions Q21, Q27 → implemented (unit 2). Suites: `tsc`, `vitest tests/unit`, `lint:boundary`, `docs:check`.

## 2026-11-01 — org-profile unit 5: copy sweep, the org code hidden from the shop

- **Code hidden** (R8; D9): the shop switcher and the `/org` "Choose a shop" list show the shop's name and the
  person's role, no longer `Org.code`. `orgMemberRepository.listOrgsForUser` stops selecting `code`, so it no
  longer reaches the switcher's client props. The coupon prefix on the offer form still names the code
  (promotions D13); kept by Q28, a ratchet entry pointing at it. The product form is still sent the code as its
  photo upload folder, never rendered for one shop (Q29).
- **Copy sweep** (A4; D9; Q12): the portal copy scan (seller-onboarding D14) now refuses "Description",
  "Introduction", "Business Name", "Accent", "Contact Person", "Block 1 heading" and the old placeholders
  ("John Doe", "org@example.com", "ABC Traders") anywhere in the seller portal, and any rendered org code. No
  portal file needed a copy change; units 1–4 had already moved them. Admin forms are out of scope (Q22). The
  code scan matches any `*.code`/`orgCode` in a JSX text child or a `${...}` interpolation, not only `{org.code}`;
  a prop such as `orgCode={org.code}` (a storage path) is not shown.
- **ux states:** no new screen; the switcher and chooser keep their states with one line less.
- Decisions Q1, Q12 implemented; Q28, Q29 logged from review; spec and TRD Implemented.
- **Mutations** (each made a test fail, then restored): M1 `{org.code}` back in the switcher → two tests failed.
  M2 `{org?.code}` in the chooser → the code test failed. M3 "John Doe" in a portal form → the retired-words
  test failed. M4 the swatch label back to "Accent" → the retired-words test failed. M5 the coupon prefix removed
  from an allowlisted page → the stale-allowlist check failed. M6 `` {`${org.name} · ${org.code}`} `` in the
  chooser → the code test failed. M7 `{currentOrg.code}` in the switcher → both code tests failed.
- **Tests:** `tests/unit/portal-copy.test.ts` (three new cases). Ran `tsc`, `vitest run tests/unit`,
  `vitest run tests/integration/shop-details.test.ts tests/integration/shop-contact.test.ts` (local disposable DB),
  `lint:boundary`, `docs:check`.

## 2026-11-01 — org-profile unit 4: Looks — "How you work" retired, accent as swatches [CONTRACT]

- **"How you work" retired, text kept** (R7; D5; Q6): the three Block heading/line pairs leave the storefront
  editor, `storefrontSettingsSchema` (strict, so a `pillars` key is refused), `storefrontService.saveSettings`,
  `PUBLIC_PROFILE_SELECT`, `BrandPageDto`, the section order, the hideable set and the "What your page shows"
  panel. `brand-pillars.tsx` and `pillarsFrom` are gone. `OrgProfile.pillars` and its data are untouched; no
  migration. "Why buy from us" is storefront-themes' (its R8, Q21).
- **Accent as swatches** (A4; D8; Q20): the Shop page's "Accent" select of token names becomes four unnamed
  colour swatches labelled "Colour" (a radio group of `Button`s, "Colour 1"–"Colour 4", each a semantic token
  class; none disabled). No stored accent shows the first swatch as chosen, which is what buyers see then.
- **ux states:** no new screen; the looks card keeps the editor's existing save, refresh and error states.
- **[CONTRACT]** `BrandPageDto.pillars` removed; `storefrontSettingsSchema` narrowed to `heroUrl`, `accent`,
  `hiddenSections`; `"pillars"` leaves `BRAND_PAGE_SECTION_ORDER`/`HIDEABLE_BRAND_PAGE_SECTIONS`. CONTRACTS.md
  updated. Decisions Q6, Q20 implemented.
- **Mutations** (each made a test fail, then restored): M1 `pillars` back in the looks schema → the schema
  refusal test failed. M2 `pillars` back in `PUBLIC_PROFILE_SELECT` → the buyer-payload and select-allowlist
  tests failed. M3 swatch labelled with its token name → the unnamed-swatch test failed. M4 `aria-checked` never
  true → two swatch tests failed. M5 swatch click not setting the value → the save test failed.
- **Tests:** `tests/unit/storefront-looks.test.tsx` (new); `storefront-public-dto`, `brand-page-sections`,
  `brand-page-standing`, `brand-page-render` (pillars removed); `tests/integration/shop-details.test.ts` (column
  kept, buyer page without it). Ran `tsc`, `vitest run tests/unit`, `vitest run tests/integration/shop-details.test.ts
  tests/integration/seller-profile.test.ts tests/integration/brand-page-proof.test.ts` (local disposable DB),
  `lint:boundary`, `docs:check`.

## 2026-11-01 — seller-onboarding unit 1: a phone tab bar, one grouped navigation, a Shop tab, plain names

- **Navigation (D1, D2; Q9, Q10, Q28):** `src/components/layout/portal-nav.ts` declares the shop portal's list once — five
  groups (Sell, Your shop, Grow, Money, Settings), a purpose line per item, four tabs. A phone gets a bottom bar (Home ·
  Orders · Products · Shop · More); More opens the existing `PortalSidebar` drawer, now bottom-anchored and grouped; the
  hamburger goes. `md:` shows an icon rail (label on hover and focus, and always the link's name), `lg:` the full grouped
  sidebar. Help opens the Contact sheet; Setup list points at Home's list (unit 3 builds it). The admin's flat list is
  unchanged. The portal's `<main>` clears the tab bar on a phone.
- **Shop tab (D3; Q8):** new `/org/[orgId]/shop` — link card (Share, Copy link, See as a buyer) and four rows (Shop
  details, Shop page, Pickup addresses, Reviews), each with a one-line status, read by `shop-hub.dal.ts`; a row whose read
  fails shows "Couldn't load. Try again." and the others still render. Row skeletons while it loads.
- **Renames (D14; Q7):** Dashboard→Home, Storefront→Shop page, Locations→Pickup addresses, Earnings→Money you'll receive,
  Library→Photos, What you sell→Brands and defaults; the banner card "Promotions"→"Banners" (its dialog and toasts too);
  the suspended page→"Your shop is paused" with Contact us; seller copy says "shop", never "organisation"; the header's
  "Storefront" link→"See as a buyer". No URL changed. The banner card's arrows, delete and its add dialog are no longer
  disabled: a tap while a change is saving toasts "Saving the last change…", and an arrow with nowhere to go is not drawn.
- **Gates:** new `portal-nav.test.ts` (every `(org)` page belongs to exactly one item, four tabs plus More, a purpose per
  item, Q22 placement; spec A3, R5, R6), `portal-copy.test.ts` (no "organisation" in seller copy, "Banners", nothing
  disabled on these screens; spec A7), `shop-hub.test.ts` (rows fail alone). `PortalSidebar.tsx` leaves `SHAPE_LEGACY`.
- **Review fixes:** the rail's hover label is no longer clipped (the nav scrolls only at `lg:`); the Shop page row reads
  only the section facts (`storefrontService.brandPageSectionFacts`, `storefrontDAL.brandPageForStanding`) — no proof,
  no goods — sharing one rating read with the Reviews row, and a shop with no public page says "not open to buyers yet".
- **Mutations recorded:** banner title back to "Promotions" → copy test red; "organisation" restored on `/org` → red;
  `disabled={busy}` on a banner arrow → red; Bidding removed from `PORTAL_NAV` → nav test red (2); active entry taken as
  the first match instead of the longest → red (Shop hub lit on Shop details); hub reviews read unguarded → shop-hub red;
  inactive addresses counted → red (2). All restored.
- Decisions Q7–Q10, Q28 → implemented (unit 1). Suites: `tsc`, `vitest tests/unit`, `lint:boundary`, `docs:check`. Integration:
  `org-banner-roundtrip`, `shop-details`, `seller-profile`.

## 2026-11-01 — org-profile unit 3: Shop details, the private part [CONTRACT]

- **Name, mobile, email, link** (R5; A3; D7; Q15, Q16, Q23, Q25): the shop name becomes editable on Shop details,
  confirmed in a `FormDialog` sheet ("Buyers will see {new} on your shop and every product. Your link stays
  {link}.", "Change name" / "Keep old name"). "Only Bhendi Bazaar sees this — to reach you about orders and
  payouts" holds the mobile (shared phone field, any country) and the email for order updates, each saving alone.
  The link row reuses `HandleChangeDialog`. `PATCH /api/org/[orgId]/shop/contact` (`withOrg`) parses
  `shopContactSchema`; `shopDetailsService.saveContact` refuses staff with "Only the shop owner can change this."
  (the handle route now says the same), writes only the fields sent, and is a compare-and-set on `Org.updatedAt`
  (`orgRepository.updateContactIfUnchanged`). Order and payout emails and the brand page read `Org` directly,
  so the new name and email apply at once (A3).
- **Old address told** (Q16, Q25): an email change enqueues `org.email-changed` in the same transaction (spec in
  `server/shared/jobs/`, so catalog never imports notifications) and is audited `ORG_EMAIL_CHANGED` after commit
  (ADR-0021); a mobile change is audited `ORG_PHONE_CHANGED` (from/to) the same way. The handler (`server/notifications/notifications.jobs.ts`, registered in `worker/main.ts`) sends
  "Your shop's email was changed" with a Resend idempotency key derived from the job id, so a redelivered job is
  one email, with `SUPPORT_INBOX` as Reply-To since the notice invites a reply. `SendEmailOptions` gains
  `idempotencyKey`. INTEGRATIONS.md records Resend's key window. The worker now sends email: `.env.worker.example`
  and OPERATIONS.md gain `RESEND_API_KEY`, `EMAIL_FROM` and `NEXT_PUBLIC_APP_URL` — **set their
  `WORKER_ENV_<NAME>` secrets before deploying**, or every notice job fails and parks.
- **Tax card** (R6): "Tax and bank details · We'll ask before your first payout. Nothing to do now."
- **ux states built:** Shop details private part — Success toasts ("Saved. We'll call this number about orders.",
  and "Saved. New orders will come to this email.", added to ux.md), Retryable, Terminal (field messages: "Use at
  least 3 letters.", the shared phone message), Refused (owner-only; "That link is taken. Try {suggestion}." —
  the handle change now suggests the first free numbered variant), Stale, Slow. Name sheet — First use, Loading
  ("Changing…"), Success ("Name changed."), Retryable ("Couldn't change it. Try again." with "Try again"),
  Terminal (stays on the field; the sheet opens only for a valid, different name), Refused (with "Close"), Stale
  (a 409 shows the server's copy with "Load latest", which reloads the page as the section banners do), Slow
  ("Still changing…"); bottom sheet below `md:`, dialog from `md:` (the primitive's switch, as the TRD says).
- **Never disabled:** the handle dialog's two buttons lost `disabled` (ADR-0053); a second tap while saving
  sends nothing, as on every Shop details save.
- **[CONTRACT]** `shopContactSchema`; `ShopDetailsDto` gains `phone`, `email`, `contactUpdatedAt`; job
  `org.email-changed`; handle refusal copy. CONTRACTS.md updated. Decisions Q5, Q15, Q16, Q23, Q25 implemented.
- **Mutations** (each made a test fail, then restored): M1 owner check made never-true → the staff-refusal unit
  and integration tests failed. M2 `shopContactSchema` non-strict → the forbidden-field test failed. M3
  `updatedAt` removed from the contact compare-and-set → two integration tests (stale, stale email) failed. M4
  enqueue skipped → the one-job integration test failed. M5 idempotency key dropped → the once-per-job test
  failed. M6 `contactColumns` spreading the whole input → the only-fields-sent test failed (first version used
  `toHaveBeenCalledWith`, which ignores an undefined key; tightened to `toStrictEqual`). M7 the name form
  writing straight away instead of opening the sheet → four sheet tests failed. M8 handle refusal back to the
  old copy → three storefront-service tests failed.
- **Tests:** `tests/unit/shop-contact.test.tsx` (schema, service, private part, name sheet, job),
  `tests/integration/shop-contact.test.ts` (A3, Q21, Q23, Q25), `storefront-service` (suggestion),
  `email-templates` (new template), `shop-details` (fixtures). Ran `tsc`, `vitest run tests/unit`,
  `vitest run tests/integration/shop-contact.test.ts tests/integration/shop-details.test.ts` (local disposable
  DB), `lint:boundary`, `docs:check`.

## 2026-11-01 — Docs cost less to load: the changelog splits by month, the conventions index leaves CLAUDE.md

- **Changelog:** entries before this month move to `docs/changelog/2026-08.md` and `2026-09.md`, unchanged and still
  append-only; `docs/CHANGELOG.md` keeps the current month (727 KB → 238 KB). The numbering check reads every month in
  order; the archive is exempt from the living-doc gates, as the old single file was.
- **CLAUDE.md:** the 61-line conventions index moves to `docs/CONVENTIONS.md` (a living doc in the gate); CLAUDE.md keeps
  the invariants, the SDLC and the seven conventions nearly every change meets, and says when to read the index
  (26 KB → 15 KB on every session). bb-sdlc, `docs/adr/README.md` and `docs/README.md` point at the new home.
- **Why:** both files were paid for on every agent turn of the org-portal build.
- Suites: `docs:check`.

## 2026-10-31 — product-form: a blank number box no longer blocks a save; review fixes for units 2 and 3

- **Blank number = not answered:** measurement and number-fact boxes use `setValueAs` (blank → null), not
  `valueAsNumber` (blank → NaN, refused as "Invalid input"). `useServerForm` gains `prepare`, run before
  validation; the product form passes `keepAsked`, so an answer the chosen type does not ask (a blank
  Length after Abaya → Ring) can no longer block "Put on sale". Review's problem list parses the same way.
- **No-type category drops answers (D5):** `keepAsked` sends no facts, measurements or kind for a category
  with no type, and `answersLost` names them all in the sheet. Answers are dropped only for a category
  changed in this form: an edit that keeps its category sends every stored answer back. `fillListing`'s
  no-type branch now keeps a marketplace answer's mark, as the typed branch does (Q31).
- **`useServerForm` reads `schema` and `prepare` at validation time** (through a ref), so a schema built
  from props (offer, contact, category forms) is never stale.
- **Readiness (R5):** the new-product page passes `sellsElsewhere`; a shop with no other channel never
  asks for hints, so never sees "Checking…". `forUnsaved` reads channels first and returns early.
  `useReadinessHints` drops a kind the current type cannot hold. Malformed JSON to
  `POST /api/org/[orgId]/products/readiness` is a 400 in the envelope, not a 500.
- **Tests:** `product-form-category-change.test.tsx` (blank measurement saves; blank Length after Abaya →
  Ring saves; cleared number fact saves; no-type sheet and save; no leftover kind sent),
  `product-form-readiness.test.tsx` (no "Checking…" for a shop selling nowhere else),
  `product-readiness-preview.test.ts` (bad JSON → 400), `product-edit-keeps-facts.test.tsx` (edit a
  no-type product's name only → every fact, measurement and marketplace mark kept),
  `use-server-form-schema.test.tsx` (schema changed after mount is used). Mutations, each restored:
  edit dropping on an unchanged category (1 failed); no-type fill without `keepMarketplace` (1 failed);
  schema frozen at mount (1 failed); measurement back to
  `valueAsNumber` (2 failed); number fact back to `valueAsNumber` (3 failed); `prepare` skipped before
  validation (2 failed); `keepAsked` keeping all with no type (2 failed); `answersLost` naming nothing
  with no type (2 failed); `sellsElsewhere` ignored (1 failed); leftover kind passed (1 failed);
  bad JSON uncaught (1 failed).
- **Docs:** product-form trd.md D5 states the no-type case, the drop-before-validation and the unchanged-category edit; ARCHITECTURE.md test-file count.

## 2026-10-31 — product-form unit 3: a category change names what it leaves behind

- **Category-change sheet** (R6; A4; D5; Q9): on What it is, picking a category whose product type does
  not ask some answered facts, measurements or the kind opens a `FormDialog` (bottom sheet on a phone)
  in ux.md's words: "Change to Ring?" · "Fabric, Sleeve length, Length won't apply to a ring." ·
  "Keep Abaya" / "Change to Ring". "Keep" (or closing the sheet) leaves the category as it was; a pick
  that loses nothing applies at once. Nothing is disabled. Pure `category-change.ts` (`answersLost`,
  `keepAsked`, the copy) and `useCategoryChange` sit beside the form; `CategoryChangeSheet` renders.
- **Answers kept until save** (Q9): answers stay in form state across category changes, so switching back
  restores them, the kind included (the Kind select remounts per type). The form's submit sends only
  what the chosen type asks (`keepAsked`) and drops a kind that type cannot hold, which the save would
  refuse. A category with no type keeps every answer, as `fillListing` does.
- **Tests:** `tests/unit/product-form-category-change.test.tsx` (A4: three answers listed, "Keep Abaya"
  changes nothing, switch back restores; kind kept; no sheet when nothing is lost; the save sends only
  Ring's answers; ux copy). Mutations, each restored: the picker wired straight to `field.onChange`
  (4 failed); submit sending `data` without `keepAsked` (1 failed); `answersLost` counting blank answers
  as lost (4 failed); the Kind select's `key={type.key}` removed (1 failed).
- **Suites run:** `tsc`, `vitest tests/unit`, `vitest tests/integration`, `lint:boundary`, `docs:check`.

## 2026-10-31 — org-profile unit 2: Shop details, the buyer part [CONTRACT] [MIGRATION]

- **One page for the shop's facts** (R1–R3, R10; A2; D2, D10; Q5, Q11–Q14): `/org/[orgId]/shop/details`,
  a server page reading `ShopDetailsDto` through `shopDetailsService.get`. "Buyers see this — on your shop
  page" heads it; the three essentials (name, logo, one line) come first, then "Add more to your shop
  page" with each row saying what it adds. Every field carries the eye and a line naming where it shows.
  "See as a buyer" opens `/store/[handle]`; at `lg:` a preview drawn from the storefront's own
  `StorefrontIdentity` and `BrandStory`, fed the form's current values (never an iframe). Linked from
  the sidebar, the onboarding "Describe your shop" step and the brand-page panel. The private part
  (name, mobile, email, link, tax card) is U3.
- **Per-section save, no clobbering** (R9; A6; D3; Q17, Q21): `PATCH /api/org/[orgId]/shop/details`
  (`withOrg`, any member, Q23) parses `shopDetailsSectionSchema`, a strict union on `section`; each
  section whitelists its own fields and carries `expectedUpdatedAt`. The repository writes only that
  section's columns by `updateMany` on (orgId, updatedAt); a miss is a `ConflictError` with ux's
  "Someone changed this N min ago. Load their version?". Every ux state of the buyer part: First use,
  Empty, Loading (`loading.tsx`), Partial, Success toast, Retryable banner with "Try again", Stale banner
  with "Load latest", Long content counter from 3,600, and Slow ("Still saving…" after 3 s). Save is never
  disabled; a second tap while saving sends nothing.
- **Storefront editor narrowed to looks** (D3, R7): `storefrontSettingsSchema` is strict over `heroUrl`,
  `accent`, `pillars`, `hiddenSections`, and `saveSettings` writes only the fields it is sent, so it can
  no longer null a fact Shop details owns. Logo, tagline, introduction, story, area, person, socials
  and terms left the editor. Pillars and accent stay until U4.
- **"About your shop" without loss** (R4; A5; D4; Q4, Q18): pure `aboutOf` in `storefront.types.ts`
  joins the introduction and the longer story (blank line between) until the shop saves About, then
  returns the saved text alone. The buyer page, the storefront metadata and the box all read it, so
  buyers see the same words from deploy. The box opens prefilled with "We joined your introduction and
  longer story. Check it and save." Saving stamps `storyMergedAt`; `story` is kept and never shown again.
- **Delivery and returns** (R7; D6; Q7, Q19, Q27 new): `returnsPreset` (standard, 7-day exchange, no returns)
  and `promiseNote` (280). Buyers no longer see `deliveryPolicy`/`returnsPolicy`; the shop sees its old
  text read-only with "Copy into note". "This shop's terms" shows for a non-standard preset or a note.
- **[CONTRACT]** `ShopDetailsDto`, `shopDetailsSectionSchema`, `RETURNS_PRESET`; `BrandPageDto.about` is
  `aboutOf`, `story` always null, `deliveryPolicy`/`returnsPolicy` replaced by `returns: { preset, note }`;
  `Storefront` loses both policies; `storefrontSettingsSchema` narrowed. `PUBLIC_PROFILE_SELECT` drops the
  two policies and gains `storyMergedAt`, `returnsPreset`, `promiseNote` (allowlist test updated).
  `FormField`'s `hint` takes a node, for the eye icon. CONTRACTS.md updated.
- **[MIGRATION] `20261031100200_shop_details_buyer_part`**: enum `ReturnsPreset`; `OrgProfile.storyMergedAt`,
  `returnsPreset` (default `STANDARD`), `promiseNote`. Additive; no text rewritten, nothing dropped.
- **Mutations** (each made a test fail, then restored): M1 compare-and-set's `updatedAt` removed from the
  where → the stale-version integration test failed. M2 essentials schema made non-strict → the
  cross-section and forbidden-field tests failed. M3 `aboutOf` ignoring `storyMergedAt` → the merged case
  failed. M4 `storefrontSettingsSchema` made non-strict → the looks-only test failed. M5 the place section
  also writing `tagline` → three integration tests failed. M6 `saveSettings` back to writing unsent
  fields as null → the narrowed-save integration test failed. M7 `OrgProfile.returnsPolicy` removed
  from the schema → the kept-columns guard failed. M8 the section's `formError` line removed → the
  403-refusal test failed.
- **Review** (fresh context): a refusal other than stale or network (403, 404, 429, a fieldless 400)
  was silent; now shown on the section. `RETURNS_PRESET` is typed against the Prisma enum. The
  onboarding card's "Fill in the rest" link points at Shop details. The help line sits under the
  title rather than in a "?" sheet, noted in ux.md.
- **Tests:** `tests/unit/shop-details.test.tsx` (schemas, kept columns, A2, A6, every state),
  `tests/integration/shop-details.test.ts` (A5, Q17, Q21, D4, D6), `storefront-public-dto` (`aboutOf` over
  every case; returns), and the brand-page suites updated. Ran `tsc`, `vitest run tests/unit`,
  `vitest run tests/integration` (local disposable DB), `lint:boundary`, `docs:check`.

## 2026-10-31 — product-form unit 2: readiness hints while filling [CONTRACT]

- **What other places ask, before saving** (product-form R5, A3; D4; Q8, Q31): on Details the
  stepped create shows "{Channel} also asks: {fact}" in the type's own words ("Amazon also asks:
  Fabric"); Review shows "Ready for your store", "{Channel} will also ask: {fact}" with "Add
  {fact}" opening Details, "Ready for {Channel}", and "Checking…" while it re-checks. Re-checked
  each time the step changes. A shop selling nowhere else, or a category with no type, sees nothing
  and nothing is fetched. Photos and video says nothing about video (Q31). Advice only: a failed or
  slow check shows nothing, and "Put on sale" is never disabled or delayed (ADR-0053, A8).
- **One rule set** (D4): `channelReadinessService.forUnsaved` fills the unsaved answers through
  `fillListing` as a save would (family, brand, shop defaults), then calls `forProduct`. It writes
  nothing. Only unanswered facts become hints; a missing mapping is the platform's work and stays on
  the product page panel.
- **[CONTRACT]** `POST /api/org/[orgId]/products/readiness` (`withOrg`; org from the membership),
  body `productReadinessSchema` (`categoryId`, `kind`, `familyId`, `brandId`, `facts`), answer the
  existing `ChannelVerdict[]`. `productFormSchema` and the new schema share one declaration of the
  listing answers. `listingApiClient.readiness`, `useReadinessHints` (`useAsyncData`, aborts the
  stale check) and `readiness-hints.ts` (verdict → words) sit beside the form. `CONTRACTS.md`
  Channels section updated: readiness of a *saved* product still never crosses the boundary.
- **Readiness types split out:** `LISTING_READINESS`, `LISTING_PROBLEM`, `ListingProblem` and
  `ListingReadinessReport` move to `server/listing/channel-readiness.types.ts` (re-exported from
  `channel-readiness.ts`), so the client form words a verdict without pulling `@prisma/client`'s
  `ChannelMapFit` into the browser bundle.
- **Tests:** `tests/unit/product-form-readiness.test.tsx` (A3, R5, ux Review Partial/Loading, A8
  with a failing and a hanging check); `tests/integration/product-readiness-preview.test.ts`
  (A3 through the route on a real schema, family fill, nothing written, a shop with no channel, a
  caller with no seat refused 403, a bad body in the envelope). Mutations, each red: the preview
  judges the raw answers instead of the filled ones (family test fails); the re-check keyed only on
  the type, not the step (Q8 test fails); "Put on sale" `disabled` while checking (A8 test fails).
- **Gates:** tsc clean; unit 201 files / 2279 passed; integration 48 files, 417 passed — one
  failure, `jobs-enqueue` drift, is this tree's database carrying another unit's columns for the
  shared Prisma client, not this unit (no migration here); lint:boundary clean; docs:check passed.
  `src/app/api/CLAUDE.md` re-read against the new handler; nothing drifted. ARCHITECTURE.md
  handler and test-file counts follow the tree. Q8, Q31 → implemented (unit 2).

## 2026-10-30 — order-fulfilment unit 1: one parcel vocabulary [MIGRATION]

- **Two new parcel states** (R1, R2; D1; Q2): `ready_for_pickup` and `pickup_booked` sit between
  `packing` and `picked_up`; `packing → picked_up` is gone, and cancel is allowed from the first three.
  `CANCELLABLE_FROM` (buyer and shop from `packing`, admin from all three) and `PARCEL_ACTOR` are
  declared in `server/shipping/domain/shipping.types.ts`.
- **One guarded move** (A5; D2): `moveParcel` (`server/checkout/fulfilment.service.ts`) runs one
  transaction: lock the order row (`orderRepository.lockForParcelMove`), call shipping's `applyStatus`
  (now on the caller's `tx`, with `recordTransition` as `updateMany {id, status: from}`), then write
  the order's summary. A person's stale move gets ux.md's "This parcel is already …" `ConflictError`;
  a courier's is ignored. The webhook goes through it. `applyProviderStatus` became `readCourierStatus`.
  A parcel of an unpaid order cannot be cancelled (`UNPAID_CANCEL_MESSAGE`), so expiry cannot
  restock it twice. A parcel still holding an off-list status is refused with a named message
  (`offListMessage`) and logged, never a 500.
- **Until U3, a `pickup_booked` parcel moves forward only through the courier webhook**: there is
  no "Mark picked up" yet.
- **Born `packing`; placeholder gone** (D3; Q3): deleted `fulfillOrder`, `mock.booking.ts`,
  `markBooked`, `markBookingFailed`, `recordBooking*`, `findForFulfilment`, `recordFulfilmentStatus`,
  and the never-written `PARTIALLY_FULFILLED`/`FULFILLMENT_FAILED`. The admin tracking form no longer
  jumps to "Picked up": it walks the parcel to `pickup_booked` through `moveParcel` (Q4) until U3
  replaces it. The seed writes canonical statuses.
- **Order status derived** (D4; Q5): `summariseParcels` (`server/checkout/parcel-summary.ts`) and
  `orderRepository.syncSummary` (paid orders only, and only over a lower `ORDER_STATUS_RANK`, so an
  order never moves backwards; delivered and cancelled are terminal) replace `markDelivered` and
  `allShipmentsDelivered`. Adds `ORDER_STATUS.CANCELLED`. Paid counts, the storefront proof count
  and revenue leave out cancelled orders, and "Parcels to send" counts ready and booked parcels.
  The D4 deletions of the hand-move routes wait for U2/U3 (Q36, new).
- **Timeline** (D5): `ParcelEvent`, one row per move, with actor, reason and courier wording.
- **[MIGRATION] `20261031100100_parcel_vocabulary`** drops nothing. It creates `ParcelEvent`. Every
  parcel outside the vocabulary (not a fixed list) is mapped: parcels of an order delivered or shipped
  by hand walk forward to `delivered`/`in_transit`, those with an AWB and a courier webhook event go
  to `picked_up`, and the rest to `packing`. Each parcel gets a "Recorded when the timeline began" row.
  Paid orders are then re-derived, only ever upward by rank, so no order loses ground. Proved in a
  rolled-back transaction on fixture rows: pending + hand-delivered, pending + hand-shipped,
  pending + processing, confirmed with AWB, failed, old `shipped`/`processing`, and unpaid.
- **Review** (two fresh-context passes): fixed the migration lowering hand-advanced orders, the
  runtime summary un-delivering an order, a fixed off-list list, cancelling an unpaid order's
  parcel, a tracking AWB saved on a cancelled parcel (now 409), and missing "Cancelled" labels on the
  admin orders table (read-only, no select) and the shop's order filter.
- **Mutations** (each made a test fail, then restored): M1 `recordTransition` made unconditional →
  the lock-free race test failed. M2 order lock removed → A5's double "delivered" moved twice.
  M3 `packing → picked_up` put back → vocabulary test failed. M4 `syncSummary` paid filter
  removed → the unpaid-order test failed. M5 cancelled parcels counted as live → two summary tests
  failed. M6 `PAID_ORDER_WHERE` without the cancelled filter → the paid-count test failed.
  M7 `syncSummary` back to "any other status" → the late-courier test un-delivered the order.
  M8 unpaid-cancel guard removed → the unpaid test cancelled the parcel. M9 off-list guard removed →
  that test's parcel was moved past an unknown state. Migration (fixture script): M10 walk-forward
  removed → hand-delivered/shipped parcels stayed `packing`. M11 rank backstop removed → a
  `processing` order dropped to `confirmed`. M10+M11 → delivered and shipped orders became `confirmed`.
- **Tests:** `tests/unit/parcel-vocabulary.test.ts` (new), `tests/integration/parcel-move.test.ts`
  (new, spec A5); `shipment-lifecycle`, `shipment-effects` and `parcel-reversal` moved onto the new
  path. On a recreated `bhendi_bazaar_ci` (all migrations deployed): `tsc`, `vitest run tests/unit`
  (2270 passed; 2 failures in product-form U1's uncommitted files: `crop-dialog`, `vocabulary`
  "seller"), `vitest run tests/integration` (47 files, 411 passed; 7 `join-equivalence` skipped,
  needs a populated catalogue), `lint:boundary`, `docs:check`.
- **Legacy order statuses:** a paid order left at `partially_fulfilled` or `fulfillment_failed` (written by the deleted `fulfillOrder`) becomes `confirmed`, so its parcels can move it on; unpaid ones are untouched. Checked on fixture rows in a throwaway database built to the state before this migration.

## 2026-10-30 — product-form unit 1: listing in five short steps

- **New product is five steps** (product-form R1–R4, R13; D1, D2; Q2, Q5–Q7, Q15, Q16, Q20):
  `ProductStepsForm.tsx` over the one `ProductForm`, `productFormSchema` and `useServerForm` save.
  Photos and video → What it is → Price & stock → Details → Review, with "Step n of 5", chips with
  error counts, "More options" (SKU, low-stock alert; tags, flags, family), a sticky bar
  ("{n} things to fix · Show"), a searchable category sheet with recent picks, a buyer preview
  (beside the form at `lg:`), Review problem lines that open their step, and the success screen.
  The step map (`product-steps.ts`) is typed over `PRODUCT_FORM_FIELDS`. Every step stays mounted,
  so an upload survives "Next". Edit and read-only keep the long form until U4.
- **`useServerForm` gains `onInvalid`** (D2): a stepped form opens the step holding the first error
  instead of the banner. A network `TypeError` now shows the fallback message, not "Failed to fetch".
- **Photos and video** (R14–R16; D3; Q30, Q32, Q34, Q36): `product-media-manager.tsx` gains the
  "Add" sheet (Take photo · Choose photos or video · Add YouTube link) driving its existing inputs.
  At the 10-item cap, Add stays tappable and shows `CAPACITY_NOTICE`, and so do the slot, library
  and YouTube controls (Q36 updated). `gallery-rows.tsx` loses every `disabled`: a slot tap during
  an upload is ignored, and a move at the end is a no-op. Its stale header comment now cites
  ADR-0039, not ADR-0017.
- **Review fixes (fresh-context /bb-review):** saving a pickup location no longer moves the outer
  form to the next step. "Add another" clears the step ticks. "Put on sale" ignores a second tap
  through a ref, not render state. A failed save is shown once, inline with "Try again"
  (`useServerForm` `toastErrors`). Review problems are parsed only while Review shows.
- **Copy from ux.md:** schema messages "Name needs 2 or more letters", "Pick a category", "Add the
  price buyers pay", "Sale price must be below the price". The SKU refusal now reads "Your product
  '{name}' already uses this code." (`product.repository.ts`), and `product-merge.test.ts`'s Q31
  assertion follows it. The empty-location notice reads "Where is this kept? Add your shop address
  once." with "Add location". The family "Create" and the fact select are no longer `disabled`
  (A8). A first-load skeleton is `products/new/loading.tsx`.
- **Tests:** `tests/unit/product-form-steps.test.tsx` (A2, A8, A9, A10, R1–R4, Q32, Q36).
  Mutations, each red: `onInvalid` never called (2 fail); Add `disabled` at the cap (1 fails);
  "Add video" `disabled` at the cap (1 fails); a row's Remove `disabled` (2 fail);
  `price` mapped to Details (2 fail); "Next" disabled until the step is valid (4 fail); the SKU
  copy reverted (`product-merge` Q31 fails). `design-tokens` SHAPE_LEGACY shrinks by
  `productAdd/index.tsx`.
- **Second review fixes:** every gallery write in `product-media-manager.tsx` is now a function
  of the latest gallery (a ref), and the cap is re-checked when it commits. Before this, an upload
  that resolved after a second pick overwrote the gallery and could pass 10. Add, or a slot, tapped
  mid-upload shows "Wait for the upload to finish" and stays enabled. The step opens from an
  effect keyed on the save attempt, so a server SKU refusal opens Price & stock. ux "Slow" copy
  "{n} photos still uploading" is shown. "Add another" re-syncs the stock rows. `crop-dialog.tsx`
  loses every `disabled`: a tap while busy is ignored, and the button reads "Uploading…". The
  unused `count` prop in `gallery-rows.tsx` is removed.
- **Tests added:** two picks overlapping never lose an item or pass 10; SKU refusal opens Price &
  stock; a location added mid-form survives "Add another" (`tests/unit/product-form-save.test.tsx`);
  the crop sheet disables nothing and ignores busy taps (`tests/unit/crop-dialog.test.tsx`).
  Mutations: commits read the captured `media` (1 fails); the cap is dropped (1 fails); the
  wait note is removed (1 fails); the step effect is removed (3 fail); the crop busy guard is
  removed (1 fails). Removing the `syncStockRows()` call in "Add another" **survived**: the
  registered stock inputs already restore the row on `reset()`. The call is kept as a backstop, and
  the test pins the outcome.
- **Gates:** tsc clean for this unit; the only errors are order-fulfilment's `parcelEvent`, from an
  in-progress client. Unit 200 files / 2272 passed; integration 47 files / 411 passed (1 skipped);
  lint:boundary clean; docs:check 78 passed. ARCHITECTURE.md test-file count follows the tree.
  `src/components/CLAUDE.md` was re-read and re-verified; nothing in it changed. Decisions Q2, Q5,
  Q6, Q7, Q15, Q16, Q20, Q30, Q32, Q34, Q36 → implemented (unit 1).

## 2026-10-30 — org-profile unit 1: a shop starts with three fields

- **[CONTRACT]** `POST /api/orgs` parses the new `openShopSchema` (`src/lib/validation/schemas/org.schema.ts`):
  shop name, mobile (required, any country, stored E.164), email. Contact person, business
  name, GST, PAN and description are stripped (org-profile R3, R6, A1; D1; Q2, Q3). The admin's
  `createOrgSchema` and form are unchanged (Q22). `adminOrgService.createOrgWithOwner` takes
  `OpenShopInput`. CONTRACTS.md "Seller profile" updated.
- **Form:** `src/components/org/open-shop-form.tsx` replaces `create-org.tsx` (which reused the
  admin form) on `/org/new`: three fields with the ux labels, hints and placeholders, the account
  email prefilled, "Create my shop", and the ux field copy "Use at least 3 letters." / "Enter a
  10-digit mobile number.". The page's heading and the rest of the create screen's states are
  seller-onboarding U2's. No new route; the registry entry (`ACCOUNT`) is unchanged.
- **Tests:** `tests/unit/open-shop.test.tsx` (spec A1: schema, route, form). Mutations, each red:
  route parsing `createOrgSchema` again (2 fail); mobile made optional (2 fail); `z.object` →
  `z.looseObject` (2 fail); mobile passed to `normalizePhone` un-stripped (prefix test fails);
  normaliser replaced by `+91`+digits (1 fails); mobile-prefix (6–9) check removed, so a landline
  passes (1 fails). A 10-digit length check survived its mutation
  (libphonenumber already refuses those numbers) and was removed.
- **Gates:** tsc clean; unit 196 files / 2236 passed; integration 46 files / 400 passed (1 file
  skipped); lint:boundary clean; docs:check passed (ARCHITECTURE.md test-file count 243 → 244;
  `src/components/CLAUDE.md` re-verified, nothing in it changed). Decisions Q2, Q3, Q22 →
  implemented (unit 1).
- **Review fixes (2026-10-31):** a double tap opened two shops. The submit is now guarded while it
  runs and after it succeeds; the button stays tappable and reads "Opening your shop…" (ADR-0053).
  The mobile accepts any country (owner, Q26; international-phone R1): it uses the shared
  `FormPhoneInput` with India selected first and the shared `phoneSchema`, so the India-only 6–9
  rule and the "10-digit" copy are gone (ux, TRD D1 and seller-onboarding ux corrected, with one
  mobile hint across both). The ux copy for a failed request and for success now comes through
  `useServerForm` props. The test that only restated a message constant is deleted. New
  mutations, each red: guard removed (double-tap test fails); guard reopened after success
  (tap-before-navigate fails); fallback copy removed (offline test fails); phone made optional
  (2 fail). The earlier mutations of the deleted India-only parser no longer apply.

## 2026-10-29 — bulk sheet sale prices are saved; variant tiles show the shop's own offers

- **Bulk sheet sale prices were parsed and dropped** (own-store Q24). `createProducts`
  (`server/catalog/bulk/bulk-product.service.ts`) now writes each row's markdown through
  `promotionService.setProductMarkdown`, as the product form does, for created and SKU-matched
  updated rows; it re-checks the shop's ceiling before writing anything. A blank cell on an update
  keeps the current sale; the price or 0 ends it — stated in the sheet's `salePrice` note.
  An unchanged running markdown is not re-judged, by the form's own rule, now one helper
  (`promotionService.saleBreach`, used by the form, sheet validation and `createProducts`).
  A 0 cell now parses (was `positive()`) and deactivates the markdown, never writing a 0 price. A
  markdown write failing after the import commits says the products were saved without their
  sale prices, and how to re-upload safely.
  bulk-catalog-upload spec R14/R15 (and the stale "create-only" line removed), TRD D12.
- **Variant tiles were priced with `orgId: ""`** (own-store Q25), so a shop's own offers never
  showed though checkout applied them (ADR-0018). `getFamilySiblings` selects `orgId`;
  `products.dal.ts` passes it.
- **Tests:** `tests/integration/bulk-sale-price-and-sibling-offers.test.ts`. Mutations, each red:
  markdown write removed (2 fail); ceiling re-check disabled (over-cap fails); blank-cell skip
  removed (update test fails); sibling `orgId` back to `""` (tile test fails); unchanged-markdown
  skip removed from `saleBreach` (bulk re-upload test and offer-ceiling's form test both fail);
  schema back to `positive()` (unit 0-cell test fails); 0 written as the price (CHECK violation, 0-cell
  test fails); 0 skipped on updates (sale stays); post-commit catch rethrowing raw (message test fails).
- **Gates:** tsc clean; unit 186 files / 2170 passed; integration 44 files / 364 passed (1 file
  skipped); after these follow-ups, the affected unit and integration files rerun green (33 tests);
  lint:boundary clean; docs:check 78 passed (ARCHITECTURE.md test-file count 231 → 232).
## 2026-10-29 — rate limiting enforced everywhere through one registry

- **Why:** limiting was detached (PR-81) and, where it had existed, added handler by handler, so
  password reset, payment confirmation, the coupon quote and a dozen more had never had a limit.
  Owner, 2026-10-29: do it once, product-wide ([rate-limiting](specs/rate-limiting/) Q1,
  [ADR-0063](adr/0063-every-public-route-is-classified-for-rate-limiting-in-one-registry.md)).
- **Unit 1 — boot gate and seam (behaviour change).** `APP_ENV` picks the backend: in-process
  (`src/lib/rate-limit/memory.ts`, bounded to 10,000 callers) locally, the shared Upstash store
  (`upstash.ts`) in preview and production. `next.config.ts` fails a preview or production build
  missing `RATE_LIMIT_STORE_URL`/`_TOKEN` (or `KV_REST_API_*`) or `RATE_LIMIT_CLIENT_IP_HEADER`;
  `src/instrumentation.ts` checks again at boot and reports the rest of `validateEnv`'s list
  (Q11). The address comes only from the configured header, last entry (Q12). A store fault fails
  open and is logged per request. A refusal is `RateLimitedError`, a 429 in the envelope with
  `Retry-After` and `X-RateLimit-*` (`src/lib/api-error-response.ts`).
- **Unit 2 — registry, gate, helper.** `policies.ts` (11 policies, the only numbers),
  `registry.ts` (44 public route methods: 35 limited, 9 exempt with a reason), `limitRequest`.
  Every old call site moved onto it; the bespoke `{ error, retryAfter }` bodies are gone.
- **Unit 3 — the unlimited routes.** Sign-in (inside the credentials provider; the form now shows
  the refusal), reset, resend, change-password, verify-email (redirects with the message),
  payment verify/confirm-free/abandon, coupon quote (only when a code is sent), allocate,
  shipping rates, stock check, bids, addresses, profile, picture, reviews, shop creation.
- **Retired:** `tests/unit/rate-limit-detached.test.ts`, `RATE_LIMITING_ENABLED`, `withRateLimit`,
  `getClientIp`, `getRateLimitIdentifier`. `docs-integrity` now ignores Next's own `NEXT_RUNTIME`
  and `NEXT_PHASE`.
- **Tests:** `tests/unit/rate-limit.test.ts` (selection, config assertion, address, bound,
  fail-open, envelope), `tests/unit/rate-limit-registry.test.ts` (A6),
  `tests/unit/rate-limit-routes.test.ts` (A1, A2, A5, A7 through the real handlers).
- **Mutations:** registry entry removed → gate red; allocate's call removed → red; re-keyed to
  another route → red; a new unclassified `route.ts` → red, naming it; memory bound removed → red;
  selector on key presence → 3 red; `x-forwarded-for` read first → red; fail-open rethrows → red;
  preview left unasserted → red; codeless quotes counted → red. All restored.
- **Review fixes (2026-10-30).** Payment verify/confirm-free/create-order, allocate, stock check and
  shipping rates now read the session and key by account (R7); the registry gate fails a limited
  route that never passes `userId`, short of a named anonymous list. Store keys carry `APP_ENV`
  (Q19). The store gives up after 1000 ms, allows, and logs a timeout once per window (Q20).
  Mutations: verify's `userId` dropped → gate red; env prefix dropped → 2 red; timeout unset → red;
  timeout logged every request → red; never logged → red. All restored. Q21 parked.
- **Not verified live:** the development store in the local `.env` does not resolve, so the
  Upstash path is proven only against a stubbed client (CI proxy parked, Q13).
- **Suites:** tsc, unit, integration, `lint:boundary`, `docs:check`, `next build`.

## 2026-10-29 — offers-hardening unit 6: the platform funds on the 30-day lowest price [MIGRATION]

- **A shop could raise its price before a platform campaign and have the platform fund the rise**
  (R5, own-store Q21). Migration `20261030000700_product_price_history`: table
  `ProductPriceHistory` (FK `Product`, Cascade — it carries no money, and `OrderItem` already holds
  any sold product), written only by the `Product_price_history` trigger on insert and on a changed
  price, so no writer can skip it; backfilled with today's prices.
- **Catalog:** `productService.lowestListPrices` — the price in force at the window's start, every
  price since and today's, in one query (Q1: list price only).
- **Engine (D7, Q15):** `DiscountableLine.fundingBasisUnitPaise`; window `FUNDING_BASIS_DAYS` (30) in
  `promotion.types.ts`. The buyer's discount is unchanged; the platform funds at most its winning
  automatic offer recomputed on the basis, the shop the rest. A platform coupon costs the platform
  `min(total, its value on the basis total)`, judged once with the same cap; the shortfall falls only
  on lines whose price rose, pro rata to the rise, capped at each line's share. Minimum spend stays
  judged at the shown price. Equal basis gives today's split.
- **Wiring:** only the order transaction passes the basis (`checkout/basket-discounts.ts`, through
  catalog). Whether an offer fits its budget is still decided on the shown price, as the preview
  decides it (ADR-0018); the basis only lowers what a kept offer spends.
- **Tests:** `tests/unit/promotion-engine.test.ts` (A6 numbers, with a shop offer, platform coupon,
  fixed ₹200 coupon with one shop raised, capped percent, minimum spend at the shown price, equal
  basis, properties); `tests/integration/funding-basis.test.ts` (trigger, window,
  A6 end to end, budget decided on the shown price).
- **Mutations:** basis replaced by `unitPrice` → 4 A6 tests red; trigger dropped → 5 red; budget
  decided on basis lines → budget test red; coupon shortfall spread over every line → 4 red;
  shortfall zeroed → 3 red. All restored.
- **Suites:** tsc, unit, integration, `lint:boundary`, `docs:check` green.

## 2026-10-29 — offers-hardening unit 5: a platform offer that can lose money needs a confirmation and a budget [MIGRATION] [CONTRACT]

- **A platform offer could cost more than commission, unbounded.** Migration
  `20261030000500_offer_budget_and_loss_confirmation`: `Promotion` gains `platformBudgetPaise`,
  `platformSpentPaise`, `lossConfirmedAt`, `lossConfirmedByUserId` (FK `User`, Restrict), with CHECKs
  budget > 0 and 0 ≤ spent ≤ budget.
- **Spend (D5, Q3, Q4):** `applyToOrder` charges each budgeted PLATFORM offer its platform-funded
  share with a conditional raw update (`spent + x ≤ budget`) in `promotion.repository`. The quote
  (preview and order alike) first sets aside any budgeted offer whose share of the basket exceeds what
  it has left and prices again, so the review shows the real total; the 409 "That offer has just
  ended. Please review your total." fires only when another order took the budget in between.
  `OrderDiscount.budgetChargedPaise` (CHECK ≥ 0) records what each row charged, and
  `releaseForOrder` gives back exactly that on expiry (floor 0 as a backstop), before stock as
  before. `isExhausted` treats a spent budget as exhausted, so the offer leaves product pages.
- **Loss test at save (D6, Q2, Q5, Q11):** pure `server/promotions/loss.ts`, shared by the form and
  `admin.promotion.service`, against `commercialTermsService.lowestCommissionBps()` (min of org
  defaults and category rules). Possible loss needs `confirmLoss` "CONFIRM LOSS" and a budget; the
  confirmer comes from the session. Only shops that can sell count toward the lowest rate. Rerun on
  every edit; an edit the rule does not flag keeps the earlier confirmation (Q14), and every
  confirmation goes to the admin audit trail. An edit never resets spent; a budget below spent is
  refused on the field, including when an order spends between the check and the write (the
  CHECK violation is turned into the same field error).
- **Contract:** `platformPromotionSchema` adds `budget`, `confirmLoss` (admin routes only); the
  offer list adds budget, spent and who confirmed. `CONTRACTS.md` moved with it.
- **UI (ux.md):** amber loss panel and "Budget (₹)" on the admin form; the save button stays
  enabled with a spinner; "Offer saved." / "Couldn't save. Try again."; the list shows "₹x of ₹y
  used", "Budget used up" and "Runs at a loss — confirmed by …".
- Tests: `offer-loss-rule` (rule per value type, equal is not a loss, schema mistakes),
  `offer-form-loss-panel` (panel, list states), integration `offer-budget` (refusal copy, session
  confirmer, spend, overrun refused with nothing spent, expiry release, spent offer off the product
  page, two-order race, short budget left out of preview and order, budget added or cleared and
  re-set around unpaid orders, kept confirmation and its audit, budget edit racing a spend,
  withdrawn shop's rate ignored).
- Mutations, each red: spend update without its budget condition (overrun and race tests);
  `isExhausted` without the budget check (product page test); the confirm check skipped (refusal
  test); no requote for a short budget (Q4 test); release by platform share instead of
  `budgetChargedPaise` (both in-flight budget tests).

## 2026-10-29 — offers-hardening unit 4: a shop's discount ceiling holds for every kind of offer

- **A 50%-capped shop could set ₹9,999 off a ₹10,000 item, or a ₹1 sale price.** The ceiling was
  checked only for percentage offers at creation. It is now an engine input (D4, R3): `quoteDiscounts`
  and `automaticUnitPrice` take `orgCeilings` (org id → `maxDiscountBps`); an ORG offer's per-unit
  discount is clamped to `applyBps(unitPrice, cap)` inside `automaticUnitDiscount`, so the product
  page and the charge share it (ADR-0018), and an ORG coupon's line share to `applyBps(lineTotal, cap)`.
  Platform offers are not clamped.
- **Loading:** `commercialTermsService.allCeilings()` reads every org's ceiling in one two-column
  query (one row per org, so it grows with the number of shops); `loadPriceContext` and
  `promotionService.quote` load it beside the offers. The `getOfferProducts` query budget rises
  3 → 4 for it, reason recorded beside the budget.
- **The edit form could make a shop fund a platform campaign.** It pre-filled the sale price from
  the resolved price, platform offers included, and saving turned that into a shop markdown — or,
  with the ceiling, refused a description edit. The form now reads only the shop's own markdown
  (`promotionService.productMarkdownPaise`); the product table still shows the buyer's price. A
  sale price the save leaves unchanged is not re-judged, so an older over-cap markdown cannot block
  an edit; the engine clamps it. Copy-product and the bulk template carry no sale price.
- **A 0% ceiling:** `offerCoverage` takes the ceilings and leaves out a 0%-capped shop's offers, so
  its products are not listed as "on offer" for a discount of nothing.
- **Forms refuse what they can know (Q7):** an ORG flat or fixed-price offer naming products is
  checked against each product's price, with ux.md's words on `amountOff`/`fixedPrice`; the product
  form's sale price is refused before the product is saved, on `salePrice`; a bulk sheet row gets
  the same words as a row error. Offers on categories or everything are clamped, not refused.
- `formatCurrency` moved to `server/shared/money.ts` (re-exported unchanged from `src/lib/format.ts`)
  so a refusal quotes rupees as the UI does. Ownership is now checked before the ceiling, since the
  message quotes a price.
- Tests: engine unit tests per value type, coupon share, platform unclamped, rounding, and
  per-unit = line ÷ quantity (A4); `tests/integration/offer-ceiling.test.ts` (offer form, fixed
  price, product form, bulk row, and a directly inserted over-cap offer at 50% on page and charge).
- Also: engine tests pinning D2a under the clamp (deeper platform automatic vs clamped shop offer;
  clamped shop coupon vs platform automatic); edit-form integration tests (60% campaign + 50% cap
  description edit saves and makes no markdown; own markdown round-trips; old over-cap markdown
  survives an edit); `offerCoverage` 0% case.
- Mutations, each red then restored: clamp disabled (8 A4 tests red, unit and integration); clamp
  applied to platform offers (2 red); each form refusal removed — offer, sale price, bulk row (4 red);
  edit form fed the resolved price (2 red); no skip for an unchanged markdown (1 red); coupon share
  unclamped (2 red, incl. D2a); 0%-ceiling filter removed from `offerCoverage` (1 red).
- `docs/ARCHITECTURE.md` counts: test files 226 → 227.
- Suites: tsc, unit, integration, `lint:boundary`, `docs:check`.

## 2026-10-29 — offers-hardening unit 3: preview equals charge, a beaten coupon steps aside, the database refuses impossible discounts [MIGRATION]

- **The preview took ₹1,000 off where the charge took ₹600** (₹1,000 item as quantities 1 and 5,
  10% off). The quote route now merges lines by `lineKey` and sums quantities, as the order
  transaction does; `quoteDiscounts` throws on a duplicate line key (D8, R6). `lineKey` moved to
  `server/checkout/pricing.ts`, a declared checkout seam (ADR-0033); the route, `basket-discounts`
  and `order.service` all build keys with it (three inline copies removed).
- **A coupon overtaken by a better automatic offer refused the order.** `applyToOrder` no longer
  throws on `ALREADY_BETTER_OFF`: it claims nothing and the order goes through at the better price
  (D9, R7). Other rejections are unchanged.
- **Migration `20261030000300_offer_and_line_discount_checks`** (D10, R8): fixed price > 0 (was ≥ 0;
  every writer already requires > 0), cap > 0, minimum spend ≥ 0, `usageCount` ≥ 0, limits > 0,
  and `OrderItem.discountPaise ≤ unitPrice × quantity` (bigint product, no int4 overflow). Percent, amount-off, line split and
  `OrderDiscount` checks already existed since 20260816 and are not repeated. The header carries
  the pre-deploy queries for violating rows. The budget check (`0 ≤ spent ≤ budget`) moves to U5,
  which adds those columns.
- Tests: `tests/integration/offers-preview-charge.test.ts` (A7 through the route handler, A8,
  A9 per constraint, each asserting the constraint's name); engine unit test for duplicate keys.
- Mutations, each red then restored: no merge in the route (A7: 50000 vs 60000); throwing on
  `ALREADY_BETTER_OFF` (A8); dropping `OrderItem_discount_within_line` (its A9 case).
- `docs/ARCHITECTURE.md` counts: migrations 94 → 95, test files 225 → 226.
- Suites: tsc, unit, integration, `lint:boundary`, `docs:check`.

## 2026-10-29 — offers-hardening unit 2: a once-per-customer code holds under simultaneous checkouts

- **One buyer's two overlapping checkouts both spent a once-per-customer code.** The buyer's
  redemptions were counted before any lock. `promotionService.applyToOrder` now takes
  `promotionRepository.lockByCode` (`SELECT … FOR UPDATE` on the typed code's row, a no-op for an
  unknown code) before quoting, so the second checkout waits and counts the first's committed
  `OrderDiscount` (D3). Its transaction is required and typed `PromotionTx`. The preview is unchanged.
- Tests: `tests/integration/per-user-coupon-race.test.ts` — two concurrent orders by one buyer
  through `createOrderWithShipments`, 4 rounds: one wins, the other is refused "You have already
  used CODE." (A3); a second buyer can still use the code.
- Mutation: removing the lock failed the A3 test in round 0 (the code spent twice). Restored.
- Review fixes: order expiry now gives the coupon back before the stock, matching checkout's lock
  order, so the two cannot deadlock; `PromotionTx` is `Prisma.TransactionClient`, so the plain client
  no longer type-checks there. Unit 1's entry is re-dated to today (it said 2026-10-30).
- `docs/ARCHITECTURE.md` test-file count 224 → 225.
- Suites: tsc, unit, integration, `lint:boundary`, `docs:check`.

## 2026-10-29 — offers-hardening unit 1: a parcel reverses only its own goods [MIGRATION]

- **One cancelled parcel reversed every org's whole sale on the order.** `ledgerService.reverseShipment`
  replaces `reverseSale`: it reverses only the parcel's org and units, with each figure split by
  cumulative floor so the parts of a line sum to its sale exactly (D1, D2). It locks the org's
  SALE row `FOR UPDATE` and returns early if the parcel is already reversed, so concurrent
  reversals neither lose a paisa nor abort the courier's transaction on the unique index.
- **Migration `20261030000100_ledger_parcel_reversal`:** `OrgLedgerEntry.shipmentId` (Restrict),
  `OrgLedgerEntryLine.quantity`; the `(orderId, orgId, kind)` unique becomes three partial unique
  indexes — one sale per order and org, one legacy order-wide reversal, one reversal per parcel.
  Drops no data. Order-wide reversals already written stand and count as the whole line (Q6).
- Review fixes: a manually edited sale reverses its edited header pro rata, so a full return nets
  the org to zero (Q12); soft-deleted entries count for nothing and a soft-deleted sale is not
  reversed; shipping reads the parcel's scope (`shipmentRepository.reversalScope`) and passes it
  in, so payouts no longer reads `Shipment` (ADR-0033); a parcel line absent from its org's sale
  throws; the transaction is required. Q13 (parcel cancelled before payment) parked.
- `shipmentRepository.findOrderId` removed: its only caller was the old reversal.
- Tests: `tests/unit/parcel-reversal.test.ts` (A2, random splits, Q6),
  `tests/integration/parcel-reversal.test.ts` (A1 two orgs, A2 3 + 2 split, replay, Q6, two
  parcels at once, one parcel twice at once, edited sale, soft deletes, stray parcel line).
  `shipment-effects` teardown deletes the ledger before parcels.
- Mutations: per-parcel `floor(x·q/Q)` in place of the cumulative floor failed both A2 tests;
  counting a legacy null quantity as 0 failed both Q6 tests; removing the lock failed both
  concurrency tests, 3 runs of 3 (gross off by 2 paise; a unique violation); ignoring
  `isManuallyEdited` failed the Q12 test; dropping the `deletedAt` filter failed both
  soft-delete tests. Restored.
- Suites: tsc, unit, integration, `lint:boundary`, `docs:check`.
## 2026-11-01 — Shiprocket webhook moved to `/api/webhooks/shipping/courier`

- **Shiprocket refuses a webhook URL containing "shiprocket", "kartrocket", "sr" or "kr"** (its webhook
  settings page, checked 2026-11-01), so `/api/webhooks/shipping/shiprocket` could never be registered.
  The route is now `/api/webhooks/shipping/courier`; the same-origin exemption, reachability entry, docs
  and tests follow it, and a test holds the path free of the refused words.
- **Confirmed in the dashboard:** the token is sent as `x-api-key`, as the B5 code expects.
- **Owner note:** Shiprocket has one webhook URL per account; at the time of checking it pointed at another
  integration. Replacing it with ours stops that integration's tracking updates.

## 2026-10-31 — GTM B3: fixes from the review — counts from the dump's own snapshot

- **The drill would have failed against a live database.** The counts were taken in a second session
  after `pg_dump`, so any write in between (the worker, the queue's maintenance, an abandoned checkout)
  made them disagree with the dump, and a drill that is usually off teaches everyone to ignore it. The
  backup now opens one read-only repeatable-read transaction, exports its snapshot, runs
  `pg_dump --snapshot` on it and counts inside it. **Rehearsed:** 4,000 inserts running during the
  backup; the snapshot counted 650 and the restore matched it exactly.
- **Every schema is counted**, the job queue's 12 `pgboss` tables included (75 tables, was 62).
- **The drill's local-only guard read the URL as text**, so `?application_name=localhost` passed it. It
  now checks the parsed host, and refuses a database that already has tables.
- **The counts are encrypted too**; files are written as `.partial` and renamed only on success; the
  temporary directory is removed; the database password goes through `PG*` variables, never argv;
  the aws CLI asks for checksums only where R2 needs them.
- **Corrections to OPERATIONS:** R2 has no write-only token (Read & Write, with Bucket Lock stopping
  deletion); the drill needs client tools 17+; schedules run only from `main`.
- **Note:** the B3 entry below landed in the B10-fixes commit, not B3's own; harmless once both merge.
- **Mutation-tested:** the host check reverted to a substring match (`*localhost*`) turns the guard test
  red.

## 2026-10-31 — GTM B12: fixes from the review — corrections to the entry below

- **Correction: the lightbox still loaded with the product page.** The reviews section imported it
  normally, and the gallery rendered it closed, which fetches it after hydration anyway. Both now use
  `LazyImageLightbox`, which mounts (and fetches) it only while open. Checked on a production build: no
  script the product page loads contains it.
- **Correction: "set `DATABASE_POOL_MAX` to 1–3" was unsafe.** A transaction holding one connection can
  need a second; at 1 the integration suite fails 41 tests, at 2 the concurrent-transaction tests time
  out. The value is now parsed (`server/shared/pool-size.ts`): a whole number of at least 3, anything else
  refused with an error and the default used. Advice: 3–5, web only, never the worker.
- **Similar products failing no longer replaces the product page** with the error screen (the 200 had
  already been sent); the section is left out and the error logged.
- **The first gallery image uses `fetchPriority="high"`** rather than `preload`, as B12 and Next's docs
  advise. Whether the first paint should fetch a 200vw image is ADR-0027's question, not changed here.
- **Load smoke:** a cart threshold; the checkout keeps no credentials; k6 analytics off.
- **Tests:** `pool-size.test.ts` (3), `lazy-lightbox.test.tsx` (2). Full suite 2589 passing; journeys 12
  of 12.

## 2026-10-31 — GTM B10: fixes from the review

- **The markup's price follows the page's rule.** It used `salePrice ?? price`; a promotion larger than
  the item resolves to 0, which the page (through `effectivePrice`) shows as the list price while the
  markup said "0.00". It now uses `effectivePrice`, so markup and page cannot disagree (ADR-0018).
- **No product markup without a product photo.** A product whose only picture is our logo emitted the
  logo as its image; Google requires the product. The markup is now left out for it.
- **`Organization.alternateName`** "Bhendi-Bazaar.com", against the neighbourhood of the same name.
- **Admin titles** no longer read "… | Admin — Bhendi Bazaar"; the navbar logo uses
  `fetchPriority="high"` instead of preloading against the page's own LCP image.
- **Wording:** the vocabulary allowlist reason now says schema.org names the property (Google does not
  require it); the journey no longer claims to guard `htmlLimitedBots`, which the unit test of its
  pattern does.
- **Follow-ups, not done:** `ProductGroup` markup for families (ADR-0043) needs a family id and
  `variesBy` in the DTO; `sku`/`brand` are not in the storefront DTO.

## 2026-10-31 — GTM B3: a nightly encrypted backup, and a drill that proves it restores

- **`.github/workflows/db-backup.yml`**, nightly at 01:47 IST and by hand: `pg_dump` (custom format, client
  17) over the direct connection, piped straight into `age` encryption to a public key, so no plain dump
  ever touches disk and the private key never touches CI; exact row counts per table beside it; both
  uploaded to `db/<year>/<month>/` in a bucket of our own. Under 1 KB, or no counts, fails.
- **`scripts/backup/db-restore-drill.sh`** decrypts, restores into a local scratch database, recounts
  every table and fails on any difference; it refuses a non-local target.
- **Rehearsed here** against the local database: 62 tables, restored with every count matching; a
  tampered count, the wrong key and a non-local target each failed as they should.
- **Fails red until configured** (OPERATIONS.md "Backups": key, bucket with Bucket Lock, write-only
  token, six secrets). A green job that backs up nothing is what this replaces.
- **Your part:** the setup steps; Prisma Starter for the snapshot layer; the first drill.
- **Tests:** `deploy-safety.test.ts` (21): the job is scheduled, cannot be made advisory, encrypts to a
  public key and never names the private one.

## 2026-10-31 — GTM B12 (code part): product page loads sooner, pool size is a setting, a load smoke

- **The product page renders without waiting for similar products**, which now stream in their own
  Suspense boundary.
- **The first gallery image is preloaded** (`preload`, Next 16), since it is the page's LCP.
- **The lightbox's code loads on the tap that opens it** (`next/dynamic`), not with the page.
- **`DATABASE_POOL_MAX`** sets connections per instance; unset keeps today's 10. **Your part:** switch
  `DATABASE_URL` to the pooled string (Prisma Postgres pooler or Accelerate, already provisioned), then
  set this to 1–3.
- **Load smoke:** `perf/k6-smoke.js` and a manual *Load smoke* workflow (pinned actions,
  `contents: read`) walk home → category → product → cart at a chosen peak, reads only; fails on >1%
  errors or p95 over 1.5 s. Not run here (no k6 and no target); run it against the preview.
- **Not done here:** dropping `libphonenumber` from the client bundle and lazy-loading crop and video
  need a bundle measurement first, which wants a proper bundle analysis rather than a guess.
- **Checked:** the journeys (which open a product page and add to cart) pass, 12 of 12.

## 2026-10-31 — GTM B5: fixes from the review — sessions end with their password

- **An attacker's session no longer survives the claim.** A session now carries an HMAC fingerprint of
  the password it was issued under (keyed by `NEXTAUTH_SECRET`; never the hash). `requireSession` and
  `optionalActiveSession` compare it on the read they already make: a changed or cleared password ends
  every older session, so the pre-hijack row is closed without a schema change. **Side effects:**
  everyone signs in once more after this deploys (older sessions carry no fingerprint, and the attacker's
  is one of them), and changing your password signs you out everywhere, this device included. The
  fingerprint is stamped only at sign-in, never on `session.update()`, which a held token could call.
- **The pages and data reads use the same check** (`orders`, `order`, `wishlist`, `bid`, and the orders,
  profile, reviews and wishlist data access), so a revoked session cannot read the victim's orders
  either. Only the root layout reads the session directly, for the header's name and avatar.
- **Correction to the entry below: forgot-password did not work after a claim.** It sent nothing to an
  account with no password. It now sends the link to any verified address, so a Google-only account,
  or one whose unverified password was cleared, can set a password from its own inbox.
- **Correction: a suspended person could not use the contact form.** The form sends no email when
  signed in, and the route read them as a guest, so it answered 400. It now keeps the session for
  contact (`onBlocked: "allow"`), and for releasing a hold and quoting a promotion, which only reduce or
  read.
- **Correction: two cart routes answered 500, not 403,** for a suspended account; they now answer through
  `toErrorResponse`.
- **`SHIPROCKET_WEBHOOK_TOKEN`** is in the required list (so `/api/health?deep=1` reports it missing) and
  in both example env files. **Deploy after setting it**, or tracking webhooks are refused meanwhile.
- **To check in Shiprocket before setting the webhook (unverified here):** the header is `x-api-key`,
  and reportedly the dashboard refuses a webhook URL containing "shiprocket"; if so, the route needs
  renaming before the token can be configured. Your call.
- **Mutation-tested:** the fingerprint check removed, and forgot-password back to refusing no-password
  accounts: each red, each restored.
- **Tests:** `blocked-session.test.ts` (10), `google-prehijack.test.ts` (5); the session fixtures in
  `admin-auth`, `contact-email` and `review-routes` now carry the fingerprint a real session would.

## 2026-10-31 — GTM B10: structured data, one title template, Google reads the head

- **Product markup** (`Product` + `Offer`) on every product page: the price is what the buyer pays (the
  offer price when one applies, from the same resolver that charges, ADR-0018), written from paise by
  `paiseToDecimal` without division (Invariant 3); out of stock when there is none or the item is up for
  bidding; the selling org named. `BreadcrumbList` on category pages; `Organization` and `WebSite` with a
  search action on `/s?q=` on the home page. Serialised with `<` escaped (`src/lib/structured-data.ts`).
- **One title template** in the root layout (`%s — Bhendi Bazaar`); product and category pages give their
  own name, social cards keep the full title.
- **Googlebot gets metadata in `<head>`**: `htmlLimitedBots` is Next's own list plus Googlebot, so the
  canonical and title are not streamed into `<body>`.
- **Product soft 404 closed in metadata too:** `generateMetadata` calls `notFound()` instead of returning
  the site card.
- **`priority` → `preload`** on `next/image` (deprecated in 16).
- **Waiting on you:** `BRAND_PROFILES` in `src/lib/config.ts` (official Amazon, Flipkart, Meesho,
  Instagram and Google Business Profile URLs) for `sameAs`; and the return window, return shipping and
  delivery cost and times for `MerchantReturnPolicy` / `OfferShippingDetails`, which are not in the code
  as data. Ratings markup waits for a review floor (90-day plan).
- **Allowlist edit (ADR-0056, a review finding):** `vocabulary.test.ts` exempts schema.org's `seller` property in `src/lib/structured-data.ts` only; Google requires that name, and our own prose there still says org.
- **Tests:** `structured-data.test.ts` (9); a new journey asks for a product as Googlebot and checks the
  canonical and title are in `<head>` and the markup's price and availability. Journeys 12 of 12.

## 2026-10-31 — GTM B7: fixes from the review

- **Fixed a regression from the B7 entry: video sources failed on a 60 s deadline.** A 200 MB source
  needs about 28 Mbit/s to arrive in a minute, so a large but legal upload would have failed every retry
  and stayed PROCESSING. `putObject` now scales its deadline with the bytes it sends (floor 256 KB/s, at
  least 60 s), and the video job reads its source on `OUTBOUND_TIMEOUT_MS.bulk` (15 min).
- **The startup check reaches someone.** `/api/health?deep=1` answers 503 with `config: "incomplete"`
  when a required variable is missing, so the uptime monitor alerts; the names stay in the server log,
  never in the public response.
- **The health query has a 5 s deadline**, and a probe in progress is shared, so pings during a slow
  database add no queries.
- **The deadline guard is stricter:** comments are stripped first, a call needs `AbortSignal.timeout` or
  `.any` (not just the word "signal"), and `worker/` is scanned too.
- **The commit is read through `server/shared/deployment.ts`** (`APP_COMMIT`, falling back to Vercel's),
  not a host variable in a route (ADR-0037 D1), and only on the deep probe.
- **Not done, needs your decision:** root `CLAUDE.md` is at its 200-line limit, so "every outbound call
  has a deadline" and "routes read the session through `optionalActiveSession`" have no index line there;
  they live in `src/app/api/CLAUDE.md` and the guard tests. Trimming an index line would make room.
- **Mutation-tested:** config not checked, missing names leaked into the response, the video job back on
  the image deadline, a flat transfer deadline, and a "signal" only in a comment: each red, each restored.
- **Tests:** `observability.test.ts` (13).

## 2026-10-31 — GTM B5 (account and webhook part): pre-hijack, suspended accounts, a signed carrier webhook

- **Pre-hijacked accounts closed.** Google sign-in onto a password account nobody verified now removes
  that password in the same conditional write that marks the address verified
  (`claimUnverifiedForOAuth`). Before, an attacker who registered the victim's email first kept a working
  password after the victim linked Google. The owner sets a password through forgot-password.
  **Not closed:** a session the attacker already holds stays valid until its JWT expires; revoking it
  needs `tokenVersion` (90-day plan, Security depth).
- **A suspended account is refused everywhere.** The 13 route handlers that read `getServerSession`
  directly (cart, wishlist, reviews, addresses, bids, order create, promotion quote, abandon, contact)
  now read through `optionalActiveSession`, which answers 403 for a blocked user and null for a guest.
  Reading reviews and the contact form treat a suspended person as a guest instead, so they can still
  read and contest it. A guard fails any route that calls `getServerSession` again.
- **The Shiprocket tracking webhook needs its token.** `x-api-key` must match `SHIPROCKET_WEBHOOK_TOKEN`
  (constant time), checked before the body is read; otherwise 401. **Owner action:** set a long random
  token in Shiprocket's webhook settings and the same value in Vercel. Until then every tracking webhook
  is refused, which is the point: a forged "delivered" releases a payout.
- **Not here, because each needs a spec (payment state, schema, contract):** create-order overwriting
  `gatewayOrderId`, an owner or guest-token check on create-order/confirm-free/abandon, the
  `Idempotency-Key` on place-order, and dropping the order id from the lookup response.
- **Mutation-tested:** the old `markEmailVerified` path, the claim made unconditional, the standing check
  ignored, a route reading `getServerSession` again, the webhook failing open when unset, and the token
  check removed: each red, each restored.
- **Tests:** `google-prehijack.test.ts` (3, against the database), `blocked-session.test.ts` (5),
  `shiprocket-webhook-auth.test.ts` (4).

## 2026-10-31 — GTM B9: fixes from the review

- **Blocking, fixed: the `useMutation` lock dropped a different call.** A second `mutate(v2)` while
  `mutate(v1)` was in flight got v1's promise: on the channel-types editor, the marketplace facts card and
  the reviews table (per-row actions, not gated), the second row was never sent and still reported
  success. The lock now joins only a call with the same variables; a different one is sent.
- **Blocking, fixed: a 30 s timeout under a 50 MB upload.** Image uploads, the profile picture and both
  bulk-import steps pass `TRANSFER_TIMEOUT_MS` (5 min). A write that times out now says it may still go
  through and to refresh before retrying, instead of inviting a second order or a duplicate upload. A
  reply that stalls while its body is read is a timeout too.
- **"Try again" refetches.** The error screens take Next 16's `retry`, not `reset`, which re-rendered the
  same failed server payload. A storefront page now fails inside its own shell (`(main)/error.tsx`); the
  root screen has a phone gutter; `PageError` uses `PageShell` for its width.
- **The cart cannot be overwritten before it is read.** persist saves on every set; its storage now
  ignores writes until rehydrated, so an effect in a child of the provider can never save an empty cart
  over the real one.
- **Checkout is keyed on its buy-now item**, so moving between two buy-now links snapshots the new one.
  An unknown or withdrawn buy-now item says "That item is no longer available" instead of the generic
  error screen.
- **`pending` is documented as button-only** (with `asChild`, a link navigates before it can stop it).
- **Ratchet:** the regex now also counts `busy`, `frozen`, `isUpdating`, `isDeleting`, `isToggling`,
  `isRemoving` and `isCreating`; the honest count is **96** (the earlier 65 missed those).
- **Correction to the entry below:** the empty-checkout race did not exist before that entry; it arrived
  with `skipHydration` in the same change and was fixed there.
- **Mutation-tested:** one lock for every variable, the write timeout worded as a read, the body timeout
  unmapped, and writes allowed before the read: each red, each restored.
- **Tests:** `double-submit.test.tsx` (19).

## 2026-10-31 — GTM B7 (code part): a health probe, a startup env check, a deadline on every outbound call

- **`GET /api/health`** for an uptime monitor: plain answers without the database; `?deep=1` checks it,
  at most once per 30 s per instance (`server/shared/health.ts`), and answers 503 when it cannot reach
  it. `no-store`; carries the deployed commit. Declared in `EXTERNALLY_CALLED`.
- **`src/instrumentation.ts`** checks `src/lib/env.ts` at server start and logs what is missing as an
  error. It logs rather than throws until production's variables are confirmed. The list now matches
  OPERATIONS.md's required rows (adds `RAZORPAY_WEBHOOK_SECRET`, `APP_ENV`, `NEXT_PUBLIC_APP_URL`,
  `CREDENTIAL_KEYS`, `RESEND_API_KEY`, `EMAIL_FROM`) and drops `KV_REST_API_*`, which nothing reads until B6.
- **Every outbound call in `server/` has a deadline** (`server/shared/deadline.ts`): R2 PUT/GET 60 s,
  HEAD/DELETE 15 s; Razorpay create-order and payments lookup 15 s; Shiprocket login 15 s. Resend's SDK
  takes no signal, so the wait is bounded (`withDeadline`). The new guard found one the review missed:
  Shiprocket's connection test, now on the carrier's own 30 s.
- **Not done here (needs your accounts):** Sentry (DSN), the UptimeRobot monitor (OPERATIONS.md says
  where to point it), and alerts on the worker heartbeat and `jobs_failed`, which need a destination.
- **Mutation-tested:** a Razorpay timeout removed, the email deadline removed, the plain probe querying
  the database, no cache window, deep never 503, and the startup hook unwired: each red, each restored.
- **Tests:** `observability.test.ts` (9).

## 2026-10-31 — GTM B9: a double tap is one request, and screens say what is happening

- **In-flight lock.** `useMutation` and `useServerForm` join a call already in flight, so a double tap
  or a held Enter sends once and both callers get the one answer. Every form and click on these hooks
  gets it at once.
- **`Button pending`**: a spinner, `aria-busy`, clicks ignored, never `disabled`. `aria-disabled` now
  dims like `disabled`. Add to cart and Buy now use it; out of stock stays clickable and says why.
  A ratchet holds the 65 remaining `disabled={…pending}` gates; the count only falls.
- **`apiRequest`** times out at 30 s and maps a timeout or a dead network to a sentence, as an
  `ApiError`; a caller's own cancellation passes through untouched.
- **The cart is read after mount** (`skipHydration`), so the server render and the first client render
  agree. Found while doing it: **checkout snapshotted the cart in a child effect, which runs before the
  provider's rehydrate**, so a hard load of `/checkout` could show "No items to checkout" to a full
  cart. The snapshot is now `useCheckoutSnapshot`, which waits for `hasHydrated`; the sign-in merge waits
  too, so it never merges an empty basket. The cart page shows "Loading your cart…" until then.
- **Error and loading screens:** root `error.tsx` and `global-error.tsx` (`PageError`: what happened,
  try again, home); `loading.tsx` for checkout, orders, an order and the profile, none of which calls
  `notFound()` (honest-status).
- **Caught by the browser journeys, not the unit tests:** the first `Button pending` attached a click
  handler to every button, which a server component cannot pass; every page 500'd. Fixed before commit.
- **GTM B8 review fixes:** `audit-prod.mjs` compares its entry point as a real-path URL, so a path with a
  space no longer skips the gate and exits 0 (reproduced); it names the registry's own error and waits
  10 s before retrying. The e2e job caches the browser, has a 20-minute timeout, and keeps the report on
  success too, so a test that passed on retry leaves a trace. The Playwright port comes from
  `NEXT_PUBLIC_APP_URL`. The fixture product is reset to its whole shape every run. **Recorded
  deviation:** the journeys run against a build made in CI, not the Vercel preview that ships; a
  break only in Vercel's environment is not caught yet (needs a deployment-protection bypass secret).
- **Mutation-tested:** each lock removed, the lock never released, no timeout, the offline mapping
  removed, `pending` setting `disabled`, eager hydration, a new `disabled={isLoading}` gate, and the
  snapshot taken without waiting: each red, each restored. The e2e checkout step did **not** go red
  for the snapshot bug (the page streams in after the provider has rehydrated), which is why the
  hook has its own test.
- **Tests:** `double-submit.test.tsx` (14); journeys 10 of 10, now including the cart reaching checkout.

## 2026-10-31 — GTM B8: browser journeys gate the deploy; B1 review fixes

- **`e2e/`, Playwright 1.63.0**, phone and desktop against `next start` on a production build. Five
  journeys: home with a nonce CSP and no `'unsafe-inline'`; unknown product and category answer 404;
  category → product → add to cart → the cart shows it; an empty cart says so; sign-in offers email and
  password. `e2e/seed-fixtures.ts` builds one product on the throwaway database through
  `ensureFixtures` and refuses any other database.
- **CI:** the PR-only `build` job is now `e2e`. It builds, starts and runs the journeys on **every**
  event, and `deploy` needs it, so a push to `main` ships only after a browser has filled a cart on that
  commit. A failed run uploads its report and traces (14 days).
- **B1 review (M1):** the audit is `scripts/audit-prod.mjs`. A registry outage is retried once and
  reported as an outage (exit 2), not a finding. An advisory with no fix can be listed in
  `audit-allowlist.json` with a reason and an expiry; an entry past its date, or matching nothing, fails
  (ADR-0056). The list is empty.
- **B1 review (M2):** the guard now proves the audit step is in the `test` job with no `continue-on-error`.
- **B1 review (L1, L2):** `DEPENDENCIES.md` carries the new versions and the reasons for the floors;
  `ARCHITECTURE.md` re-dated.
- **Not done here (yours):** branch protection on `main` requiring `test` and `e2e`. Without it a PR can merge with them red: the deploy then refuses, but `main` carries the break.
- **Mutation-tested:** add-to-cart broken in the app (rebuilt) → the cart journey red on a real browser;
  `deploy` without `e2e`; `e2e` made PR-only; `continue-on-error` on the audit; the allowlist's expiry
  ignored; a stale entry kept; `high` no longer blocking. Each red, each restored.
- **Tests:** `deploy-safety.test.ts` (18); `npx playwright test` 10 of 10, and 30 of 30 with each test run three times.

## 2026-10-31 — GTM B1: Next.js 16.4.3, and CI refuses a high advisory

- **`next` 16.3.5 → 16.4.3** (and `eslint-config-next` with it, both pinned exactly): closes
  GHSA-2464-fhr4-w9xw (critical, unauthenticated RCE through Image Optimization), GHSA-673q-mjm6-r5xr
  (critical) and GHSA-p3m5-59mp-jv5r (high). `sharp` ≥0.35.5.
- **The other high advisories in production dependencies**, all in-range bumps with no major version
  change: `zod` 4.2.1 → 4.6.7 (floor `^4.6.6`; GHSA-mrhx-c7xc-m3w5, memory exhaustion while validating,
  and zod parses every request body), `prisma`/`@prisma/client`/`@prisma/adapter-pg` 7.10.0 → 7.10.1
  (kept in step), and transitive `deepmerge-ts`, `mysql2`, `brace-expansion`, `source-map-js`.
  `npm audit --omit=dev --audit-level=high` now reports 0; 9 moderate remain.
- **CI:** that audit is a blocking step in the test job, after `npm ci`.
- **No code change was needed.** The 16.4 upgrade guide lists nothing breaking for a 16.x app; ESLint 10
  support is opt-in and ESLint stays on 9.
- **Fixed from the B8 entries:** `deploy-safety.test.ts` failed `tsc` (the spawned env lacked `NODE_ENV`),
  and `ARCHITECTURE.md`'s test-file count was one short. Both were missed because that session could not
  install dependencies.
- **Mutation-tested:** lockfile `next` back to 16.3.5, `^16.4.3`, `eslint-config-next` lagging, the
  audit step removed, and its level raised to `critical`: each red, each restored.
- **Suites run here, against a local Postgres 16 with full git history:** `tsc --noEmit`, `lint:boundary`,
  the whole suite, and `next build` (16.4.3, Turbopack).

## 2026-10-31 — GTM B8: fixes from the review

- `.env.worker.example` is now the worker's complete list (28 names, the 13 that shared server code
  reads added), and `deploy-safety.test.ts` holds both workflows to exactly that list, not a subset.
- The `needs: deploy` check no longer passes on `deploy-preview`; the Vercel pin check also refuses
  `vercel@latest` or an unpinned `npx vercel` anywhere in `ci.yml`.
- `compose-env.sh` no longer empties the base file when a multi-line value carries `(` or `[`
  (continuation lines were used as grep patterns; predates B8). It also no longer exits 1 when only
  the base file is set, which could stop the staging step under `set -e` (fixed in the entry below).
- **Not changed:** Dependabot targets the default branch; whether it should target `develop` is the owner's call.
- **Mutation-tested:** `needs: [test, deploy-preview]`, an extra `npx vercel`, `RESEND_API_KEY` dropped
  from `ci.yml`, an unlisted staging secret, and the continuation-line guard removed: each red, each restored.
- **Tests:** `deploy-safety.test.ts` (12), again under a vitest stand-in; the real suite has not run.

## 2026-10-31 — GTM B2 and B8: functions in Mumbai, CI sees only the secrets it names

- **B2.** `vercel.json` sets `regions: ["bom1"]`. Functions ran in `iad1` (Washington DC) against a
  Mumbai database, about 200 ms per sequential query. Confirm on the next deploy with the
  `x-vercel-id` header (`bom1::bom1`).
- **B8.** No workflow passes `toJSON(secrets)` any more: the worker deploy and the staging worker name
  each `WORKER_ENV_*` / `WORKER_STAGING_ENV_*` secret they pass (every variable the worker reads), and
  `infra/worker/compose-env.sh` reads them from the environment, skipping unset (empty) ones. The
  staging step sees production's `DATABASE_URL` only, for its same-database refusal. **Owner check:** a
  `WORKER_ENV_*` secret for a variable not listed in the step is no longer passed.
- **B8.** `deploy-worker` needs `deploy`, so the worker starts only after the web build has migrated
  the schema. Workflows default to `permissions: contents: read`. Every action is pinned to a commit
  SHA (same major, latest patch), the Vercel CLI to `58.4.4`, and `.github/dependabot.yml` proposes
  npm and action bumps weekly.
- **Not done here: B1 (Next.js ≥16.4.1).** The session that made this change could not reach the npm
  registry, so the lockfile could not be regenerated; it is still the first blocker.
- **Mutation-tested:** `toJSON(secrets)` restored, one action unpinned, `vercel@latest`, `deploy-worker`
  needing only `test`, `permissions` removed, one worker secret dropped, `regions` removed, and empty
  secrets written: each turned its `deploy-safety.test.ts` case red, each restored.
- **Tests:** `deploy-safety.test.ts` (11), run under a stand-in for vitest because `node_modules` could
  not be installed; the real suite has not run on this change.

## 2026-10-31 — GTM readiness review recorded

- `docs/GTM-READINESS.md`: the whole-codebase production and GTM review (latency, SEO, security,
  infra, compliance, engineering practice). It holds scores against the 2026-10-29 baseline, the
  verified blockers (Next.js RCE advisory, functions running in `iad1`, no database backup, gateway-order
  overwrite), a week-by-week roadmap, owner actions and costs, and re-runnable progress checks. Listed in
  `docs/README.md`. Docs only; no code changed.

## 2026-10-31 — family-merge: members kept in the order the shop picked them

- The family save named two look-alike members in the database's sort order, which differs by
  collation: CI's Postgres (`en_US.UTF-8`) sorts "black" before "Black", local `C` the reverse, so
  `family-merge.test.ts` failed only in CI. Members now keep the order of the shop's selection.
- **Reproduced** on a local database created with `en_US.UTF-8`: the old code failed the test, the
  fix passes. **Suites run there:** the whole suite in UTC (2503), `tsc`, `lint:boundary`.

## 2026-10-29 — inventory-sync: the five-minute order check costs little when nothing changes

- A marketplace reports every order still waiting on every check (Flipkart's waiting shipments,
  Amazon's last order again). Each was a transaction of three or four operations per line, every
  five minutes. Now one read finds the lines already recorded; only a new line, or one whose state
  moved, opens a transaction. Locations and listings are read only when something is new.
- Due connections are claimed in one `UPDATE … RETURNING`, and the connection is read once. The
  cursor is written only when it moved and something came in, or hourly.
- A quiet run is now about 3 database operations plus the queue's own (was about 10, plus about 3.5
  per waiting order line).
- **Mutation-tested:** every reported line processed again → the quiet-check test red; the cursor
  written on every run → red. Each restored.
- **Tests:** `stock-sync.test.ts` (18).

## 2026-10-29 — inventory-sync and family-merge: fixes from the self-review [CONTRACT]

- **Amazon's first order check after turning sync on** no longer asks for orders updated within
  two minutes of now, which Amazon refuses; the start is held back two minutes.
- **A listing the marketplace turns down** is recorded on the listing and named on the section
  ("turned down n listings"), instead of "Sending… 119 of 120" for ever; it is sent again on its
  next change (Q25, which supersedes Q12's last clause).
- **An order whose listing had no product** reads "Not linked to a product: stock not taken".
- **Match locations:** Save with nothing picked says "Pick a location first."
- **Family form:** the price is shown through `paiseToRupees` (Invariant 3), checked with the shared
  `rupeeAmount` (at most two decimals), and SKU and price stack on a phone (ADR-0015).
- **Not changed:** every stock change still enqueues its push in the business transaction,
  checkout's included (ADR-0038); whether to enqueue only for linked products is the owner's call.
- **Mutation-tested:** the two-minute clamp removed → `stock-providers.test.ts` red; the refusal
  record removed → the turned-down test red. Each restored.
- **Tests:** `stock-providers.test.ts` (5), `stock-sync.test.ts` (17).

## 2026-10-29 — A missing product or category answers 404; categories get their own title and canonical

- Search Console listed dead product slugs and unknown categories as soft 404s: both answered
  200. The root layout's `<Suspense>` around every page started the stream before `notFound()`
  could set a status; it is gone, and boundaries stay inside pages. A category's DAL read now
  throws `NotFoundError` (it threw a plain `Error`), and the page calls `notFound()` on it.
- The category page gains `generateMetadata`: its name, description and canonical (seo D6), which
  ends every category sharing the site title. A real category with no products now says so
  ("No products in this category yet") instead of showing an empty grid.
- `/semi-formal-ridas` redirects permanently to `/category/semi-formal-rida` (`next.config.ts`).
- **Tests:** `honest-status.test.ts` — no layout wraps `children` in Suspense; no `loading.tsx`
  above a storefront page that calls `notFound()`. **Mutation-tested:** the root layout's original
  line (`fallback={<LoadingSkeleton />}`) put back, and a `loading.tsx` added above the product
  page → both red. Checked against `next dev`: unknown
  product and category 404, real ones 200 with their own title and canonical; `next build` passes.

## 2026-10-29 — inventory-sync: fixes from the fresh-context review [MIGRATION] [CONTRACT]

- **The worker no longer fails at boot.** The five-minute order check was a schedule under the
  hour floor (and a fifth schedule over the cap of four), which throws when the worker loads, taking
  every job type down. It is now a job that enqueues its next run only while a connection has sync
  on, each run claiming the connections due (`ordersCheckedAt`), so a second chain stops (Q23). The
  daily stock check is enqueued by the daily maintain pass. `enqueueLater` added to the job seam.
- **A push reads what was last sent inside its lock**, so one waiting on another never compares
  against a stale send. The daily check compares with what was last sent and sends again through
  the push, under the same lock (D5).
- **Older sales are not taken again:** turning on starts the order check from now; a sale from
  before sync is recorded, not taken (Q24, `MarketplaceOrder.beforeSync`). Flipkart's dispatched
  orders are read too, so a sale dispatched between checks still counts.
- **Matching locations sends what waited** (Q16). A location matched to a closed shop location
  is sent 0 and asks for a new match; deleting a shop location clears its match (`ON DELETE SET
  NULL`) instead of being refused.
- **The section's missing states:** "Sending… n of m", "Couldn't reach…", "…doesn't let us send
  stock yet", from `stockProblem` (D7, reworded in the TRD: a refusal is recorded, not predeclared).
  A product stocked by the marketplace says so; an oversold line clears once shipped or cancelled;
  "today" is India's day. Orders rows show "Before stock sync" and a guessed location (Q18).
- Migration `20261029000500_stock_sync_checks`: adds `ChannelConnection.ordersCheckedAt`,
  `stockProblem` (checked set), `MarketplaceOrder.beforeSync`; swaps one foreign key's delete rule.
  Drops no data.
- **Mutation-tested:** the worker loading a 300-second schedule → `worker-registrations.test.ts` red
  (the test that would have caught this); listings read before the lock → the waiting-push test red;
  the before-sync rule removed → red; the chain continuing with nothing due → red; no push after
  matching → red; the cursor not reset on turn-on → red. Each restored.
- **Tests:** `worker-registrations.test.ts` (2, new), `stock-sync.test.ts` (16).

## 2026-10-29 — Search results leave the index; the old site's other WordPress addresses answer 410

- `/s` is out of the sitemap and carries `noindex, follow` (seo R8, the `/s` part of TRD delivery 1).
- `src/middleware.ts` answers `/wp-*`, `/xmlrpc.php`, `/feed`, `/comments/feed`, `/tag/` and
  `/author/` with 410, beside the dated permalinks. `/category/` is excluded because the app serves it.
- **Tests:** `portal-guards.test.ts` (the new shapes are gone; `/feeds/*` and `/category/feed` are not).
  **Mutation-tested:** the rule narrowed back to dated paths → the new test red.

## 2026-10-29 — inventory-sync units 4–5: the daily check, the product's stock line and every section state [MIGRATION] [CONTRACT]

- A daily check reads every linked listing's counts, sends ours where they differ and records a
  `StockCorrection` (migration `20261029000400_stock_corrections`, adds a table only); the section
  lists today's (Q9). A product's On marketplaces block shows what was last sent and an oversold
  order; a marketplace that stocks every listing itself (FBA) says so and sends nothing (Q5, Q20).
- **Tests:** `stock-sync.test.ts` (the daily check records a correction; FBA skipped).

## 2026-10-29 — inventory-sync unit 3: the order check, oversold and cancellations [MIGRATION] [CONTRACT]

- `channels.check-orders` every five minutes per connection with sync on: Amazon's Orders API v0
  (Q21; moving to `searchOrders` is in BACKLOG, due before 2027-03-27), Flipkart's shipment search.
  Each line is a `MarketplaceOrder` once (migration `20261029000300_marketplace_orders`, adds a table,
  unique on connection, order and line; claimed with `createMany … skipDuplicates`, since a unique
  violation inside the transaction would abort it). Stock is taken through catalog's new `takeUpTo`,
  never below zero; what could not be taken flags the line oversold (Q7). A line cancelled before
  dispatch restocks once, claimed by a conditional update (Q8). Orders gains a Marketplace orders tab.
- **Mutation-tested:** the claim's skip removed → the re-reported order test red; `takeUpTo`'s
  minimum removed → the oversold test red; `restockedAt: null` removed from `claimRestock` → the
  three-checks-at-once test red 3/3. Each restored.
- **Allowlist edit (vocabulary.test.ts):** `item\.SellerSKU` — Amazon's own field name in its
  orders response, read in `amazon.stock.ts`; the word is theirs, not our vocabulary.
- **Tests:** `stock-providers.test.ts` (4), `stock-sync.test.ts`.

## 2026-10-29 — inventory-sync unit 2: the switch, the preview and the push [MIGRATION] [CONTRACT]

- Stock sync is off, on or paused per connection (migration `20261029000200_stock_sync`, adds
  columns only). Turning on shows a preview of every linked listing's count, theirs and ours, then
  sends (Q4). Every stock write in catalog (reserve, release, restock, adjust, takeOne, import) and
  archiving enqueue `channels.push-stock` in their transaction, through `server/shared/jobs`, so
  catalog does not import channels; a count reaching 0 goes first (Q19). The push reads the count
  under a lock per product and skips counts already sent (Q22). `JobSpec` gains `priority`.
- `PUT /api/org/[orgId]/channels/[channel]/stock-sync` (`stockSyncChangeSchema`).
- **Mutation-tested:** the already-sent skip removed → the repeat-send test red. Restored.
- Product read census +1 (`stockForPush`, archived included to send 0); product repository +1.
- **Tests:** `stock-plan.test.ts` (4), `stock-sync.test.ts`, `payment-failed-restock.test.ts` (mock
  gains `aggregate` and the enqueue).

## 2026-10-29 — inventory-sync unit 1: marketplace locations and Match locations [MIGRATION] [CONTRACT]

- `ChannelLocation` (migration `20261029000100_channel_locations`, adds a table only): each
  marketplace's pickup locations, read on connect and Read again, matched once to one of the shop's
  or marked not used; a pincode match is suggested; a new one or a closed match flags the section
  (Q15–Q17). Amazon without multi-location is one location (Q12, from the production read of
  2026-10-29). `PUT …/channels/[channel]/locations` (`locationMatchSchema`).
- **Tests:** `stock-sync.test.ts` (matching, the closed and new flags).
- **Suites run (all units):** `tsc --noEmit`, `vitest run tests/unit`, the integration suite on
  `bhendi_bazaar_ci`, `lint:boundary`, `docs:check`, `next build` — 2150 unit, 336 integration,
  all green.

## 2026-10-29 — family-merge: fixes from the fresh-context review

- **Adding to a family checks against its members:** the family's members are planned with the new
  listings, so a second "Black" is refused naming the one already in it; a new member inherits the
  family's own facts, not ones worked out among the new listings only.
- **Leftovers of a large group:** listings already in the family no longer fill the page's 30, so
  "Add to family" shows the rest (Q19).
- **A member whose listing says nothing on an axis is asked**, with every answer of ours; a length
  is answered with its number (Q18).
- **The page plans as the save does**, with existing products' own answers.
- **One type per family:** a product of another type is refused by name; a category is checked
  against the family's type; more than six axes is refused (the type rule's limit).
- **Locked axis widening** (`FOR UPDATE`), so two adds at once keep both. A shared fact the shop
  typed is kept as the shop's on the family, not as the listing's.
- **Suggestions:** trigrams computed once per listing; only a SKU of three parts or more has a stem,
  so "HJB-001" and "HJB-002" no longer chain different items; at most 300 listings looked at.
- **The form:** three columns from `lg:`, members grouped under the first of two differences,
  existing members listed when adding, Try again on a failed read, a cleared price no longer blocks
  a member left out.
- **Mutation-tested:** the family's members left out of the plan → red; the type check removed → red;
  leftovers not filtered → red. Each restored.
- **Tests:** `family-plan.test.ts` (12), `family-suggest.test.ts`, `family-merge.test.ts` (15: a
  failure inside the transaction rolls back members already made; a duplicate against the family;
  32 listings in parts; another type; a silent listing answered). Product read census +1
  (`familyMembers`, deliberate). **Suites run:** `tsc --noEmit`, `vitest run tests/unit` (2142),
  the integration suite on `bhendi_bazaar_ci` (325), `lint:boundary`, `docs:check`, `next build`.

## 2026-10-29 — family-merge unit 5: Flipkart, suggested and picked by hand [MIGRATION] [CONTRACT]

- Listings with no marketplace grouping that look like one item (a SKU differing only at the end, or
  titles this close) are suggested together on Not linked, three at a time, never grouped by
  themselves (Q5). "Not one item" is remembered on the listings (`familyHintDismissedAt`, migration
  `20261029000000_family_hint_dismissed`, adds a column only) and the suggestion stays away (Q21).
  "Group listings" ticks listings by hand; Continue with fewer than two says why.
- **Mutation-tested:** the dismissed filter removed → the dismissal test red. Restored.
- **Tests:** `family-suggest.test.ts` (3), the picker in `family-form.test.tsx`, `family-merge.test.ts`.

## 2026-10-29 — family-merge unit 4: the Listings page's group entry points [CONTRACT]

- Each variation group's header offers its one action across tabs: "Settle as one family",
  "Make one family" (all settled separately), "Add to family" (some outside it) or "See family".
  The first group explains itself until the shop has made a family from that marketplace, and a
  group member's Settle page offers "Settle all n as one family" (Q22).
- **Tests:** `family-merge.test.ts` (each state, settle → family → add; make), `settle-form.test.tsx`.

## 2026-10-29 — family-merge unit 3: the save, its routes and the form [CONTRACT]

- `POST /api/org/[orgId]/channels/family`: the server plans again from the stored reads and refuses,
  before writing, two members alike, an unanswered one, no product type, a SKU in use (ignoring case)
  or a product in another family not moved; main photos are copied first (one failure saves
  nothing); then one transaction locks the listings in id order, makes or reuses the family (widening
  its axes, Q16, Q20), creates each new member with its own SKU, price, stock and photos queued,
  joins existing products conditionally, links each listing, and writes facts: shared ones on the
  family and on members as `family`, each member's own as the marketplace's (D4). A member whose
  listing is not live is added off sale (Q24). The family page and form implement ux.md's states.
- **Found while building:** an answer the browser sent for a fact the listing already answered
  replaced it; answers now count only for a fact that member was asked (a test for it added).
- **Mutation-tested:** moving without the owner's say-so → red. The lock verdict, the conditional
  link and the SKU unique index each stop a second save on their own (removing two of them still
  leaves the third rolling it back whole); recorded as layered, not missing.
- **Tests:** `family-merge.test.ts` (11), `family-form.test.tsx` (4).

## 2026-10-29 — family-merge unit 2: the family page's read [CONTRACT]

- `channelFamilyService.page`: this shop's listings on one connection, none left off, the first 30
  (Q19, Q23), each read live at two a time and stored, a failed read standing on the last one;
  Amazon's parent gives the family's name and description (Q2, Q10). Every type is planned, so a
  category choice shows its axes and shared facts at once. `FamilyPageDTO` in
  `channel-family.types.ts`; CONTRACTS.md moved with it.

## 2026-10-29 — family-merge unit 1: the planner

- `server/channels/family-plan.ts` (pure): each member planned as one product (marketplace-facts D5);
  the axes are the type's plus any asked fact or measurement the members differ on (Q16); shared
  facts fill the family once (Q7); duplicates (Q8) and unanswered values (Q18) are found; an existing
  product's answers win (D4).
- **Mutation-tested:** duplicates never found → red; every attribute an axis → red; the listing over
  an existing product's answer → red; answers not of ours accepted → red. Each restored.
- **Tests:** `family-plan.test.ts` (9). **Suites run for units 1–5:** `tsc --noEmit`, `vitest run
  tests/unit`, the integration suite on `bhendi_bazaar_ci` (321 passed), `lint:boundary`,
  `docs:check`, `next build`.

## 2026-10-25 — marketplace-facts implemented

- The owner checked it: facts fill and are answered on the Settle page, the product card shows,
  changes and resets them, and the review fixes hold. BACKLOG follows. Next: family-merge.

## 2026-10-25 — marketplace-facts unit 6 and product-merge Q31: fixes from the fresh-context review [CONTRACT]

- **Matching saved none of the page's facts:** a matched product also carries `categoryId`, so the
  save took it for a new product and found no type. Told apart by `productType` now; a match-mode
  test proves only the product's empty facts fill and its own answers stay.
- **A typed SKU differing only in case or spaces is refused**, as listings are matched (`skuKey`),
  naming the product that holds it. Two settles typing the same SKU at once make one product; the
  other is told it is used (already mapped; now tested).
- **The Settle page reads the marketplace beside its other loads**, and a failure planning the facts
  costs the section, never the page.
- **No type:** a matched product with none, or a category with none, says "This product has no
  product type…" instead of "Pick a category"; ux.md gains that row and "Couldn't read the
  marketplace". `SettleFactsDTO.matching` added.
- **Kept as is:** when the page's read fails, a save may still fill the clear facts from an earlier
  stored read; only empty facts fill, and the worker would fill them anyway.
- **Mutation-tested:** the SKU compare back to exact → the case test red; restored. The unit test now
  answers then skips, proving the skip clears the answer.
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit`, the integration suite on
  `bhendi_bazaar_ci`, `lint:boundary`, `docs:check`, `next build`.

## 2026-10-25 — marketplace-facts unit 6: facts filled and answered on the Settle page [CONTRACT]

- **The owner's call (Q35, superseding Q3):** the attributes are read when the Settle page opens, so
  choosing a category shows its type's facts at once: the clear ones filled "from Amazon", the
  unclear ones as Amazon's words with our answers to tap, or Skip for now (Ask again brings one
  back). They are saved with "Add product" or "Link and save", in the same transaction, only into
  empty facts. The product page card stays for later changes and older products.
- **Nothing is trusted from the browser:** the server re-plans from the stored read for the type
  being saved, and keeps an answer only for a fact still asked and one of our answers to it.
  `SettleDetailDTO.facts` and the settle body's `answers` added; CONTRACTS.md moved with them.
- **Mutation-tested:** the answer check removed → the "one of ours" test red. Restored.
- **Tests:** `settle-form.test.tsx` (the chosen category's facts; tapped answers sent, skipped
  ones not), `marketplace-facts.test.ts` (the page's facts per type; the settle saves the clear ones
  and valid answers; answers to unasked facts or not ours are kept out).
- **Docs:** decisions Q35, ux.md's "Settle page: Facts from Amazon" states and journey 1, TRD D7
  and unit 6.

## 2026-10-25 — product-merge: the product's SKU is typed freely [CONTRACT]

- The Settle page's SKU was a choice among the listings' SKUs. It is now a text field that starts
  at the listing's SKU and suggests the listings' SKUs (product-merge Q31, superseding Q10, owner).
  The settle route no longer refuses a SKU that no listing has; a SKU another product holds is
  still refused by name. Each listing keeps its own SKU. CONTRACTS.md's `sku` line moved with it.
- **Tests:** `settle-form.test.tsx` (a typed SKU is what is sent).

## 2026-10-25 — marketplace-facts: fixes from the fresh-context review [MIGRATION]

- **A long marketplace answer could empty a product's facts:** a stored entry caps the marketplace's
  words at 500 characters and the column reads as empty when one entry fails. The fill now caps
  them and writes only entries the stored schema accepts.
- **Amazon's water codes left the shared fill:** Amazon's provider says them as `yes` / `no` beside
  its code; the fill reads yes or no for any marketplace (Q4).
- **The card:** a skipped question is listed with "Ask … again"; a read that fills nothing new says
  so instead of "All facts filled".
- **Skips are one statement each** (`array_append` / `array_remove`), so two quick skips both stay.
- **A product save reads its marks scoped by shop.** A fill landing between that read and the save
  can still be overwritten by the save; the shop's own answers never are, and "Fill from" restores it.
- **The Amazon data migration** (unpushed) inserts a type's row read only when that type already
  publishes elsewhere on Amazon, instead of dropping it; local checksums refreshed.
- **The row lock is proven:** fill and the shop's answer at the same moment keep both; with the
  locks removed that test went red three runs in three. Restored.
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit`, the integration suite on
  `bhendi_bazaar_ci`, `lint:boundary`, `docs:check`, `next build`.

## 2026-10-25 — marketplace-facts unit 5: type and category, park and ask the admin [CONTRACT]

- **Settle's starting category** comes from the listing's own marketplace type (D9): the Settle page
  reads it when it opens and stores it; a mapped type with one category starts there, several ask
  "Amazon lists this as Rug, our Prayer mat. Which category does it go in?", several types ask which
  type first. `SettleDetailDTO.type` added.
- **No type of ours fits:** the Settle page offers our types, "Park it" (Left off with reason
  `no_type`, Q6) and "Ask the admin" (WhatsApp and mail links with ux.md's message; nothing is sent
  by us, Q12, Q13). A parked row reads "Waiting for a product type." with Ask the admin and Bring
  back, which clears the reason. `ChannelListingDTO.waitingForType` added; the leave-off route takes
  an optional `reason`.
- **The card** asks an untyped product's type and category; the choice sets the product's category,
  its type follows (Q25, Q27), and the stored read fills at once. Kind is left to the owner (Q34);
  the card never parks a linked listing (Q33).
- **Tests:** `settle-form.test.tsx` (category tap sent; park with reason), `marketplace-facts.test.ts`
  (park and bring back; the reason refused off Left off by the database check; the Settle page's
  type, mapped and none; category choice types and fills the product).

## 2026-10-25 — marketplace-facts unit 4: the "Facts from {marketplace}" card [CONTRACT]

- **One card per linked listing** on the product page, the same for every marketplace, computed
  from the stored read, today's mapping and the product (D6): filled facts marked "from Amazon",
  "from Amazon · you chose" or "changed by you (was Crepe from Amazon)", questions with our answers
  as chips (more in the Choose sheet, `ResponsivePicker`), Skip for now, Reset, Show all, the
  90-day "Check the mapping" note (Q8), and every ux.md state's copy (`facts-copy.ts`).
- **Commands** on `POST /api/org/[orgId]/channels/[channel]/listings/[id]/facts` (fill, answer,
  change, reset, skip, category), through `channelsApiClient` and `useMarketplaceFacts`. "Fill from"
  reads in the request so busy and reconnect show at once (Q32). Answering a fact the shop answered
  meanwhile is refused with "You already answered this: Crepe. Nothing was changed."
- New `ProductMarketplaceFactsDTO` (`channel-facts.types.ts`); CONTRACTS.md moved with it.
- **Mutation-tested:** the answer without its empty check → "answered meanwhile" red. Restored.
- **Tests:** `marketplace-facts-card.test.tsx` (7: questions, changed and reset, no type, no answers,
  busy, category, stale), `marketplace-facts.test.ts` (answer once, change keeps Amazon's words and
  reset restores them, skip and ask again).

## 2026-10-25 — marketplace-facts unit 3: the fill, on settle and on Fill [CONTRACT]

- **One fill for every marketplace** (`server/channels/fact-fill.ts`, pure, D5): our type (the
  product's own, else mapped, several to choose, or none), then each empty fact: an exact mapped
  value or our answer's words fills, two or none is a question ranked by name similarity, numbers
  parse, the water code is the boolean; dimensions fill length, width and height in the type's unit.
- **Catalog's conditional commands** (D7): `fillFromMarketplace` locks the product row and writes
  only empty facts and measurements (each with its marketplace and words), weight when unset or
  0.5 kg (Q28), MRP when empty; brand label details fill the product's brand, a same-name brand or
  the default brand for "Generic", only where empty, and never create one (Q29); HSN fills the
  category's tax code in the listing defaults only when it has none (Q21).
- **The job** `channels.fill-facts` reads one listing, stores the read and fills; a settle enqueues
  it in its transaction for each listing (Q3). Listing's `channelMapService` serves the mapping
  backwards (D2). A form save keeps marketplace marks (Q31); measurements carry `source` too.
- **Mutation-tested:** the planner filling an answered fact → red; filling on two named answers →
  red (a test added for it); catalog writing over a set fact → red; weight always replaced → red;
  brand fields always written → red. Each restored.
- **Tests:** `fact-fill.test.ts` (10), `marketplace-facts.test.ts` (fills only empty; an edit made
  meanwhile wins; Generic brand; HSN once; no answers; settle queues the job). Product read census
  +1 (`marketplaceFacts`, deliberate).

## 2026-10-25 — marketplace-facts unit 2: each listing's attributes, read [CONTRACT] [MIGRATION]

- `MarketplaceProvider.listingAttributes` returns a listing's marketplace type, its attributes
  flattened to `name` / `name.part` paths, and its product details in our units (D1). Amazon reads
  `getListingsItem` (parcel then item weight in kg, dimensions in cm, HSN, MRP in paise, ISO origin,
  brand, manufacturer, packer, importer); Flipkart reads its listing details (MRP, HSN, parcel,
  label) and no attributes, the "no answers" case (Q4).
- Migration `20261025000200_listing_attributes_and_mrp`: `ChannelListing.attributes`,
  `attributesReadAt`, `attributeSkips`, `leftOffReason` (checked: `no_type`, only when left off),
  `Product.mrpPaise` (checked ≥ 0). Adds columns only.
- **Tests:** `listing-attributes.test.ts` (5).

## 2026-10-25 — marketplace-facts unit 1: several marketplace types per type, and Amazon's mapping [CONTRACT] [MIGRATION]

- `ChannelCategoryMap.publishes`: a type of ours may be read from several marketplace types, with
  one publishing (Q18, D3). Readiness and the register read only publishing rows; undoing "not
  sold" removes only the publishing row. Migration `20261025000000_channel_types_read_and_publish`
  replaces the unique with partial uniques.
- Amazon's mapping ships as data, migration `20261025000100_amazon_mappings` generated from
  `amazon-mapping.json` (47 types, 124 attributes, 225 values), each row dated with its source.
  Combo rows read only (combos are not sold on any channel).
- The admin's types control on `/admin/channels/[channel]` (`PUT /api/admin/channels/types`): add,
  remove, "Publishes here"; the publishing one cannot be removed until another is marked (Q26).
- **Mutation-tested:** readiness reading every row → red; undoing "not sold" deleting read rows →
  red; the conditional delete removed → red. Each restored.
- **Tests:** `channel-type-mapping.test.ts` (5), `channel-mappings-seed.test.ts` (read-only combos).
- **Suites run for units 1–5:** `tsc --noEmit`; `vitest run tests/unit`; the integration suite on
  the local `bhendi_bazaar_ci` database (304 passed); `lint:boundary`; `docs:check`; `next build`.

## 2026-10-23 — product-merge implemented

- The owner checked merging on production: adding a new product, matching, and leaving off all work.
  Spec and TRD move to Implemented; BACKLOG follows. Next: marketplace-facts.

## 2026-10-23 — product-merge: the Settle page's match link was blocked at the edge

- Clicking a match opened a Vercel "This request was blocked" page (403, `x-vercel-mitigated: deny`):
  the edge firewall refuses any `product=` or `p=` query parameter, whatever its value, even on
  other pages. The Settle page now reads `productId`, which passes. Nothing in our app returned it.
- **Suites run:** `tsc --noEmit`, the docs check. The edge rule is in the Vercel firewall, not the
  repository; if it is ever changed, this parameter name can come back.

## 2026-10-21 — product-merge: fixes from the fresh-context review [CONTRACT]

- **"Add product" could not submit:** the form validated before its choices (title, photo source)
  were in its values, and showed no field. Choices are now written into the values as they change;
  a component test submits the real form (`settle-form.test.tsx`).
- **The listings are locked first** (`SELECT … FOR UPDATE`, D4's order), so two identical taps make
  one product and the second is told "This listing was just linked to …", not "SKU in use".
- **A match checks its stock locations** belong to the shop, as the add path does.
- **Try again keeps the copy's mode** (`photoMode`, added to the unpushed migration): a match still
  replaces its gallery only when every photo arrives. A copy whose re-read fails counts every
  photo as failed, so Try again shows instead of "Copying…" forever.
- **Link back** leaves a left-off row alone and names a product already linked on that marketplace.
- **The page:** the photo-copy error shows with Try again and Add photo; "settled meanwhile" offers
  Back to listings; descriptions have Show all; the read failure has Try again; the load error says
  it could not read the listing; the Settle page uses `PageShell`; Undo on Leave off says "Brought
  back.". SKU and description limits match the product form. Weight logged as Q30.
- **Mutation-tested:** the form without the choice sync → the component test red; no lock first →
  the identical-taps test red; retry always appending → red; no location check → red. Each restored.
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit` (180 files), the integration suite on the
  local dev database (`product-merge.test.ts` now 14 tests), `lint:boundary`, `docs:check`.

## 2026-10-21 — product-merge: settle every marketplace listing [CONTRACT] [MIGRATION]

- **Units 1–5 of the accepted TRD**, built in one pass and left uncommitted for the owner. A
  not-linked listing is added as a new product, matched to one the shop has, or left off; the same
  item on the other marketplace is suggested (same SKU, then a similar name) and settled with it.
  Migration `20261022000000_listing_settlement` adds `leftOffAt`/`leftOffById`, photo-copy counts
  and a partial unique index of one listing per connection per product; it drops nothing.
- **One transaction per settle (D4):** catalog creates the product inside it (the insert split from
  `createProduct`; the slug is chosen free first, since a duplicate aborts a Postgres transaction),
  or updates only the chosen fields and sets counted stock against what the page saw; every listing
  is linked conditionally, and a short count rolls the product back. Photos: the main one is copied
  before the save (a failure writes nothing); the rest by `channels.copy-listing-photos`, which
  re-reads them from Amazon's catalogue (Q26), accepts only Amazon's image hosts, at most nine, and
  stores them through the new `mediaImportService`. Flipkart gives no photos or description.
- **Screens:** the details panel's three choices, the match picker, the Settle page, "Show left
  off" on Not linked, the row's suggestion line, "Linked by you", photo progress with Try again on
  the product, and the card's "to settle". Built-time ux.md changes: "settled meanwhile" names the
  product but not the person (who linked is not stored), and rows for left off meanwhile, loading
  the listing and a failed read.
- **CONTRACTS.md** — Settling marketplace listings. **Gates:** the product-visibility census gains
  four reads that see archived products on purpose, each with its reason.
- **Mutation-tested:** the settle link without its condition → the two-taps test red (the first
  version of that test passed under the mutation, because the second tap was refused for its SKU;
  it was rewritten so only the link can stop it); a read linking a left-off listing → red; never
  archiving → red; any https host accepted for photos → red. Each restored.
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit` (179 files), the integration suite on the
  local dev database (36 files, 286 tests; `product-merge.test.ts` new), `lint:boundary`,
  `docs:check`.
- **Still to do:** A7 and A8 on the owner's catalogue at 360px, including photos against Amazon.

## 2026-10-21 — channel-import implemented

- Acceptance A1, A7 and A8 checked by the owner on production: Amazon and Flipkart listings read
  and linked by SKU, the variant group, Unlink / Undo / Link back, the details panel on a phone,
  and Flipkart's prices read as rupees. Spec and TRD move to Implemented; Q20 is implemented;
  BACKLOG and TRACKER follow. Next: product-merge.

## 2026-10-21 — channel-import: Flipkart reads without product search (Q20)

- The production probe (`scripts/flipkart-listing-probe.ts`, run on the owner's request) showed
  Flipkart answers our app 404 on `listings/v3/product/search` and 200 on listing search, listing
  details and the SKU lookup. The Flipkart reader now skips product search on a 404 and reads every
  listing from search and details: no picture (the initial tile) and no one-shop account check on
  Flipkart. Decision Q20 supersedes Q8 (Flipkart pictures) and Q10; spec, TRD, ux.md and
  INTEGRATIONS.md say so. Amazon is unchanged.
- **Mutation-tested:** treating product search's 404 as fatal again → the new Q20 test red.
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit`, the integration suite on the local dev
  database, `lint:boundary`, `docs:check`.

## 2026-10-21 — channel-import: a refused request stops the read instead of retrying [CONTRACT]

- The first live Flipkart read failed with HTTP 404 on every attempt and the page said "Flipkart is
  busy". A 4xx other than auth or rate limit is now `MarketplaceRequestError`: not retried, the read
  stops as `not_allowed` ("Flipkart doesn't let us read your listings yet…", a new ux.md row), and
  the job's log line names the call and status (`flipkart /listings/v3/product/search`, `404`).
  Amazon's calls carry a step name the same way.
- `scripts/flipkart-listing-probe.ts` asks each Flipkart listing call once with the stored token
  and prints status and field names, to find which calls our app may use. Not run by Claude.
- **Mutation-tested:** classing a 404 as busy again → the new unit test red (five calls, not one).
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit`, the integration suite on the local dev
  database, `lint:boundary`, `docs:check`.

## 2026-10-21 — channel-import: fixes from the fresh-context review [CONTRACT]

- **A read could stay "running" forever** after a worker restart or a slow Amazon report: the
  queue retried within the 30-minute takeover window and gave up. Readers now report in while they
  wait (`ListingSink.alive`), the takeover window is 5 minutes (`READ_STALL_MS`), and
  `ChannelReadDTO.stalled` brings Read again back for a silent read.
- **Different account:** a Flipkart reconnect no longer wipes the account id its reads learned, so
  the different-account stop can fire; a fresh connect after Disconnect still starts clean. The page
  sends that state to Channels, as ux.md says.
- **"See listings"** shows on every live card, so a connection made before this feature has a way in.
- **Flipkart** stops before writing any row if product search named no account (D6 cannot be skipped).
- Tab numbers count what the tab lists (gone rows included); "Reading… n of m" shows once rows
  exist; linking looks only at the batch's SKUs; the unreachable "No SKU" row left ux.md.
- Docs: decisions Q14–Q19 back in the table; channels CLAUDE.md names `channel-import.service` as
  public; the image-delivery allowlist reason corrected; no audit row on a refused account, noted in D6.
- **Mutation-tested:** dropping the different-account stop → the new D6 test red; restored.
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit` and the integration suite on the local dev
  database (all green, `channel-import.test.ts` now 9 tests), `lint:boundary`, `docs:check`.

## 2026-10-21 — channel-import: listings read, linked by SKU [CONTRACT] [MIGRATION]

- **Units 1–5 of the accepted TRD**, built in one pass and left uncommitted for the owner.
  `ChannelListing` (migration `20261021000000_channel_listings`, no drops) holds one row per
  marketplace SKU; `ChannelConnection` gains the read-state columns. The worker job
  `channels.read-listings` runs on connect and on "Read again": Amazon through the all-listings
  report then the Listings API for pictures and variation parents; Flipkart in three passes, naming
  the account first so a second shop's is refused before a row is written.
- **Screens:** the Listings page per marketplace (tabs, search, Show more, variant groups, details
  panel with Unlink / Link back), the card's reading line and "See listings", and the product page's
  "On marketplaces" block. Copy is ux.md's; one row was added there while building: a read that
  meets a different account than the connection's.
- **Catalog:** `listWithSku` and `compareFacts` reads; a product a listing links to cannot be
  deleted, and the refusal says so and points at Archive.
- **CONTRACTS.md** — Marketplace listings: `ChannelReadDTO`, `ChannelListingDTO`,
  `ChannelListingsPageDTO`, `ChannelListingDetailDTO`, `ProductMarketplaceLinkDTO`, the card's
  `read` and `listings`, three routes.
- **Allowlists, each with its reason:** overlay-surfaces (details panel, decision 3), image-delivery
  (marketplace pictures, not our asset), vocabulary (`seller-sku`, Flipkart's `/sellers` and
  `sellerId`), product-visibility (two reads that see archived products on purpose). CSP `img-src`
  gains Amazon's and Flipkart's image hosts.
- **Mutation-tested:** paise from floats instead of digits → red; keeping an Amazon variation parent
  as a row → red; relinking a listing the owner unlinked → red; claiming a read with no condition →
  the one-at-a-time test red; marking gone on a stopped read → red. Each restored.
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit` (178 files, 2,078 tests), the integration
  suite on the local dev database (35 files, 274 tests, `channel-import.test.ts` new),
  `lint:boundary`, `docs:check`.
- **Still to do:** A1, A7 and A8 on the owner's own Amazon and Flipkart accounts at 360px, including
  Flipkart's price units. Spec and TRD move to Implemented after that.

## 2026-10-21 — channel-connectors implemented

- Acceptance A8 passed on the owner's accounts: Amazon connected on production and Flipkart on
  production. Spec and TRD move to Implemented; BACKLOG and TRACKER (F-013) follow.
- What the first live connect taught, recorded in INTEGRATIONS.md and decision Q19: redirects match
  character for character, and production's origin is `www`. Amazon gained the `www` callback;
  Flipkart, whose single redirect cannot be edited, got a new third-party app.
- Still to watch: the worker's first daily `channels.maintain` run moving "Last checked".

## 2026-10-20 — Worker env from one secret per variable

- The deploy no longer needs the whole worker env file re-pasted to change one value. Every GitHub
  secret named `WORKER_ENV_<NAME>` becomes `NAME=value` (`infra/worker/compose-env.sh`, read through
  `toJSON(secrets)`); `WORKER_ENV_FILE` stays as an optional base whose lines an individual secret
  replaces, so the move can be gradual. The staging worker does the same with
  `WORKER_STAGING_ENV_<NAME>` over `WORKER_STAGING_ENV_FILE`, and still refuses to run when its
  database equals production's, now compared on the composed files.
- Both workflows fail with a named error when the composed file has no `DATABASE_URL`.
- Checked locally: base plus overrides, overrides only, and the staging prefix ignoring production
  secrets. OPERATIONS.md's secrets table and staging note describe it.

## 2026-10-20 — channel-connectors: fixes from the fresh-context review [CONTRACT]

- **The different-account way out:** Disconnect now sits beside Renew now and Reconnect, and on the
  different-account note, so "disconnect, then connect" (Q8) can be done from the screen.
- **A marketplace cannot be switched on without connecting it:** `org-channels.schema.ts` accepts
  only `google` and `meta`; a `PUT` naming Amazon or Flipkart is refused (D11). CONTRACTS.md notes it.
- **The callback** refuses a state signed for another marketplace's channel, and checks membership
  with the uncached `resolveOrgScope` (now exported from `org-auth.ts`).
- **The daily job survives a bad row:** each connection is maintained in its own try/catch and
  counted as `failed`, logged by id only. "Needs reconnecting" and "checked" are conditional writes
  (`state = CONNECTED`), so a disconnect mid-check is never undone.
- Recorded as decisions rather than changed: Amazon's `selling_partner_id` is trusted from the
  redirect as Amazon documents it (Q17); the 25-shop count can be passed by one in a race, which
  Amazon itself refuses (Q18).
- UI: touch targets `min-h-10`; closed sets compared by constant; the store card's host comes from
  `appUrl()`; "Still loading…" after 3 s; long names expand on a tap; the vocabulary exemption now
  applies only to `server/channels/` and `channel-copy.ts`. ux.md records each added string.
- Mutation-tested: dropping the callback's channel check — "never spends an Amazon state on
  Flipkart's callback" red; dropping its same-user check — "refuses a return finished in another
  sign-in" red. Restored.
- Tests: `tests/unit/channel-callback-route.test.ts` (6), `channel-cards.test.tsx` (+3). Ran
  `tsc --noEmit`, `tests/unit` (all), the channel integration suites, `lint:boundary`, `docs:check`.

## 2026-10-20 — channel-connectors unit 6: daily maintenance and the dashboard banner

- `channels.maintain` (`server/channels/channels.jobs.ts`, the third of four schedule slots, every
  24 h): per live connection, Flipkart renewal when under 30 days of refresh token remain, a health
  check behind "Last checked", and re-sealing under the newest `CREDENTIAL_KEYS` version inside the
  row lock. Suspended shops are skipped (Q11). Registered in `worker/main.ts`; `.env.worker.example`
  gains `CREDENTIAL_KEYS`, which the worker must share with the site.
- The org dashboard shows `ChannelAttentionBanner`: one line for renewal due or needs reconnecting,
  "2 channels need attention." for both (spec R9). Its read fails alone, like the other cards.
- Tests: `tests/integration/channel-connections.test.ts` "the daily pass … skips a suspended shop";
  `tests/unit/channel-cards.test.tsx` banner cases.

## 2026-10-20 — channel-connectors unit 5: the Channels page

- New page `/org/[orgId]/channels`, "Channels" in the sidebar under Products (Q5): own store, Amazon,
  Flipkart, Google, Meta; one column, two from `md:`, three from `lg:`. Server-rendered from
  `channelsDAL`; client leaves are only the card actions, the disconnect sheet (shared `FormDialog`),
  the feed toggles and the return note. Requests go through `channelsApiClient` (`connectUrl`,
  `disconnect`, `checkNow`) with `useMutation`. Every string is ux.md's, in `channel-copy.ts`; two
  lines added while building (Flipkart's revoke line, Meta's feed text) are recorded in ux.md.
- "Where you sell" is removed from What you sell, and `where-you-sell.tsx` deleted (R8). `StatusBadge`
  gains `connected`, `attention`, `problem`, `muted` on existing semantic tokens; no new token.
- Allowlist edit, `tests/unit/vocabulary.test.ts`: lines are scanned with the marketplaces' own names
  removed (Amazon's consent host and Sellers API path, Flipkart's `Seller_Api` scope, "Seller
  Central", "seller account", "asks sellers"), because the signed-off copy and the APIs must spell
  them as the marketplaces do. Mutation-tested: "the seller signs in here" beside the consent URL —
  red; restored.
- Tests: `tests/unit/channel-cards.test.tsx` (13, every card state's copy and action; every
  `CONNECT_RESULT` has copy).

## 2026-10-20 — channel-connectors units 3–4: Amazon and Flipkart, and the routes [CONTRACT]

- Providers `server/channels/providers/amazon/` (Seller Central India consent with `version=beta`
  and a 25-shop cap while the app is unlisted — a fact in the provider, Q16; Login with Amazon
  tokens; `getMarketplaceParticipations` as the health read) and `providers/flipkart/` (GET token
  calls with Basic auth; the token-expiry endpoint as the health read). Ten-second timeouts;
  failures classed as reconnect (`MarketplaceAuthError`) or try later (`MarketplaceUnavailableError`).
- Routes: `GET …/channels/[channel]/connect`, `GET /api/channels/[channel]/callback` (in
  `EXTERNALLY_CALLED`: the marketplaces' redirect), `DELETE …/connection`, `POST …/connection/check`.
  CONTRACTS.md gains "Channel connections".
- Tests: `tests/unit/channel-providers.test.ts` (14).

## 2026-10-20 — channel-connectors unit 2: the channels domain [MIGRATION]

- Migration `20261020000000_channel_connections`: `ChannelConnection`, unique per (shop, channel), a
  partial unique index making one live connection per marketplace account a database fact (Q8), and
  CHECKs on state and on tokens matching state. No data dropped. Never cascades from a shop.
- `server/channels/`: types and closed sets, the one switch `CHANNELS_CONNECT`, the signed ten-minute
  `state`, the repository, and `channel-connection.service` (overview cards with derived renewal-due,
  unavailable and full; connect; disconnect; lazy renewal under `FOR UPDATE`; check; the daily pass).
  Connect and disconnect write listing's `OrgChannel` in the same transaction through the new
  `orgChannelService.setIn`, audited. New domain: `PUBLIC_SURFACE` (`channels: []`), root CLAUDE.md
  table, `server/channels/CLAUDE.md` in `LIVING_DOCS`, ARCHITECTURE.md's domain list and counts.
- Mutation-tested: removing the row lock — "two renewals at once" went red (renewed twice);
  removing the service's other-shop check alone stayed green (the partial index refused it);
  removing the index handling as well — "refuses an Amazon account already connected to another
  shop" went red. Restored.
- Tests: `tests/unit/channel-connect-state.test.ts` (6), `tests/integration/channel-connections.test.ts`
  (14). Ran `tsc --noEmit`, `tests/unit` (all, 2057), `tests/integration` against `bhendi_bazaar_ci`
  (only the known `channel-registry` index failure), `lint:boundary`, `docs:check`.

## 2026-10-20 — channel-connectors unit 1: secrets at rest under a versioned key

- New `server/shared/crypto.ts`: AES-256-GCM under `CREDENTIAL_KEYS` (`version:64-hex` pairs; the
  highest encrypts, any listed decrypts), ciphertext prefixed `v<n>:`, `needsReencryption` for the
  daily re-encrypt in unit 6 ([TRD](specs/marketplace-integration/channel-connectors/trd.md) D3).
  A missing or malformed key throws and never echoes key material.
- Shipping moved onto it; `server/shipping/utils/encryption.ts` removed. Values written before this
  (no prefix) still decrypt from `ENCRYPTION_KEY`, so stored carrier passwords keep working; new
  writes need `CREDENTIAL_KEYS`, which the deployment must now set (OPERATIONS.md). Shipping's
  ADR-0002 status records the amended key handling.
- Mutation-tested: decrypting with the current key when the named version is missing — "refuses to
  open once its key is removed" went red; restored.
- Review fixes: the GCM tag length is pinned to 16 bytes, and a truncated tag is refused; production
  and worker env templates list `CREDENTIAL_KEYS`.
- Tests: `tests/unit/credential-crypto.test.ts` (14). Ran `tsc --noEmit`, `tests/unit` (all, 2020),
  `lint:boundary`, `docs:check`.

## 2026-10-18 — SDLC gains a scope cut, a decision log and a UX stage (ADR-0061)

- New cycle: spike → spec → **UX** → TRD → build → review. Recorded in
  [ADR-0061](adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md),
  with one line in CLAUDE.md's conventions index and the cycle block rewritten.
- `/bb-sdlc spec-start` now cuts a feature to one outcome, with a **Scope** section split into In
  and Later, and opens `decisions.md` (append-only: Q id, answer, who decided, why). The spec
  template's "Out of scope" becomes Scope plus Q ids for open questions. The TRD's Gates list,
  previously pasted into its Packages section, is put back.
- New `/bb-sdlc ux-start`: journeys, screen inventory, a state matrix for every screen (first use
  through phone, tablet and desktop), copy deck, phone-first prototype and the owner's dated sign-off.
- `/bb-build` refuses open decisions and UI without a signed-off `ux.md`, and its acceptance report
  walks every state. `/bb-review` and `pr-finish` check screens against `ux.md` and scope against
  the ids. `/bb-brainstorm` turns options into open Qs and parks anything beyond its question.
- docs/README.md and docs/specs/README.md describe the two new files. Docs only; `docs:check` ran.

## 2026-10-15 — Worker machine bans repeated SSH failures (fail2ban)

- `infra/worker/provision.sh` gains `intrusion_prevention`: fail2ban's `sshd` jail on the systemd
  journal (Ubuntu 24.04's sshd does not write `auth.log`), banning through ufw so the firewall stays
  one rule set — 5 failures in 10 minutes earns a 1-hour ban.
- Why now: the Amazon SP-API developer profile attests to intrusion detection and prevention; the
  machine had a firewall and key-only SSH but nothing watching for repeated attempts.
- Applied to the live worker 2026-10-15 by running only this step (not the whole script, which would
  reset ufw and overwrite the deployed `compose.yml`): fail2ban 1.0.2-3ubuntu0.1 active, the `sshd`
  jail reading the journal, and its first ban already a ufw `REJECT` rule; worker container still
  healthy. No test covers the provisioning script; `bash -n` checks its syntax.

## 2026-10-14 — Shipping is charged from a signed quote, never from the request [CONTRACT]

- **Invariant 1 violation fixed.** Checkout charged `shippingGroups[].selectedRate.rate` as the
  browser sent it, rejecting only a negative number; an edited request could ship for ₹0. Done as a
  defect fix under ADR-0002, with no TRD: the rule existed, the code did not obey it.
- `POST /api/shipping/rates` adds `quote` to every rate and to `defaultRate`: an HMAC
  (`server/shipping/rate-quote.service.ts`, key derived from `NEXTAUTH_SECRET` for this purpose
  only) over courier, provider, charge in paise, origin and destination pincode, billable weight and
  a 30-minute expiry. A stateless signed quote is the field's usual answer (carrier rate handles at
  checkout); re-quoting the carrier inside the order transaction was rejected — it holds row locks
  across an HTTP call and can charge a price the buyer never saw.
- Order creation's `selectedRate` is `{ quote }` only; the old fields are stripped. Checkout reads
  courier, provider and charge from the signature and requires its origin, destination and weight
  to equal the parcel it allocated. An edited, expired or wrong-parcel quote is a 409.
- A refused payment re-quotes the checkout's shipping, keeping the buyer's courier where it is
  still offered, so an expired quote does not refuse every retry.
- Mutation-tested, each red then restored: signature check removed (unit + integration);
  destination check removed (unit + integration); expiry, weight checks removed (unit); checkout
  passing a fixed pincode instead of the address (integration); the key ignoring the secret (unit).
- Tests: `tests/unit/rate-quote.test.ts` (6), `tests/integration/order-transaction.test.ts` (+2,
  fixture now signs its quote). Ran `tsc --noEmit`, `tests/unit` (all), `tests/integration` against
  `bhendi_bazaar_ci` (only the known `channel-registry` index failure), `lint:boundary`, `docs:check`.
  Reviewed in a fresh context; its findings are fixed here. No migration.

## 2026-10-14 — Store policies page (store-policies)

- `/policies`: one page, twelve anchored sections — shipping, cancellation, returns (7 days),
  refunds (7 business days), payments, privacy, terms, reviews, bidding, grievances, contact. Copy
  describes the manual process where the store has no feature (cancel, return, refund).
- `LEGAL` in `src/lib/config.ts` holds the legal name, address, jurisdiction and grievance officer;
  unset values render as `[TO FILL: …]`. `ABANDONED_HOLD_MINUTES` exported so the page states the
  real hold.
- Reached from the footer (desktop) and a third row in Contact us (phone); added to the sitemap.
- No test: the page is copy. Checked by rendering `/policies` on a dev server — all twelve anchors
  present, the hold, return window, India-only shipping, no-COD line and `[TO FILL]` markers shown.
  Ran `tsc --noEmit`, `tests/unit` (all), `lint:boundary`, `docs:check`.

## 2026-10-14 — Google and Meta product feeds (shopfront-feeds)

- `GET /feeds/google.xml` and `GET /feeds/meta.xml`: RSS 2.0 with the `g:` namespace, built on
  every fetch from `productsDAL.listForChannelFeed`, which maps through the product page's own
  `mapProduct` — so the declared price, offer and bidding hold are the page's answers (spec R2, R3).
- One builder, `server/listing/shopfront-feed.ts`, with the channel a parameter; the shops come from
  `orgChannelRepository.orgsWith`, categories from each channel's own `channel-map` rows.
  Products with no image or description are left out; the brand falls back to the shop's name.
  Characters XML forbids are dropped and text is cut by code point, so one pasted description
  cannot void the file; a sale price is declared only when `hasOffer` says one is in force.
- Gates: `/feeds/*.xml` in `EXTERNALLY_CALLED` (route-reachability); the new read in the
  product-visibility CENSUS (23 → 24) and in org-scoping's `PUBLIC_READS`.
- Mutation-tested, each one red then restored: `isBuyable` ignoring `biddingSlug` (unit);
  `categoryFor` ignoring `notSold` (unit); `orgsWith` dropping `enabled: true` (integration, A4);
  the feed read dropping `AVAILABLE` (integration, A3) and `FROM_ACTIVE_ORG` (integration, R4); the
  crawl-block check removed (integration, R8); the forbidden-character strip removed and truncation
  by UTF-16 unit (unit).
- Tests: `tests/unit/shopfront-feed.test.ts` (14), `tests/integration/shopfront-feed.test.ts` (6).
  Reviewed in a fresh context with `/bb-review`; its findings are fixed here.
  Ran `tsc --noEmit`, `tests/unit` (all), `tests/integration` against `bhendi_bazaar_ci`,
  `lint:boundary`, `docs:check`. One unrelated integration failure: `channel-registry` "refuses a
  second mapping covering every kind" — the local `bhendi_bazaar_ci` lacks the partial index
  `ChannelCategoryMap_channel_productType_allkinds_key` that the dev database has.

## 2026-10-14 — Lockfile resolves from the public npm registry

- `aeefb24` was installed on a work machine, so 185 `resolved` URLs in `package-lock.json` pointed
  at a private corporate Artifactory the deploy cannot authenticate to. Rewritten to
  `registry.npmjs.org` (same tarballs, same integrity hashes).
- New project `.npmrc` pins `registry=https://registry.npmjs.org/`, overriding any machine-wide
  registry so it cannot recur.

## 2026-10-08 — Edit form keeps measurements; "On its own" family saves (BF-014, BF-015) [CONTRACT]

- **BF-014 — measurements blank on edit.** The admin products DAL read the `measurements`
  column through `parseStoredFacts`, whose keys are *facts*. Every measurement key (`bust`,
  `hip`, …) failed it, the defensive parse returned `{}`, and the edit form opened empty although
  the values were saved. Added `parseStoredMeasurements` (keyed by `measureKeySchema`) in
  `server/listing/listing-facts.ts` and used it in `src/data-access-layer/admin/products.dal.ts`.
- **BF-015 — "Too small: expected string to have >=1 characters".** The family picker's
  "On its own" option submits `""`, which `familyId: z.string().min(1)` refused. `kind`, `familyId`
  and `brandId` now read an unselected picker as `null` (`unselectedIsNull` in
  `product.schema.ts`), so `kind` no longer stores `""` either. No existing rows held `""`.
  Additive contract change, recorded under *Listing vocabulary* in CONTRACTS.md.
- Tests: `tests/unit/stored-measurements.test.ts` (parser + a scan that nothing feeds a
  measurements column to the fact parser) and two cases in `product-schema.test.ts`. Both
  mutation-tested; reverting the schema reproduces the exact message the user saw.

## 2026-10-08 — Dates and counts formatted in one locale and zone (BF-013)

- **Root cause**: tables called `toLocaleDateString()` with no locale, so the server (UTC, en-US)
  rendered `10/8/2026` and the browser (IST, en-IN) `08/10/2026`, failing React hydration. It
  recurred in the orders, categories, users and carts tables. Pinning only the locale (BF-006)
  still left a different *day* near midnight, because the zones differ.
- **Fix**: `src/lib/format.ts` pins `en-IN` and `Asia/Kolkata` in `formatDay`, plus new
  `formatShortDate`, `formatDateTime`, `formatDate(value, options)` and `formatCount`. All 24
  call sites across `src/` route through them.
- **Gate**: `tests/unit/locale-formatting.test.ts` fails on any `toLocale*String(` outside
  `format.ts`. Mutation-tested.
- Fixture category hero image is now a local file, so the admin categories table can render it.
- Side fixes: "seller" → "org" in two strings (retired vocabulary); the tracking gate compares
  against `ORDER_STATUS` rather than bare strings.

## 2026-10-08 — Integration tests no longer write to real data (BF-012)

- **Root cause**: `ensureFixtures()` (`tests/helpers/test-db.ts`) borrowed the first real org,
  category, user and carrier with an unscoped `findFirst`. Suites then mutated those rows on the
  dev database: category product types reset to null (4 suites), the org's sales channels deleted
  (3 suites), its colour values and enhancement policy deleted. The stop hook ran these suites
  after every edit, which is why category product types kept disappearing.
- **Fix**: `ensureFixtures()` now owns its world. Every row is found or created by a fixed test
  key (`FIXTURE_KEYS`), so suites mutate only test rows and reruns reuse them rather than leak.
- Three suites that touched shared reference data now leave it as found:
  `channel-readiness-service` used the real `ethnic-wear/abaya` node (now stamped);
  `product-type-table` restores each type's prior `retiredAt` in `finally`;
  `product-family-service` restores `islamic-wear`'s prior variant axis, not a guessed one.
  `bulk-upload` uses the fixture category instead of a random real one.
- **Guard**: `test-integrity.test.ts` fails if the fixture helper or any integration suite reads
  with an unscoped `findFirst`. Mutation-tested: restoring the old borrow fails it.
- Verified: real categories, product types, org channels, listing values, attribute maps and
  enhancement policies are byte-identical before and after a full 32-suite run.

## 2026-10-08 — Buyer product specs and variant switcher (BL-007, BL-008)

- **Specifications section** on buyer product page: facts (colour, material, sleeve length)
  and measurements (length, bust, waist) now render below the description. Added `facts`
  and `measurements` to buyer `Product` type and DAL mapping.
- **Variant switcher**: when a product belongs to a family, an "Also available" row shows
  sibling products with thumbnails. Clicking navigates to that variant's page.
  Added `getFamilySiblings` to `product.read.repository.ts` and `siblings` to `Product`.

## 2026-10-08 — Blocked user session revocation (BF-002, BL-005)

- `requireSession` now checks `isBlocked` on every authenticated request (one PK lookup).
  A blocked user with an active JWT is stopped immediately — not just at next sign-in.
  Resolves BF-002 and BL-005. `requireActiveSession` removed (redundant).
- Admin self-block prevented: `toggleBlockUser` refuses `id === adminId` (BF-001).

## 2026-10-08 — Org blocking: API guard and location confirm dialog (B-007 follow-up)

- **API guard**: `resolveOrgScope` (`src/lib/org-auth.ts`) now checks `org.isBlocked`
  before granting a scope. All `withOrg` route handlers and `requireOrgMember` server
  components reject blocked orgs with "This organisation has been suspended".
  `findMembership` joins the org row to carry `orgBlocked`.
- **Location delete**: Replaced browser `confirm()` with a proper Dialog component
  in `LocationsManager`.

## 2026-10-08 — Tracker bug fixes: seller orders improvements (B-016)

- **Search and filter**: Seller orders page now has a search bar (by order code)
  and a status filter dropdown (confirmed/processing/packed/shipped/delivered).
  Extended `adminOrderRepository.getOrdersForOrg` and `orgOrdersDAL.getOrders`
  with `filters` parameter.
- **Mark as Packed**: Seller order detail page shows a "Mark as Packed" button
  when order status is `processing`. New API route
  `PATCH /api/org/[orgId]/orders/[orderId]/transition` accepting `{ status: "packed" }`,
  with org ownership verification through `adminOrderService.transitionForOrg`.
- No "Mark as Shipped" — shipping is the delivery partner's responsibility.

## 2026-10-08 — Tracker bug fixes: admin org detail page (B-013)

- New page at `/admin/orgs/[orgId]` — read-only portal mirror with horizontal tabs.
  Five tabs live (Dashboard, Products, Orders, Earnings, Reviews); six more
  (Storefront, Listing, Library, Offers, Bidding, Locations) show "coming soon"
  pending `readOnly` prop additions to their interactive components.
- Org rows in the admin orgs table are now clickable (Link on the name column).
- Added `AdminOrgTabs` component for horizontal tab navigation.
- Added `OrgBlockToggle` client component for block/unblock on the detail page.
- Added `getById` to `orgsDAL`.
- Fixed pre-existing `product-family.test.ts` teardown FK constraint error.

## 2026-10-08 — Tracker bug fixes: admin user detail page (B-012)

- New page at `/admin/users/[userId]` — read-only detail view showing profile
  (name, email, mobile, role, joined date), activity stats (orders, total spent,
  last active), and a block/unblock action.
- User rows in the admin users table are now clickable (Link on the name column).
- Added `UserBlockToggle` client component and `getById` to `adminUsersDAL`.

## 2026-10-08 — Tracker bug fixes: product flag derivation (B-015)

- ON_OFFER and NEW_ARRIVAL are now computed, not stored. ON_OFFER is derived from
  whether the product has an active sale price; NEW_ARRIVAL from `createdAt` (14 days).
  FEATURED, HERO, CLEARANCE_SALE remain manual checkboxes.
- Removed ON_OFFER and NEW_ARRIVAL from the product form (`ProductFlagsFields.tsx`);
  only `MANUAL_FLAGS` are shown.
- Added `isNewArrival()` helper and `MANUAL_FLAGS` constant to `src/types/product.ts`.
- Product list table badges now derive ON_OFFER and NEW_ARRIVAL at display time.
- Shrunk the shape-legacy allowlist by one entry (`ProductFlagsFields.tsx` → `rounded-card`).

## 2026-10-08 — Tracker bug fixes: buyer order tracking display (B-009)

- Added order status badge and tracking info to buyer order detail page
  (`src/components/order/order-client.tsx`). Shows order fulfilment status
  (confirmed/processing/packed/shipped/delivered), delivery address, and per-shipment
  tracking cards with courier name, AWB number, tracking URL, and estimated delivery.
  Data already flowed from DB through DAL — just was not rendered.

## 2026-10-08 — Tracker bug fixes: org blocking replaces deletion (B-007) [MIGRATION] [CONTRACT]

- Replaced hard-delete route with block/unblock. `DELETE /api/admin/orgs/[id]` removed;
  `PATCH /api/admin/orgs/[id]` added accepting `{ action: "block" | "unblock" }`.
  Aligns with ADR-0032 (records people authored are retired, never deleted) and
  ADR-0020 (money-bearing records never cascade).
- **Migration**: Added `isBlocked Boolean @default(false)` to Org model with index.
- **Portal guard**: Org layout shows a suspended page when `isBlocked` is true.
- **Buyer-facing**: `FROM_ACTIVE_ORG` visibility filter now excludes blocked orgs
  (`server/catalog/product.visibility.ts`).
- **UI**: Delete button → block/unblock toggle in admin orgs table. Browser `confirm()`
  removed. Blocked badge shown in status column.
- `src/domain/org.ts`: `Org` interface gains `isBlocked: boolean`.
- `orgApiClient`: `deleteOrg` → `blockOrg` / `unblockOrg`.

## 2026-10-07 — Tracker bug fixes: ADR-0053 compliance and error pulse (B-002, B-003, side-note)

- **Button pulse**: Added `data-[error]` classes to Button (`src/components/ui/button.tsx`).
  Any `<Button data-error>` now pulses with a destructive ring — global error signal.
- **B-002**: Checkout button no longer disabled when cart is empty. Clicking shows an
  inline message + pulse effect instead (ADR-0053).
- **B-003**: Location delete button no longer disabled. Server `DomainError` reaches the
  user as a toast via the existing mutation handler (ADR-0053).
- **Side-note**: Product form error banner moved from top of form to directly above the
  submit button, where it's visible on long forms.

## 2026-10-07 — Tracker bug fixes: admin sidebar nav (B-014)

- Added Product Types and Media to admin sidebar navigation
  (`src/components/layout/AdminSidebar.tsx`). Both pages existed but were only
  reachable by typing the URL directly.

## 2026-10-07 — Tracker bug fixes: Instagram share (B-008)

- Replaced browser `alert()` with a sonner toast in the Instagram share handler
  (`src/components/shared/ShareDialog.tsx`). Also fixed the handler copying a
  relative path instead of the resolved full URL.

## 2026-10-07 — Tracker bug fixes: code cleanup (B-004, B-005, B-006, B-010, B-011)

- **B-004**: Removed debug `console.log` statements and `setTimeout` debug wrapper from
  `src/store/cartStore.ts`. Kept `console.warn` for corrupted-item detection.
- **B-005**: Deleted dead `CartService` interface from `src/domain/cart.ts` (zero imports).
  Not a contract change — the interface was never implemented or consumed.
- **B-006**: Removed scaffolding comments (`ADD THIS`) from `prisma/schema.prisma`
  and Prisma marketing boilerplate. Comment-only — no structural schema change, no migration.
- **B-010/B-011**: Deleted dead `getTopProducts` and `getRevenueChart` functions from
  `server/analytics/dashboard.service.ts`, `dashboard.repository.ts`, and their types
  (`TopProduct`, `RevenueChart`) from `dashboard.types.ts` and `src/domain/admin.ts`.
  Both returned placeholder/zero data and had zero callers. Not a contract change —
  no route handler served these types and no client consumed them.

## [PR-286] 2026-10-06 — FormDialog, dead code, and the docs match the tree

- **FormDialog** (`src/components/shared/overlays/form-dialog.tsx`): the fifth overlay surface
  (ADR-0040) — a bottom sheet on phone, a centred dialog from tablet. Today's 17 raw
  `DialogContent` form sites are ratcheted in `overlay-surfaces.test.ts` with their case;
  a new one fails unless it goes through `FormDialog`, `TaskDialog` or is listed with a reason.
  Mutation-tested.
- **Dead code removed**: `AdminAccessButton` (0 importers), `useStockCheck` (0 importers).
  Two single-domain hooks moved to their component: `useCategoryForm` → `components/category/`,
  `useListingValues` → `components/shared/forms/product/`.
- **Docs corrected**: ARCHITECTURE.md no longer claims every handler uses `toErrorResponse`;
  TESTING.md counts and dead-directory paragraph fixed; OPERATIONS.md local DB recipe uses
  the real Docker container on port 5433 and `.env.example`. Verified dates bumped.

## [PR-285] 2026-10-06 — The aggregate's repository carries the aggregate's name

`admin.product.repository.ts` held every product write while `product.repository.ts` was
read-only. That named the write side for the console instead of for the table it owns.
Swapped: `product.repository.ts` is the aggregate repository (writes), `product.read.repository.ts`
is the storefront read model. Same for category. Export names stay (`productsRepository`,
`adminProductsRepository`) so the 56 import sites change their path, not their code.

The `ADMIN_WRITERS` ratchet in `one-repository.test.ts` is now empty: no `admin.*` file writes,
and the test refuses a new one. The rule that held this together — "an admin listing is a query
on its domain, kept as `admin.*` files" — and the rule that held it accountable — "a write in
an `admin.*` file fails the build" — both hold outright.

## [PR-284] 2026-10-05 — Money, page titles and touch targets through the wrappers

- `shared/Money.tsx` replaces inline `formatCurrency` in table/summary contexts —
  `OrderDetailAside`, `OrdersTable`, `ShipmentsPanel`, `SettleEntries`, `CartsTable`.
- `SectionHeader` gains an `as` prop (`h1`/`h2`/`h3`); 17 portal pages' hand-rolled `<h1>`
  converted to `<SectionHeader as="h1" />` with their description.
- `Button size="sm"` is phone-first: `min-h-10` at base (40px touch target), `md:h-8` from
  tablet. The 36 sites that were 32px on a phone are fixed by the primitive, not per-file.
- Skills refreshed: `/bb-review` gains the listing/channel checks (readiness, facts origin,
  reference data, jobs); `/bb-sdlc`'s Gates touched gains one-repository and the visibility
  census; `/bb-brainstorm` knows about fal.run.

## [PR-283] 2026-10-05 — The listing vocabulary becomes its own domain

`server/catalog/` was 43% of `server/` at 14k LOC. Twenty-three files — facts, product types,
families, channel registry, readiness, listing values, org channels, listing defaults, size labels
— had zero outward imports and formed a clean cluster. They now live in `server/listing/`, the
fourteenth bounded context.

Cross-domain calls go through services: `fact-correction.service.ts` used to reach catalog's
product repository directly for the three methods that rewrite a product's facts; those became
`productService.countProductsWhere`/`listProductFactsWhere`/`replaceProductFacts`. `listing-fill`
reaches `brand.repository` and `category.repository` through catalog's declared public surface.

`module-boundaries.test.ts` gains a `listing` entry in `PUBLIC_SURFACE`; the product-visibility
census, the file-cohesion records and the domain table in root `CLAUDE.md` are all updated.

## [PR-282] 2026-10-05 — The pipeline that decides quality, written down and wired in

A review across architecture, the design system, the rules, the ADRs, the process and the docs
found the same thing from six directions: the guards are strong and voluntary. Nothing ran until an
agent chose to run it, review was self-review, and the owner's decisions lived in specs and in one
assistant's memory. This unit is the process half of the answer; the code halves are PR-279 to
PR-281.

- **Ten ADRs** record decisions that were only spec prose or habit: facts as one JSON column with
  an origin per entry (0051), a product type as a row over facts declared in code (0052), readiness
  advises and never gates (0053, superseding 0045 D3), mappings carry a date and source (0054),
  admin modules read and the aggregate's one repository writes (0055), the ratchet pattern (0056),
  one shared hooks home (0057), media as one aggregate (0058), pixel identity (0059), and route
  handlers with an Origin check instead of Server Actions (0060, correcting 0048's CSRF premise).
  Twelve older ADRs gain Status notes saying which decision a later one amended; 0032's heading
  used an em dash the index generator could not read, so the index showed its filename.
- **Hooks, committed in `.claude/settings.json`.** Every `Edit`/`Write` to source runs the
  scanning gates on the spot (`scripts/hooks/post-edit.sh`, ~5s); a schema edit regenerates the
  client and refuses to pass without a migration folder; a docs or skill edit runs `docs:check`.
  The turn cannot end (`scripts/hooks/stop.sh`) with a failing typecheck, failing related tests, a
  changed wire type without `CONTRACTS.md`, or changed code without a CHANGELOG entry. `git push`
  and `gh` are denied for this repo: the owner pushes.
- **`/bb-build`**, the implementation skill the cycle never had: refuses a Draft TRD, plans units
  from Delivery mapped to R/A/D ids, writes the failing test for each acceptance id first,
  mutation-tests and *records* every new guard, reviews in a fresh subagent, flips spec and TRD
  Status together, and ends with an acceptance report the owner walks on a phone.
- **Five docs gates** for what `docs:check` could not see: a spec and its TRD agree on Status (nine
  TRDs said Draft under Implemented specs), CHANGELOG numbers are unique with the newest highest
  (eight historical collisions stay, append-only), every directory rulebook carries `Covers:` and is
  a living doc (`server/shipping/ARCHITECTURE.md` said `Scope:` and had dodged the date gate since
  August), every npm script a doc names exists, and every API route a doc names exists with that
  verb (README named ~20 that were gone). Each broken on purpose once and seen red.
- Root `CLAUDE.md` re-read against the tree: catalog's "Owns" cell, content's, shared's, the admin
  paragraph, Invariants 5–7 and the cycle corrected; the commit rule and the spec-stays-uncommitted
  rule move out of memory into the file; ten index lines added and the skills table folded into one
  line, so it sits at 195 of its 200.

## [PR-281] 2026-10-05 — Every form field's label reaches its control, and a dropped column says whose data goes

`FormField` rendered a raw `<label>` with no `htmlFor` and never gave its control an `id`, so the
102 fields built on `FormInput`/`FormSelect`/`FormTextarea` had labels a click did nothing with
and a screen reader read as "edit text". It now uses `useId()` and the `Label` primitive, passes
`id`, `aria-invalid` and `aria-describedby` to the control, and the hint and error carry the ids
they are described by. Eleven raw labels elsewhere were given `htmlFor`. `labelled-controls.test`
holds both: render tests that the `for` matches the control and the error is announced for it
(all five fail when `htmlFor` is dropped), and a scan for a raw `<label>` without `htmlFor`
outside `ui/` (red on a planted one).

The variants TRD promised (D7) a migration that copied `sizes`/`colors` into the new shape before
the drop. None did, and the drop shipped. The owner confirmed on 2026-10-05 that both were free text
no reader used and are safe to drop in production too; D7 now says so, dated, and the migration's
header carries the confirmation beside the one it already had for `BiddingEvent`. The rule that
makes this a check rather than a memory: `migration-drops.test` requires every `DROP COLUMN`/
`DROP TABLE` migration to state, with a date, that the data was confirmed disposable — older
migrations are on a dated ratchet. Red when both confirmations were removed from the header.

## [PR-280] 2026-10-05 — Credentials stop at the server, and a mutating request must come from here [CONTRACT]

- **Carrier credentials never reached the browser on purpose and did anyway.** The admin provider
  reads returned whole rows — `authToken`, `tokenExpiresAt`, encrypted `accountInfo` — under a
  comment saying "no sensitive config", and the connect response and its audit record carried the
  live Shiprocket JWT and the encrypted password. Every read that answers a request is now
  `ShippingProviderSummary` with `accountInfo` narrowed to `{ email }`; only the provider's own
  auth path may call `findWithCredentials`. `provider-dto.test` holds the projection at type level
  (red on `authToken: true` in the select, and on a mapper that spreads the row) — the test
  shipping ADR-0002 D3 asked for in August.
- **`User` has one writer.** `admin.user.repository` is a read model; its one write became
  `profileRepository.updateAdminFields`. `orgMember.addMember` had no callers and is gone, so
  `org.repository.createWithOwner` is that table's only writer.
- **A cross-site page cannot mutate anything.** `src/middleware.ts` refuses `POST`/`PUT`/`PATCH`/
  `DELETE` to `/api/**` whose `Origin` (or `Referer`) is not ours, computed the way `appUrl()`
  computes it; `Sec-Fetch-Site: same-origin` is accepted; the signed webhooks and `/api/auth` are
  the named exemptions. The predicate is `src/lib/same-origin.ts`, with 27 cases including the
  forwarded-host deploy and lookalike paths; flipping the comparison fails ten of them.
  `src/lib/csrf.ts`, which nothing called and ADR-0048 cited as protection, is deleted (ADR-0060).

## [PR-279] 2026-10-05 — Stock has one writer, and an admin cannot move an order where the table forbids [CONTRACT]

`ProductStock` had five writers across three domains — checkout's reserve, two restocks, bidding's
lock-and-take, and the admin save, which replaced every row from the form and silently overwrote a
reservation taken mid-edit. `server/catalog/stock.repository.ts` is now the only module that
touches the table, through commands that carry their own guard — `reserve`, `release`,
`restockShipment`, `lockAll`/`takeOne`, `adjust`, `setForImport`, `dropEmptyAt` — and checkout and
shipping call them through `stockService` on their own transaction, the way the sale gate is
called. The admin form sends the quantity it saw (`seenQuantity`, hence [CONTRACT]) and `adjust` is
a compare-and-set: stock that moved answers 409 "reload", which `useServerForm` shows. Bulk import
sets absolute quantities and says so.

Orders: `orderRepository.transition` moves a fulfilment status only where the table allows;
`admin.order.repository` is a read model and its unconditional write — any string, no table — is
gone with `bulkUpdateStatus`, which nothing called. The order transaction's direct `tx.*` writes
moved into named repository methods; `server/checkout/reservation.ts` is what it takes from the
catalogue.

`one-repository.test` now reads every file for `prisma.`, `tx.`, `db.` and `client.` model calls:
no write outside a `*.repository.ts`, no write in an `admin.*` file (two catalogue files ratcheted
with their reason — they are the write path misnamed, fixed by the rename the catalog restructuring
carries), and the two-writer list is empty. Red on a planted `prisma.user.update` in an admin file.
Integration: a stale `adjust` is refused and leaves the row unchanged; delivered→processing is
refused; the order, bidding and shipment suites pass unchanged (ADR-0055).

## [PR-278] 2026-10-04 — develop's new code, brought under the new rules

Merging `develop` into the design branch brought in 35 commits written before ADR-0048 and the
Invariant 5 ratchet existed, and the guards caught exactly that code:

- `src/services/admin/productTypeApiClient.ts` re-created the dissolved `src/services/`. It splits
  into `src/components/product-type/productTypeApiClient.ts` (the console) and
  `src/components/product/listingApiClient.ts` (the product form's listing values and families).
- Three new components called `fetch` themselves (`unmapped-value-row`, `where-you-sell`, and from
  the second merge `not-sold-button`); all now go through
  `src/components/channel/channelsApiClient.ts`, the last with `useMutation`.
- `fact-correction.service.ts` read and wrote products directly. Its queries are now
  `admin.product.repository.ts` methods, and the predicate stays in the service so the preview
  and the update still share it.
- The bulk import's new update-by-SKU path joined the repository move: `listLiveSkus` and
  `importBulk` (creates and full-replace updates in one transaction). The wizard's new "updated"
  count is carried through the shared `useBulkImport` hook.

Numbering: this branch's entries were PR-233 to PR-239 while `develop` reached PR-270, so they are
renumbered PR-271 to PR-277. ADR-0048 to ADR-0050 did not collide.

## [PR-277] 2026-10-02 — Every table is reached through a repository

PR-276's ratchet listed nineteen files calling `prisma.<model>` outside a repository. All of them
have moved, and its allowlist is now empty:

- **Identity:** auth config, the NextAuth adapter's account creation, admin re-reads (still on
  every request, ADR-0021), password and verification tokens, signup, and the profile picture
  now go through `profile.repository.ts`. Callers outside identity use the new
  `accountService`; notifications reaches its token rows through it too.
- **Shipping and checkout:** `Shipment` gets its first repository
  (`server/shipping/repositories/shipment.repository.ts`). The tracking route and the Shiprocket
  webhook call a new `trackingService`. The webhook's order write — the worst entry — is now
  `orderService.markDelivered`, so only checkout writes order state.
- **Catalog:** bulk import, stock check, wishlist availability and the media backfill go through
  catalog's repositories. The allocate route's body became
  `server/checkout/parcel-preview.service.ts`, so the route reaches one domain.
- **Analytics:** the dashboard widgets' reads moved to `server/analytics/widgets.repository.ts`.

The NextAuth adapter is still handed the Prisma client, because the library works that way.

Measuring this found the harder half of Invariant 5. Four tables are *written* by more than one
repository: `ProductStock`, `User`, `OrgMember` and `Order`. Most are a storefront repository
beside an `admin.*` one, which "no admin domain" sanctions and Invariant 5 forbids. That
contradiction needs a decision, not a move. `one-repository.test.ts` gains a second ratchet that
records the four and fails a fifth.

Every query moved with its where, select and include unchanged. Verified with the integration
suite against a freshly migrated local database — 103 tests, the seeded-data suite skipped — as
well as the unit suite.

## [PR-276] 2026-10-02 — Invariant 5 gets the guard it never had

"One aggregate, one repository" was a hard block with no test. Measured today: nineteen files
outside a repository call `prisma.<model>` directly — six route handlers among them, and a
shipping webhook writing `prisma.order`. `tests/unit/one-repository.test.ts` is a ratchet over
them: each entry says why it has not moved, a new direct call fails, and a fixed file must leave
the list. Broken once on purpose to confirm it fails. The webhook entry is marked the most urgent.

## [PR-275] 2026-10-02 — The rules say what the tests check, where the code is written

An audit of the rules and skills against the tests found the server's rules stated where code is
written, and the front end's mostly not: several gates (row-shaped buttons, overlay choice, portal
guards, `cn` registration) had no rule anywhere, and were met only when a test went red. Root
`CLAUDE.md` was also 232 lines against its own 200-line limit, four rules stated twice.

- `src/components/CLAUDE.md` and `src/app/api/CLAUDE.md` are new and load lazily. Each rule names
  the test that enforces it, or says it has none.
- Root `CLAUDE.md` is back under 200 lines: duplicates removed, the repository tree replaced by a
  pointer to `docs/README.md`, and an implementation step that names the directory's rules. When
  a rule, skill and ADR disagree, the newest ADR now wins, instead of the skill.
- `/bb-review`:
  - scopes to the PR-sized unit instead of `main...HEAD`;
  - its mobile-first grep no longer uses a lookahead `grep -E` rejects;
  - its image section describes R2, not Blob;
  - it drops a stale note about `Float` money and adds `slug` to the server-owned fields;
  - it gains front-end layering, portal guards, allowlist edits and mutation-testing a new guard.
- `/bb-sdlc`:
  - drops `<domain>/CHANGELOG.md`;
  - names `lint:boundary` and `docs:check`;
  - matches the commit policy;
  - its TRD template gains a per-form-factor UI section and "Gates touched".
- `/bb-brainstorm` no longer assumes Vercel serverless or offers Upstash (ADR-0037, ADR-0038).
- `docs:check` now scans skills (every path a skill names must exist) and the new `CLAUDE.md`
  files, and fails if root `CLAUDE.md` passes 200 lines.
- Small fixes: `ui-primitives.test.ts` cited the wrong ADR, `server/notifications/CLAUDE.md`
  carried a second, older `Verified:` date, and the empty `src/probe-tmp.ts` is deleted.

## [PR-274] 2026-10-02 — The browser calls our API through one door

Fifty-seven inline `fetch` calls — 49 in 42 components, 8 in hooks — each re-implemented "check
`ok`, read the envelope, parse", and API clients lived in three places under two names. Now a
component renders, a hook holds state, and an API client makes the call (ADR-0048):

- `src/lib/api-client.ts` (`apiRequest`) is the one place the browser calls our API; a failure is
  always an `ApiError` with its field details.
- Every request lives in a `<thing>ApiClient.ts` beside its domain under `src/components/`. Clients
  never toast or navigate. `src/services/` is dissolved into those folders.
- Components call clients through `useServerForm`, `useMutation` and `useAsyncData`. `useAsyncData`
  now hands the fetcher an `AbortSignal` and aborts the stale run, which `useDebouncedSearch`
  builds on for the two product pickers.
- `tests/unit/api-clients.test.ts` enforces it with no allowlist: every site was classified first
  and none needed to own its request. Each of its four rules was broken once to confirm it fails.

Defects closed by the move: the cart's stock check parsed an error body as stock rows; both
checkout stock checks did the same and crashed; two search pickers let an older reply overwrite a
newer one, and ignored failures; the media sheet could show one asset's details on another; the
bulk wizards rebuilt their error and dropped its details; `orgService.createOrg` threw on its own
error path; the shipping-provider client checked `!response` instead of `!response.ok`; four
components read the envelope by hand; three hand-rolled forms (`CommercialTerms`, both
`BidLadder` dialogs) dropped field errors and now use `useServerForm` with their existing schemas;
the shipment-tracking schema moved out of its route into `src/lib/validation/schemas/` so its form
can share it.

Review of the conversion found one regression it had made reachable: a payment-order refusal with
field details left checkout on "Processing" with the Pay button disabled. Fixed, with
`tests/unit/checkout-payment-errors.test.ts`, seen to fail without the fix.

## [PR-273] 2026-10-02 — Three form factors, and the tablet gets the image it shows

The breakpoints now have meanings (ADR-0050): phone at base, with `sm:` only refining it;
tablet from `md:`; desktop from `lg:`. Tailwind's defaults, not a custom scale. Scripts read
the same two queries from `FORM_FACTOR_QUERY`, and `useIsDesktop` — which matched at 768px,
the tablet — is now `useIsTabletUp`. `video-player.tsx`'s second copy of that query is gone.

`tests/unit/form-factors.test.ts` requires every hand-written media query to name a declared
breakpoint, and its first run found a real defect. The product gallery's image hint said
half-width from 768px and a third from 1200px; the page is full width until `lg` and half the
72rem column after. A tablet was downloading every gallery image at half the size it showed
it. The hint is now declared once as `GALLERY_SLIDE_SIZES` and shared by the gallery, the
video poster and the YouTube thumbnail, which had copied the same string.

## [PR-272] 2026-10-02 — Colour is a palette the themes pick from

`globals.css` spelled out 52 colour values across 152 declarations, the warm charcoal ink seven
times. They now live once, in a primitive palette (`--emerald-550`, `--charcoal-220`, …) at the
top of the file, and every semantic token in every theme is a `var()` to one of them
(ADR-0049). Every declaration resolves to the value it had before — checked one by one — so
nothing on screen moved. The near-duplicates the repetition was hiding are now visible as
`-soft` twins, left for a deliberate design pass rather than merged here.

`tests/unit/design-tokens.test.ts` guards it: no raw colour outside the palette, no unused
primitive, and no file in `src/` naming one. Each was broken on purpose once to confirm it fails.

## [PR-271] 2026-10-02 — The orders table is handed the row it shows, not the order

`OrdersTable` was typed by `@prisma/client`'s `Order`, so the admin orders page sent every column
of every order to the browser to render seven of them. The boundary test missed it twice: it
looked for the Prisma *client*, never `@prisma/client`, and it exempted type-only imports — an
exemption written for imports between server domains (ADR-0033 D5), where a type really is just
a type.

`adminOrderService.getOrders` now returns `AdminOrderRow` (`server/checkout/admin.order.types.ts`),
and `OrgLocation` moved out of the repository into `server/catalog/org.address.types.ts`, which
three components were importing it from. The component rule in
`tests/unit/module-boundaries.test.ts` now forbids `@prisma/client` and repositories outright,
types included — broken on purpose once to confirm it fails.
## [PR-270] 2026-10-04 — A dev catalogue shaped like the real one

The seed was broken and the dev database could not exercise any of the listing work. Both fixed.

**`db seed` had failed since the media library landed.** Six models point at a `MediaAsset` with
Restrict and none of them was in the teardown, so clearing the database threw on the first org.
An asset also points at the one it was derived from and at its poster, so the self-references are
cleared before the set goes.

**The seeded categories now carry a product type.** The live catalogue's types were assigned by a
migration keyed on its own slugs, which a seeded database does not have — so locally every
category asked nothing and the whole vocabulary looked broken while working in production.

**The catalogue is now shaped like the real one**: ridas with four children — formal, semi-formal,
casual, ohbat — that share one product type. That is the case worth having in dev, because nothing
else shows as plainly that a browsing category is not a question set.

Three products exist to make a surface reachable: a rida answered in plain `nida`, which Flipkart
has no word for, so the worklist is not empty; a half-answered rida, because a catalogue where
everything is complete never shows what incomplete looks like; and a masalla bag, whose type is
decided against, so the "not sold here" list is not empty either.

Every seeded answer is checked against the vocabulary a migration ships —
`tests/integration/seed-vocabulary.test.ts`, mutation-tested four ways. Writing it caught two
values I had invented: `plating: 925-silver` and `shape: rectangle`, where the real keys are
`sterling-silver` and `rectangular`.

**And a test that was eating reference data.** `channel-readiness-service` used the real values
`maroon` and `ochre` as fixtures and deleted them in its teardown, so every full-suite run removed
the platform's own seeded mapping for maroon. The same class of fault as the billed-operations
instrument in PR-257: a suite quietly spending something it did not own. Its fixtures are now
stamped and collide with nothing.

## [PR-269] 2026-10-04 — The channel contracts, recorded [CONTRACT]

Found by running `/bb-review` over the thirteen commits: the TRD said `[CONTRACT]` and that
`CONTRACTS.md` would move in the same PR. It never did, and no entry carried the flag.

Three shapes cross the boundary — a shop's channel choice, a value mapping, a not-sold decision —
and they are now recorded with the reasoning that is easy to lose: the channel set is sent whole
so silence is never read as "off", `theirValue` is free text because it is somebody else's
vocabulary, and both register writes upsert so a repeat is a correction rather than a duplicate.

**And one the TRD promised that does not exist.** It anticipated a readiness DTO per product and
channel. Building it showed a route handler would be a round trip for a read the server already
does, so readiness is computed and rendered server-side and never crosses the wire. Recorded as
an absence with its reason, because a contract document that lists a shape nobody sends is worse
than one that is merely incomplete.

The review also caught a numbering collision — the owner committed PR-266 between two of mine and
I reused the number — and a commit that shipped with no changelog entry at all. Both corrected in
PR-268 above.

## [PR-268] 2026-10-04 — How much of the catalogue each channel would take

The last of the channel registry's delivery list, and the spec moves to Implemented.

**A count per channel above the product list, not a column on it.** The list pages and refetches
on the client, so a per-row verdict would be blank on page two unless it travelled through a
route handler — a round trip for a read the server already does. The number answers the question
a shop has, which is how much is left; the product page already says what.

**The register is read for every product type at once** rather than once per type, so a catalogue
of nine types costs what one does. Budgeted exactly, and watched going from 5 queries to 14 when
the read was moved back inside the loop.

Numbering correction: this entry and the one below it were first written as a second PR-266,
colliding with the entry above. Both are same-day and unpushed; what happened is unchanged.

## [PR-267] 2026-10-04 — Not sold here, on purpose [MIGRATION]

The register could not tell a decision from a blank, so it listed 18 masalla bags as work to do.

Combos sell on this store only — the owner's call on 2026-10-04 — and that was recorded by
writing no mapping. But no mapping is also what *nobody has chosen yet* looks like, so the
worklist named a settled question every time it was opened. A to-do list that keeps telling you
to do something you have already done is a list that stops being read, which costs more than the
one entry it was wrong about.

**A third answer to the same question.** Where does this type go on this channel — their word for
it, the nearest they have, or nowhere. All three sit on the category mapping and obey the same
kind precedence, so a type can be not sold while one kind of it is. A database CHECK keeps a row
from claiming both a category and none; a second table would have been a second copy of
`categoryFor`, which is already tested.

**Listed, not hidden, and reversible from where it is read.** Marked types move into a "Not sold
on X" section beside the nearest-fits, with the button that undoes it on the row itself. Hiding
them would have traded a nagging list for a decision nobody could find again — the worse of the
two problems. Undoing deletes the row rather than blanking it, so the type reads as undecided
again and the choice is genuinely back.

A product whose type is not sold on a channel simply does not appear for that channel in the
readiness panel — the same silence as a channel the shop never enabled, rather than a ready
verdict that reads as an invitation.

The decision itself is now data: one row per publishable channel for `combo`. Four mutations were
watched turning the guards red, including one that only a direct caller of the pure function can
reach — `readinessByChannel` filters those channels out first, so the guard inside it had no test
until the mutation said so.

## [PR-266] 2026-10-04 — Every hero piece on the home page, loaded as you scroll

The home page showed the six newest `HERO` products and silently dropped the rest. It now shows
all of them: nine on first paint (three rows of the phone grid), then the rest through the same
`PaginatedProductGrid` and `/api/products` route every other listing uses, via a new `heroOnly`
filter (`?hero=1`). The section is hidden when there are no heroes. `productsDAL.getHeroProducts`
is gone — nothing called it any more.

## [PR-265] 2026-10-04 — How this would list elsewhere, on the product itself

The readiness panel, on the org's product page. Per channel: the band, where it would be listed,
and every reason it would not go cleanly — in the shop's words rather than the schema's.

**It advises and never gates** (D10). Nothing is disabled and nothing is refused. The panel says
so in as many words: *"if a channel disagrees with us, it is the channel that is right."* We have
never watched a publish succeed, so the gate's idea of required is untested, and the panel is
honest about being a prediction rather than a verdict.

**A shop selling nowhere else sees nothing at all** — not an empty panel, no panel (spec A6).
Channels are off until a shop says otherwise, so this is most shops until they opt in.

A nearest fit reads as what it is, with its note, every time rather than once: *"This is the
nearest they have, not their own word for it. Flipkart has no rida node…"*. An unmapped value says
what it costs to fix and that fixing it once serves every product that shares it, which is the
same sentence the register's worklist is built on.

A read, so a server component does it and no route handler exists for it: a client fetch here
would be a round trip bought for data the server already had ([ADR-0034](adr/0034-render-on-the-server-by-default.md)).

## [PR-264] 2026-10-04 — The register, and a worklist that shortens

The platform owner's screen: what each channel has mapped, and what this catalogue still needs
decided. `/admin/channels`, one page per channel.

**Both worklists are built from what products actually answer, never from the vocabulary.** There
are 186 colours in the list and 35 on Flipkart; mapping the other 151 before anybody sells one is
work with no buyer. A value arrives on the list when a product answers it, carries how many
products share it, and leaves the moment a decision is recorded — which is what makes a long job
finite rather than endless (spec A3, the fourth hazard).

The same row corrects a mapping that already exists. Everything seeded over the last few commits
is a starting point, not a fixture: `setValue` upserts on the natural key, so recording a
different word is a correction rather than a second mapping, and the owner's rows carry
"Decided in the channel register" where the seeded ones name a template and a date.

**One field and one button per row, deliberately.** A single form saving the whole list would
make a long job all-or-nothing, when the point is that it can be done a few at a time.

A second list names product types that sell here and have no category on that channel — which is
how a newly added type surfaces without anybody remembering to check.

Nearest fits are listed apart from both, because they are not work. They are decisions already
taken, shown with the note every affected product keeps displaying (D6, D12).

Audited: a mapping decides where somebody else's listing goes, so recording one writes to the
admin trail ([ADR-0021](adr/0021-audit-trail-never-fails-the-action.md)).

Five mutations of the worklist were each watched turning its guard red — including a mapped
category still reading as unmapped, which the first pass did not catch because the test only ever
asserted the negative. The positive assertion came from the mutation, not the other way round.

## [PR-263] 2026-10-04 — What Google asks for, read rather than remembered [MIGRATION]

Google's and Meta's attribute mappings, from Google's own product data specification fetched on
the day. Reading it rather than recalling it changed the answer, which is the whole point of
[ADR-0046](adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md).

**From memory this would have marked `gender`, `age_group` and `size` required for apparel.** The
specification says they are required only for products targeted to **Brazil, France, Germany,
Japan, the UK and the US**. This shop sells in India, so Google asks for none of the three. A gate
built on recall would have told a seller to answer three questions nobody was asking.

**What it does require, country-independently, is `color` for free listings on every Apparel &
Accessories product.** Six of the eleven nodes this shop maps to sit under that branch — clothing,
pants, socks, scarves, rings and handbags — and five do not: perfume, incense, religious items,
backpacks and toiletry bags. So the same fact is required on some nodes and optional on others,
which is the per-node key from PR-262 earning itself a second time.

**A channel can now say its field takes any text.** Google's colour, material and pattern are free
text; Flipkart's are closed lists of 35, 140 and 56 words. Without somewhere to record that, the
gate reported every colour as having no Google equivalent — on a channel that needs no equivalent.
`freeText` on the attribute mapping says so, and it is a property of the channel's own field, which
is where it sits.

**Meta carries the field names and nothing required.** It accepts Google's RSS namespace so the
names hold, but Meta's own specification has not been read. Marking its fields required would be
claiming knowledge we have not checked, so Meta can warn and will never call a product incomplete
— honest about what has been verified rather than tidy.

Absent on purpose: `condition`, a constant until this store sells anything used; `item_group_id`,
which is the family and is derived; `gender` and `age_group`, which the audience fact answers in
the adapter the day a target country needs them.

A black nida rida now reads warned on Google and Meta and incomplete on Flipkart, where `nida` is
still unmapped — Flipkart spells it "Nida Matte", which is one decision for the owner rather than
a guess for the code.

## [PR-262] 2026-10-04 — What Flipkart calls our facts and our answers [MIGRATION]

Sixty attribute mappings and 474 value mappings, derived from the twelve template workbooks
rather than typed, so a mapping cannot claim Flipkart asks something it does not.

**An attribute mapping is now keyed by their node, not our product type.** Found while seeding,
before a single row existed. Flipkart's `bag` asks Number of Compartments and Waterproof;
`sling-bag` and `hand-messenger-bag` carry neither field — and all three are our `bag`. Keyed by
our type, a sling bag would have been told to answer a question Flipkart never asks, which is the
readiness-that-disagrees-with-the-channel hazard the spec names second. One template file per
node is also how the data arrives, so the table now has the shape its source already had.

`material` is seeded as "Fabric" on cloth nodes and "Material" on the rest — one question, two
names, which is what a per-node key makes expressible.

**Thirty-three mandatory Flipkart fields are deliberately absent**, and the migration lists each.
`Type` (mandatory in eleven nodes) is answered by the product's kind, and `Size` by the stored
measurements — both derived by the adapter, never asked of a shop. `With Hijab`, `Features`, the
five Diamond grades and the kids' age bands are channel extras the shop cannot answer by looking
at the product, so they belong to the adapter's own schema. Neither group is a gap: a fact is
admitted because a shop can answer it, never because a platform asks.

**468 values matched exactly; 366 did not and carry no row.** Our vocabulary is the union of what
Flipkart and Meesho permit, so a colour Meesho has and Flipkart does not is expected. Nothing is
guessed — "Baby Pink" is reported as having no Flipkart word rather than quietly listed as Pink.
Six more were mapped by hand where only the wording differs (their waist rise drops the word
"Rise"), recorded under their own `checkedSource` so a reader can tell which rows a person decided.

Walked end to end against the seeded register: a fully answered rida reads warned on Google and
incomplete on Flipkart, naming its nearest-fit category, one unanswered optional fact, and one
unmapped value — `nida`, which Flipkart spells "Nida Matte". That is one decision serving all 36
ridas, and the worklist is where it belongs.

Google's attribute mappings are **not** seeded. Its taxonomy was fetched and read; its product-data
specification was not, and seeding required fields from memory is the thing ADR-0046 forbids.

## [PR-261] 2026-10-04 — Where each thing is listed on Flipkart, Google and Meta [MIGRATION]

Forty-four category mappings, seeded as a data migration because without them the register is
empty and every product reads as having nowhere to go. The owner's calls, taken 2026-10-04.

Google's node ids come from its published taxonomy, fetched on the day and named in every row's
`checkedSource`. Flipkart's come from the template workbooks downloaded on 2026-10-01. **Meta
carries Google's values as its own rows** rather than sharing them: they are two channels that
agree on categories today and already disagree on values — Google writes `in_stock`, Meta
`in stock` — so separate rows are what let one move without the other, with no code change.

**Two of them stopped being compromises.** Flipkart's `trouser` node has a mandatory `Type` field
whose values include "Palazzos", and its `mat` node's `Type` includes "Prayer" — so a palazzo and
a prayer mat are exact matches, not nearest fits. The category is never the only slot a channel
gives you, and reading the permitted values rather than the field names is what showed it.

**Six are nearest fits, each with a note shown on every product it touches.** A rida has no node
on Flipkart and is listed as an abaya; bakhoor is neither perfume nor incense stick and goes with
incense; Google has no node for Islamic outerwear, so Clothing is its nearest parent.

**The inferred one is marked inferred.** Flipkart has an attar category whose template was never
downloaded, so its slug and required fields are unverified. It is seeded as a nearest fit whose
source reads "Inferred. No template obtained." rather than left out — the product still publishes,
and the note is visible every time until the sheet arrives.

**Combos are deliberately absent.** Gift, prayer and masalla sets sell on this store only. No row
is the truth about that rather than a gap, which is why a test asserts it rather than ignoring it.

A consistency guard checks every row names a product type and a kind that exist, that every
nearest fit carries a note, and that Meta has not drifted from Google. Six mutations of the seed
were each watched turning it red, including a combo appearing and a rida quietly moving.

## [PR-260] 2026-10-04 — Readiness advises; it never gates

Owner's decision, taken before the panel was built and while it still cost a rename. Nothing in
the channel registry refuses a publish, and nothing disables a control.

The reasoning is the spec's own second hazard, read in the direction it was not read the first
time: readiness that disagrees with the channel is worse than none — and it will disagree in
**both** directions until publishing has actually been watched. "Required" here is our reading of
a downloaded template, not something seen to fail. Refusing on it would stop listings that would
have gone through, and the rejection we would need in order to learn better is exactly the one we
prevented. A listing that goes and comes back refused teaches us something; one we never sent
teaches us nothing.

**The band is renamed `blocked` → `incomplete`.** If we never block, `blocked` is a name that
lies, and a lying name is an invitation to wire a refusal in later and call it consistent. The
three bands are kept, because the severity is real advice — "they mark this compulsory" is
different from "this is our nearest guess at a category" — but they now say what we expect the
channel to think, never what we will do about it.

A gate may still be right. The evidence for it will be real rejections, and there are none yet.
Recorded as D10, replacing a draft that refused with a `DomainError`; R7 and A2 move with it.

Costed nothing but a rename because the readiness panel had not been built — the pure function
and the register reads were in, with no caller that could have refused anything.

## [PR-259] 2026-10-04 — Where you sell, on the page that already asks what you sell

A "Where you sell" section on the org's listing screen: one row per channel, a switch, and a
sentence saying what turning it on actually buys. This storefront is not among them — a shop does
not opt into the place it already is.

Without this the registry was inert. Channels are off by default and nothing could turn one on,
so readiness could never appear anywhere, which made the rest of the feature undemonstrable.
That is why it comes before the readiness panel rather than after it.

**Off is a complete answer, and no row is written to say so.** A shop that has never been asked
reads as selling nowhere else rather than as having declined — the difference matters the first
time a channel is added to the set, because silence must not become a decision taken on the
shop's behalf.

**A channel the request does not mention is left alone, never switched off.** The form sends what
it showed; treating silence as "off" would turn off whatever a later release adds the moment a
page loaded before it posted.

Turning one on buys exactly one thing today: this shop starts hearing whether its products are
ready for that channel. No credential is asked for and nothing is sent anywhere.

## [PR-258] 2026-10-04 — The register, read: what a channel says about a product

The reads behind the gate. Two repositories and a service that assembles them into the shape the
pure function already takes, so every judgement stays where it was tested.

**The three maps are one repository**, because a register is a category, its attributes and their
values together and nothing reads one without the others. The shop's own enablement is a second
repository: the maps are the platform's dictionary, shared by every shop, and `OrgChannel` is one
shop's choice. They are written by different people for different reasons.

**The register is read per product type, not per product.** A listing screen asking per row would
read the same dictionary once per row; the type is what the mappings are keyed by, so products
are grouped by it and each group costs the five queries one product would. Asserted as an exact
query count, not a bound — and the count was watched going from 5 to 122 when the read was moved
inside the loop.

**A catch-all category mapping cannot go through `upsert`.** Prisma's compound-unique input will
not take a null, because a unique index does not constrain NULLs — so that one path matches by
hand, with the partial index from PR-255 as the real guard: a concurrent second create fails
there rather than quietly becoming a second answer. Correcting one twice makes one row, which is
checked against Postgres rather than reasoned about.

A mapping naming a fact this codebase no longer declares is ignored rather than cast through, so
a dictionary outliving a renamed fact degrades to silence instead of a wrong attribute.

## [PR-257] 2026-10-04 — The billed-operations budgets were measuring nothing

Found while writing a budget for new code. Every assertion in
`tests/integration/db-ops-budget.test.ts` is an upper bound, and the instrument behind them was
counting zero — so all eight read `expect(0).toBeLessThanOrEqual(n)` and could not fail.

The cause is import order. `PRISMA_LOG_QUERIES` has to be set before the Prisma client is
constructed, because the query event listener is attached at construction. The suite sets it at
the top of the file, but `tests/helpers/test-db.ts` imported the client at module scope, and an
import is evaluated before any statement in the file importing it. Asking whether a database is
disposable was enough to build a client that would never report a query.

The helper now reaches the client through a lazy accessor, and the budget suite's first test
asserts the instrument is live before any budget is checked. An upper bound over a dead
instrument is an assertion that cannot fail, which is worse than no assertion.

The budgets themselves were honest: with real counts, all eight still pass unchanged. What was
missing was the enforcement, not the performance — a query regression at any point in the last
two months would have gone through.

## [PR-256] 2026-10-04 — Whether a product could be listed, answered without asking anyone

The channel registry's gate, as a pure function with no caller yet. It takes the product's stored
facts, the channel's three mappings and what that channel calls required, and answers in the three
bands the TRD names: blocked, warned, ready.

**A nearest-fit category warns rather than blocks.** Blocking it would make this store's largest
line unlistable — a rida is 36 of 94 products and has no exact node on either marketplace. The
point of recording the fit was never to stop the listing; it was to show the shop, every time,
what it will be listed as and why, instead of approving it once and forgetting.

**A value the channel has no word for blocks, and is never guessed.** Google and Meta are the
closest pair in this space and still disagree on values; a tool that guessed would be wrong at
exactly the rate its guesses looked plausible. So an unmapped answer blocks that channel only,
and the worklist is keyed by value rather than by product — one mapping for "maroon" clears every
product that answers maroon, which is what keeps a long job finite rather than endless.

**Every problem is reported, not the first.** A shop fixing one, saving, and only then learning
of the next is the slow loop this phase exists to shorten.

An absent `OrgChannel` row is off, and a shop that has enabled nothing is asked nothing and warned
about nothing. A stored key that is no longer a declared channel is dropped rather than honoured,
so the `instagram` → `meta` rename cannot re-enable something nothing can publish to.

Purity is the point: twelve mutations of the rules were each confirmed to turn the suite red.
`fill-facts` now exports its rule for what counts as blank, because a second spelling of it is how
a fact comes to be answered in one place and missing in the other.

## [PR-255] 2026-10-04 — The channel set, declared, and the four tables under it [MIGRATION]

The channel registry's first piece. No behaviour changes: this is the vocabulary and the storage
the rest of [channel-registry](specs/channel-registry/) is built on.

**The channel set is now the real one.** `instagram` is gone and `meta` replaces it — one feed
serves Facebook and Instagram — and `google` and `meesho` join. Each channel now carries its kind
([ADR-0041](adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)), which is what decides
whether it gets a feed or the full marketplace machinery.

**A channel is declared in code, not stored as a row.** This corrects the spec's D1, which said
the opposite when it was committed yesterday. Reading the code settled it: a channel does nothing
until it has an image rule, a readiness rule and an adapter, all three of them code — so a row an
admin could add would be a row that sits there inert. What a *shop* chooses is data, and that is
`OrgChannel`. The TRD now says so; the entry above, written before, does not.

**One label, not two.** `onboarding-card.tsx` carried its own copy of the channel names beside
the one in the server types. Two spellings of one closed set is the drift Invariant 5 exists for,
and this set is the one every adapter, mapping and readiness answer keys on.

**Four tables:** `OrgChannel`, and the three maps — category, attribute and value — each keyed on
the channel plus what it maps, and each dated with what it was checked against
([ADR-0045](adr/0045-channel-mappings-are-versioned-data.md)).

**A partial unique index closes a hole that would have shipped.** `ChannelCategoryMap.kind` is
nullable, meaning "every kind of this type", and NULLs are distinct to a unique index — so the
declared `@@unique` permitted two of those for one channel and type. That is two answers to which
of their nodes a product publishes to, settled by whichever row the query returned first. Prisma's
schema language cannot say the rule, so the migration does, and a database test mutation-tested
against each of the four constraints is what keeps it honest.

Also fixed, on contact: `enhancement-settings` asserted absolute usage counts against a shared
dev database, so it passed the first run and failed every one after — it read 11 for a month it
had put one run into. It now measures the change it causes.

## [PR-254] 2026-10-04 — The channel registry, specified

What each selling channel is, what it calls the things this shop sells, and whether a product is
ready to go there. It publishes nothing: it is the dictionary and the pre-flight check that
`shopfront-feeds`, `channel-connectors` and `marketplace-publish` all need first, because none of
them would otherwise know what to send.

Most of it records decisions already taken rather than making new ones —
[ADR-0041](adr/0041-a-channel-is-classed-by-where-the-sale-completes.md) for what a channel is,
[ADR-0045](adr/0045-channel-mappings-are-versioned-data.md) for mappings as versioned data. Four
decisions are this spec's own.

**Three mapping tables, not one.** Category, attribute and value are filled at different times
and by different effort, so a shop can publish with categories mapped and values half-done, and
the gate says exactly which values are missing. One table would have made the job all-or-nothing,
which is how a mapping job never finishes.

**Readiness answers in three bands** — blocked, warned, ready — so a half-mapped register still
reports usefully rather than refusing everything.

**A nearest fit is a warning every time, not an approval once.** This store's largest line is the
case: a rida is 36 of 94 products and has no exact match on either marketplace. Shown once and
accepted, the mapping would then apply silently to every later product, including ones it suits
far less.

**The gate never disables a control**, per the owner's standing preference: the publish action
refuses with a message naming what is missing, through the error envelope this project already
has. A disabled button explains nothing.

D12 records what the owner closed today: a nearest fit is the **platform's** decision, shown to
every shop it affects. Choosing that a rida lists as an abaya is a commercial judgement, which
argued for the shop — but one mapping serves every shop selling that type, so a seller's choice
would silently change another's listings. It reopens the first time two shops want different
answers.

## [PR-253] 2026-10-04 — Where a value came from, and correcting it where it came from [MIGRATION]

The last two pieces of [inherited-facts](specs/listing-vocabulary/inherited-facts/). The fill
step has been recording which level answered each fact since PR-227; nothing showed it and
nothing acted on it.

**The form now says so.** A value filled in from the family, the brand or the shop's defaults
carries "from your brand" beneath it, and stays editable — editing makes it the product's own.
Only inherited values get the note: an answer marked as the product's own is the shop's, and
saying where it came from would be saying "from yourself".

**A correction at brand or family level offers to correct what took its answer from there.** The
preview says how many will change *and* how many are left alone, because the second number is
the reassurance — a product somebody deliberately edited keeps its answer. The preview and the
update are one predicate evaluated twice, so a shop cannot confirm one figure and have a
different set change.

**A column was missing and the typechecker could not see it.** `Product` had no `brandId`: a
brand answered what a product left blank at save time and was then forgotten, so a brand-level
correction would have matched nothing and reported zero — working, silent, useless. It survived
review because the `where` clause built it through an object spread, which TypeScript does not
check for unknown keys. Found by reading the schema rather than trusting the build.

`Product.brandId` is `Restrict`: a brand is retired rather than deleted, and a retired brand
still answers for the products that named it.

The correction reaches archived products deliberately, which the ADR-0029 census now records: an
archived product keeps the answer it inherited and can be restored, so skipping it would bring it
back carrying a value its brand has since corrected.

Mutation-tested three ways — ignoring the stored origin, letting the preview and the update
diverge, and marking a corrected answer as the product's own each turn it red. The first attempt
at the divergence mutation was logically equivalent and passed; it was rewritten until it
actually diverged rather than recorded as caught.

## [PR-252] 2026-10-04 — `sizes` and `colors` are gone, and bidding stops naming a variant [MIGRATION]

The two columns this whole phase replaced. They were free text: a colour typed three ways was
three colours to a marketplace. A colour is now chosen from a list and stored by its key, and a
size is derived from stored measurements rather than typed.

Dropped in a **later** migration than the one that replaced them, which is
[variants](specs/listing-vocabulary/variants/) D8 — if the new shape had read something wrong,
the old data was still there to re-read. Nothing had read either column since the product form
and the bulk sheet stopped offering them.

**Bidding was the last reader, and its rule is obsolete rather than broken.** An event named
exactly one item, so a product with options could not be auctioned without saying which. Every
colour is its own product with its own stock now
([ADR-0043](adr/0043-a-variant-is-a-product-in-a-family.md)), so "a product with options" no
longer exists: the guard could never fire and `BiddingEvent.size`/`color` could never be filled.
The step is gone from the form, the fields from the payload, and the columns from the table. The
owner confirmed production holds no bidding events, so nothing recorded is lost.

**Checkout lost a check it could no longer answer.** It refused a cart line naming a size the
product never offered. With no options list there is nothing to check against — the product *is*
the choice. The order line still records which size and colour were bought, and that record
stays: an order is history and never loses what was sold
([ADR-0020](adr/0020-money-bearing-records-never-cascade.md)). Only the validation went.

Worth being plain about what this costs: a cart line's `size` and `colour` are now recorded as
given, unchecked. They are vestigial for anything listed under the new model, and the honest
place to remove them is whenever `order-and-cart-lines` is next opened — not in a migration that
would rewrite order history.

## [PR-251] 2026-10-04 — A sheet row with a known SKU updates the product

The `sku` column's note has said this since PR-249; now it is true. A row whose SKU matches a
**live** product of this org replaces it, and anything else creates one. `planProductRows` says
which is which, so a person sees it before confirming — and the wizard reports both numbers,
because they are not the same event: a wrong create leaves a product to archive, a wrong update
has overwritten something.

Three things an update does deliberately. It **keeps the slug**, which is frozen at creation
because changing one 404s every link to the product. It **replaces the gallery and the stock**
rather than adding to them, the same semantics the admin form's edit has. And it **still refuses
an archived product's SKU**: an archived product holds its code, and an import must never
silently restore one.

That last rule is now the only SKU conflict left, which meant rewriting the all-or-nothing test.
It had doomed its row with a duplicate SKU — a legal update now — so it dooms with an archived
one instead, which is the real remaining case.

Mutation-tested three ways: regenerating a slug on update, adding media instead of replacing it,
and treating a live SKU as a conflict again each turn it red.

## [PR-250] 2026-10-04 — The bulk import reads the vocabulary, and two silent bugs with it

The sheet grew its question columns in PR-249; nothing read them. `bulk-vocabulary.ts` now turns
what a row said into what a product stores, and the import writes `productType`, `kind`, `facts`
and `measurements` alongside everything else. `sizes` and `colors` are gone from the row shape —
the sheet stopped offering them a PR ago.

A **label** becomes a **key**: the dropdowns offer "Maroon" and the product stores `maroon`,
because renaming a colour must not rewrite products. A key typed directly is accepted too, since
a sheet round-tripped through an export carries keys and refusing one would punish whoever did
the tidier thing. An answer matching nothing is kept as flagged free text rather than dropped —
a shop's data is not ours to discard for not fitting a list written afterwards.

A row is only asked what its type asks: an answer for a fact the type never asks is dropped
rather than stored, since it would answer a question this product was never put. The type comes
from the row when it names one — that is what lets one workbook span several — and from the
category otherwise. A row naming a type its category does not resolve to is **refused**: that is
the one case where guessing would publish a product under the wrong marketplace category.

A family named in the sheet is created once and reused by every later row naming it, so four
colours of one abaya arrive as four rows and one family.

**Two silent bugs, both found by tests rather than by the compiler.**

`sheet.ts` lower-cases every header, and fact keys are camelCase — so `sleeveLength` arrived as
`sleevelength` and a direct lookup dropped it. **Every camelCase question would have imported as
blank**: sleeve, pack quantity, scent family, waist rise. Only all-lowercase ones like `colour`
worked. Matching is case-insensitive now.

`categoryRepository.listTree()` returned `(id, parentId, slug)` and nothing else, so
`resolveProductType` walking it found no type on any node — **every bulk-uploaded product would
have been untyped**, which looks exactly like a catalogue nobody has typed yet. The tree carries
`productType` now. Both were mutation-tested after fixing: reintroducing either turns four tests
red.

## [PR-249] 2026-10-04 — The bulk sheet is built from what exists, not from a template

The sample sheet's columns came from a hard-coded list that still read `sizes` and `colors` — the
two the whole phase replaces. They now come from the product types the sheet is generated for,
its dropdowns from the permitted answers in the database, its stock columns from the org's real
locations and its category examples from current slugs.

**Nothing in it is fixed**, which the owner asked for and which matters more than it sounds: a
template written down once goes stale the first time a type or a colour is added, and the drift
is invisible until somebody's upload is rejected for a column that no longer exists. A test gives
the builder a `footwear` type this codebase has never seen and asserts its columns appear.

One workbook spanning several types — Amazon's shape rather than Flipkart's and Meesho's
one-sheet-per-category, so an org listing bags and attar fills one file rather than two.
`?types=a,b` narrows it; omitted, it spans every live type. A `Types` sheet says which columns
belong to which type, and the notes carry each type's own wording — cloth is asked its Fabric.

**A measurement column names its unit, because one measure takes two.** `length` is inches for a
garment and centimetres for a mat, so a single `length` column across both would mean two things
and the person filling it would have no way to tell which. They are separate columns and a row
fills the one its type uses. Checked against the real rows rather than assumed: six types declare
`length`, in two different units.

The sheet also now says that **a row whose SKU matches an existing product updates it** — the
import side of that is the next PR; the column and its note come first so the sheet is not
promising something before it exists.

**A bug found by reading the file rather than the code.** Applying the dropdowns materialises
every row down to 500, so `addRow` appended the two example rows at 501 — below five hundred
blanks, where nobody opening the sheet would ever see them. The examples are written first now.
It compiled, it passed every column test, and it was only visible by generating a workbook and
looking at row 2. `tests/unit/bulk-sheet-build.test.ts` builds one and reads it back, so the
regression is caught; verified by re-introducing the ordering and watching it go red.

## [PR-248] 2026-10-04 — A family can be made, which is what variants was waiting for

`ProductFamily` existed since PR-229 with nothing creating one. The owner's correction is why
this came first: *"my father will list his first variant as soon as this feature lands."*

`productFamilyService` makes a family from a category, which is where its type and its axis come
from — the same walk the product form does, so a family asks what its members will be asked. The
axis is **copied rather than referenced**, so reordering a type's declaration later cannot
silently regroup a shop's products. A family for a category with no type is legitimate and
carries no axis: the siblings still share a description even where nothing has named what makes
them differ.

The picker sits on the product form with **"On its own" as the default**, because that is the
normal case — one abaya in one colour is one product, and nothing asks a shop to declare a family
of one. A new family is made without leaving the form, since the moment one is wanted is the
moment a second colour is being listed.

**"Products" is two numbers now** (variants D6). The stats tile already said "Available" rather
than "Total", which avoided one ambiguity; it now reads "in 20 families" beside it once any
exist. Twenty abayas in five colours is twenty families and a hundred sellable things, and a
figure that does not say which it counts is the ambiguous one.

`POST /api/org/[orgId]/families` is under `/api/org`, not `/api/admin` — a family belongs to a
shop. `productType` and `variantAxis` are absent from its payload deliberately: both are resolved
from the category, so a request cannot group products by a fact their type never asks about.

Nine tests, mutation-tested three ways — referencing the axis instead of copying it, dropping the
org scope, and accepting a blank name each turn it red.

**One of those mutations poisoned the suite**, which is worth recording. The axis test mutated
reference data every other test reads and restored it on the line after the assertion — so when
the assertion failed, the restore never ran and two more tests failed for a reason that had
nothing to do with them. The restore is now in a `finally`, and that was verified by breaking the
assertion on purpose and checking the row came back.

## [PR-247] 2026-10-04 — The product form asks the type's questions

The screen the vocabulary was for. `ProductAttributeFields` — the free-text sizes and colours
boxes — is deleted, and `ProductFactFields` puts the questions this product's type actually asks
in its place. A colour typed three ways was three colours to a marketplace; now it is chosen from
a list.

The type is resolved **in the form the same way the server resolves it**, by walking the category
tree the form already carries for the gallery's slots. So what is asked is what will be stored,
without a second notion of the rules living in the client.

The answers for the category a page renders with are read **by the page**; changing the category
fetches the rest through `GET /api/org/[orgId]/listing-values`. That is a fetch triggered by an
interaction, which is what earns a route handler — the first load costs no round trip
([ADR-0034](adr/0034-render-on-the-server-by-default.md)). `useListingValues` does that one
thing, and tracks which lists it has asked for in a ref rather than state, so the effect never
depends on what it sets.

A category with no product type says so plainly rather than rendering an empty section: the
product saves and sells here, and cannot be published until a type is set. That is the untyped
part of this store's catalogue — masalla bags, beauty and health, kitchen and dining.

**Four gates caught four real things**, which is the part worth recording:

- `portal-boundary` refused the route: I had put an org-scoped read under `/api/admin`, guarded
  by org membership rather than platform admin. Moved to `/api/org/[orgId]/`, where the shop's
  own added answers belong.
- `form-error-display` refused the `kind` select and the fact fields: a field bound without an
  error output makes a form that refuses to submit while saying nothing. All of them now bind.
- `design-tokens` refused a stale `SHAPE_LEGACY` entry for the file I had just deleted.
- `react-hooks/set-state-in-effect` refused the first version of the fetching, which depended on
  the state it set — each fetch would have scheduled the next.

Both of the first two were mutation-tested afterwards: moving the route back under `/api/admin`
and unbinding the `kind` error each turn their gate red.

## [PR-246] 2026-10-04 — One value per concept, one spelling per value [MIGRATION]

The duplicate-values problem recorded on the backlog yesterday, closed. Twenty-one values
retired, none deleted.

**Where it was a judgement, the owner made it**: *"full sleeves is the correct term."* Not the
shorter word or the longer one — the trade's. The other two sleeve pairs follow it, so the list
reads Sleeveless, Full Sleeves, Half Sleeves, Roll-up Sleeves, Three-Quarter Sleeves: five values
where there were eight. `waistRise` goes from six to three, keeping High Rise, Low Rise and Mid
Rise, because an entry in a dropdown has to read on its own. `fit` keeps the `Fit` suffix it
already used for Athletic, Skinny and Slim.

**Where it was not a judgement, a stated convention settled it.** Thirteen more collisions were
one word spelled two ways — Cut-Outs beside Cutouts, Polka Dot beside Polka Dots, Aloe Vera
beside Aloevera. The rule, written down so it can be applied again: the spaced form and the
plural where the thing is naturally countable, except where one word is the established trade
term — Polycotton, Cutwork — which keeps its own spelling.

**Retired, not deleted**, and that is the part that matters. Every discarded form is what some
platform writes, and the mapping layer will need it: our Full Sleeves is Meesho's Long Sleeves.
Retiring hides it from every picker, keeps it readable on anything that stored it, and leaves the
word where [ADR-0045](adr/0045-channel-mappings-are-versioned-data.md)'s mappings can find it.
Deleting would have thrown away the evidence that made the mapping possible.

Checked afterwards rather than assumed: no spelling collision remains in any list, and 1,001
values are offered where 1,026 were.

## [PR-245] 2026-10-03 — One list was holding two questions [MIGRATION]

`listingValueRepository` is the one way to reach the permitted answers
([ADR-0003](adr/0003-one-repository-per-aggregate.md)) — always **by list**, never all of them,
since there are over a thousand rows and a form needs the handful its own type asks about.

Exercising it against the seeded rows found a defect in PR-230's generator. It mapped Flipkart's
`Sling Strap` and Meesho's `Shoulder Strap` onto one `strap` list, on the assumption they were
two platforms' words for one question. They are not: Flipkart asks whether the strap **comes
off** — Detachable or Non-Detachable — and Meesho asks whether it is **padded**. Merged, a seller
was offered four options to one question, two of which answered a different one.

Both are facts a shop can answer by looking at the bag, so both stay — as two facts, which is
what [ADR-0047](adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md)
admits them as. `strapPadding` is now its own fact and its own list, and the bag type asks both.
Nothing stored either, so the migration moves rows rather than answers.

**A second, milder problem is recorded on the backlog rather than fixed**, because the fix is a
judgement. The union of two vocabularies gives one concept two entries wherever the platforms use
different words: `waistRise` holds High and High Rise, Low and Low Rise, Mid and Mid Rise;
`sleeveLength` holds Full Sleeve beside Long Sleeves. That is harmless for colour, where 188
values are genuinely different shades, and poor for a list of six that is really three. The
answer is one canonical value with each platform's word as a mapping — which is what the mapping
layer exists for — but choosing which word is canonical is the owner's call, not something to
decide quietly in a migration.

Worth stating plainly: neither of these was caught by a test or a review. Both came out of
running the repository against the real rows and reading what came back.

## [PR-244] 2026-10-03 — The product payload learns the vocabulary [CONTRACT]

`ProductFormInput` accepts five more fields, all optional: `kind`, `familyId`, `brandId`, `facts`
and `measurements`. Without them the route stripped everything the fill step was wired up to
receive, so PR-243's work could not be reached from a browser.

The answers travel as **bare values** — `{ "colour": "black" }` — never the stored
`{value, origin}` shape. Origin is the server's word for where a value came from, and a request
that could set it could claim a shop typed something it inherited, which is exactly what the
brand-level correction then skips.

**`productType` is absent deliberately**, like `slug` and `thumbnail`. It is resolved from the
category tree on save, so accepting it would let a payload put a product under a type its
category does not use. Both exclusions are tested, and both mutation-tested: adding `productType`
to the schema, and widening the answer map to `z.any()`, each turn a test red.

`PRODUCT_FORM_FIELDS` gains the five names too. A field missing from that list has its
server-side error routed nowhere, so the person sees no message against the input they have to
correct — the failure [ADR-0013](adr/0013-one-error-envelope-and-useserverform.md) exists to
prevent. A test now holds the list and the schema in step.

`docs/CONTRACTS.md` gains a listing-vocabulary section covering the wire shape, the separate
`ProductPersistInput` the repository writes, the category envelopes becoming factories, and the
new admin surface — where `DELETE` retires rather than deletes and answers with the usage counts,
because "it is in use" without a number is not something anybody can act on.

## [PR-243] 2026-10-03 — The fill step gets its caller

`fill-facts.ts` was written pure in PR-227 with nothing calling it. `listing-fill.service.ts` is
now that caller: it resolves the type from the category tree, gathers the levels — the family,
the brand, the org's defaults — and asks the pure step to walk them. The walking stays pure; what
lives here is the reading.

Wired into `createProduct` and `updateProduct`, so a product saved through the service comes back
carrying its resolved type and its answers, each marked with the level that supplied it. Nothing
here refuses a save: a product with facts unanswered still sells on this storefront and is told
what is missing.

**Two shapes that genuinely differ stopped sharing a type.** `ProductFormInput` is what a form
sends; `ProductPersistInput` is what the repository writes — the same fields plus a
`productType` the form never sends and answers carrying their origin. Forcing both through one
type is how a server-owned field comes to look like something a request may set (Invariant 4).
`syncMarkdown` now takes only the four scalars it reads, so it serves either.

**A bug the tests found rather than the compiler**: a family stores its facts the way a product
does, each with the level that supplied it, so reading one *as a level* has to take the value
back out. Passing the stored entry straight through made the inherited answer
`{value: "crepe", origin: "product"}` rather than `crepe`. It typechecked, because both sides are
JSON.

**A second gap the mutation testing found rather than the tests.** Breaking the type scoping —
asking every fact the vocabulary declares rather than the ones this type declares — left all nine
tests green. That is the central claim of the whole feature, untested. Two tests now cover it: an
abaya is never asked about plating, and an answer for a fact its type does not ask is dropped
rather than stored.

Eleven integration tests. Mutation-tested three ways, all caught once the gap was closed.

## [PR-242] 2026-10-03 — This store's catalogue gets its types [MIGRATION]

**The first migration in this programme that writes to the live catalogue.** Everything before it
added columns and reference rows; this one points the twelve existing categories at a product
type and copies the resolved type onto the ninety-four products under them.

The mapping was agreed against the survey of the live catalogue: hand bags to `bag`, the RIDAS
parent to `islamic-wear`, bottom wear to `trousers`, bukhoor and attar to `fragrance`, jewellery
to `jewellery`. Seventy-two of ninety-four products typed.

**Three categories are deliberately left untyped** — masalla bags, beauty and health, kitchen and
dining. Twenty-two products. A masalla bag is a combo and the owner points it there; the other
two have no type that fits and inventing one would be guessing at questions. Their products save
and sell on the storefront and are not publishable to a marketplace, which is what was chosen for
all three.

The four rida categories are not named anywhere in the migration. A recursive CTE expresses the
same walk `resolveProductType` does in code — a category's own type, else the nearest ancestor's
— so formal, semi-formal, casual and ohbat inherit from their parent. Verified against a replica
of the live tree rather than assumed: all four resolved to `islamic-wear`, and the three
intentional nulls stayed null.

Two safety properties, both checked rather than claimed. It is **idempotent** — re-running leaves
every row byte-identical. And every statement is guarded on the column still being NULL, so it
**never overwrites a choice an admin made later**: a product reassigned by hand keeps the hand
assignment when the migration runs again.

It is keyed by slug, so it is a no-op on the dev and CI databases, which carry fixtures rather
than this catalogue.

## [PR-241] 2026-10-03 — Rida, and a masalla bag that is a combo [MIGRATION]

The first change that would have needed a release and does not. Both are rows, written through
the path PR-236 to PR-240 built.

**`rida` is a kind of Islamic wear, not a type of its own.** It is thirty-five of this store's
ninety-four products and its largest line, which argued for a type. The mapping cost settles it:
`(type, kind)` resolves a platform node in either shape, so the number of mapping rows is
identical, and the questions are the same — the owner had already been mapping abaya and burqa
fields onto rida fields. One question set, one more kind.

The four rida categories — formal, semi-formal, casual, ohbat — stay categories. They are not
kinds, because all four hold the same kind and map to the same node. And they need no `style`
fact: neither Flipkart's `abaya-burqa` nor Meesho's `Abayas` asks for one, and the category
already says it. Recording it on the product would store the same fact twice.

**A masalla bag is a combo, not a bag.** A handbag and a prayer mat sold together; mapping it to
a bag node would send a buyer a mat they never read about. Eighteen products, the second largest
line. They stay typeless until the owner points the category at `combo` — the kind exists first
so that is one click rather than a release, which is the whole point of the four PRs before this.

One thing worth stating plainly: `rida` has no exact match on either platform. Flipkart's
`abaya-burqa` permits Abaya, Burqa and Naqab; Meesho has Abayas, Burqa, Niqab, Hijab and Other
Islamic Wear. So this store's largest line will publish under a **nearest-fit** mapping, which is
the case the readiness gate must show rather than resolve silently.

## [PR-240] 2026-10-03 — An admin builds a question set

The screen the whole product-types spec was for. `/admin/product-types` lists the types with what
each one costs to change, and the form creates and edits them: which facts it asks, what it
measures and in which unit, what makes two of its products sell separately, and the kinds it
holds.

**Every fact says which marketplaces demand it**, measured from the templates rather than
asserted — colour by all three, sleeve styling and stitch by Meesho alone, care by nobody. That
is spec R7's "the screen shows what each choice will demand", and it is the difference between
leaving a fact out as a decision and leaving it out as an omission discovered at the first
rejection. It refuses nothing on that basis: a type we would not have built may be a line we
have not met.

**Four coherence rules are enforced at the write**, the same four the integration suite makes of
the rows that shipped. There they catch a bad migration; here they catch a bad admin, which is
the case that starts mattering now the screen exists. A type may not vary on something it never
asks about, rename a fact it does not ask, read a size label from a measurement it does not take,
or ask one fact twice.

`key` is absent from the update envelope entirely. Products and categories store it, so renaming
one would orphan every row that named it — frozen after creation, exactly as a slug is.

Three gates caught things worth catching. Route reachability refused two handlers with no named
caller until the client wrapper existed. The primitives gate refused a raw `<select>` and four
raw inputs — `Checkbox` already carries its own label and 40px target, which is the thing the
hand-rolled version got wrong. And the vocabulary gate had caught "seller" for "org" a commit
earlier.

Twenty tests, mutation-tested three ways: dropping the axis rule, letting the update envelope
default its fields, and allowing a key to be renamed each turn it red.

## [PR-239] 2026-10-03 — Two decisions closed: the colour list, and what the bulk sheet does

**The colour list is the union**, which is what PR-230 already shipped: 188 values with the 31
both platforms spell identically sorted first. It was held open on a concern that turned out to
be overstated twice over.

The concern was that a wide list commits somebody to mapping 154 values onto Flipkart's narrower
vocabulary. But only the colours a shop *actually uses* ever need mapping — tens, not hundreds —
and [ADR-0045](adr/0045-channel-mappings-are-versioned-data.md) decision 3 already has them
decided lazily: an unmapped value fails readiness and the shop is asked to choose at the moment
it first blocks a publish. There was never an upfront session to dread. The narrow list, by
contrast, would leave a colour the shop genuinely sells unrecordable, which is the failure that
cannot be undone later.

That closes the last open question across all five listing-vocabulary specs.

**The bulk sheet creates and updates, keyed by SKU** (owner, 2026-10-03). The existing importer
is create-only, so a catalogue already listed can only be corrected one form at a time — ninety-four
of them here. Update-by-SKU turns that into one upload, and it is nearly free once the sheet
exists.

Its shape follows Amazon rather than Flipkart and Meesho: those publish one sheet per node, so a
seller in twelve categories downloads twelve files. Amazon lets several product types be selected
and returns one workbook. That is the better shape and it is far cheaper here — Amazon's costs 390
columns because it spans everything; ours spans a vocabulary of twenty-eight facts, so three types
is roughly twenty-five columns. Each choice column carries its permitted values as a dropdown read
from `ListingValue`, which stops "Maroon / maroon / Marron" at the source rather than cleaning it
up afterwards.

Recorded on the backlog as `product-form/bulk-sheet` rather than built now; the current importer's
headers still carry `sizes` and `colors`, the two columns this phase replaces, so it is rewritten
rather than extended.

## [PR-238] 2026-10-03 — The category pages hand the form the types that exist

PR-237 turned the schema into a factory and left the two category pages still calling the form
without any types to build it from. The prop defaulted to an empty list, so the resolver would
have refused every product type a shop chose — a silent bug introduced by the previous commit and
caught by reading the call sites rather than by any test.

Both pages now read the options server-side alongside the parents they already read, and
`adminCategoriesDAL.getProductTypeOptions` is `cache`d per request like its neighbours. A server
component reads and a client component receives ([ADR-0034](adr/0034-render-on-the-server-by-default.md)),
and the two reads go out together rather than in sequence.

The prop is **required rather than optional**, which is the part worth keeping. An optional one
with an empty default is how this bug happened: a page that forgets it compiles, renders, and
refuses every choice at submit. Required, the omission is a type error at the call site.
Verified by removing it from one page and watching the compiler object.

## [PR-237] 2026-10-03 — The types are read from the table, and the constants are gone [MIGRATION]

The second product-types PR, and the one where the table becomes authoritative.
`PRODUCT_TYPE_DECLARATIONS` is deleted. `server/catalog/product-type.ts` keeps only what stays
pure — the tree walk, the key parsing and the schema factory — and `product-type.repository.ts`
is now the one way to reach a type ([ADR-0003](adr/0003-one-repository-per-aggregate.md)).

**A second migration, because the first dropped something.** Emitting the nine as rows lost the
per-type relabelling: Flipkart asks cloth its `Fabric` and everything else its `Material`, which
is one question with two labels rather than two facts. `factLabels` carries it, backfilled onto
Islamic wear, trousers and socks. The test now asserts both halves — those three say Fabric, and
bag, prayer mat and jewellery say Material — because the omission was silent the first time.

**The zod schema is a factory**, which is how the runtime-known set keeps ADR-0013's property.
`categoryFormSchemaFor(keys)` is built by the form from the options it was handed and by the
route from `productTypeRepository.keys()`. Same function, same rules, both sides, with the
foreign key as the backstop underneath. A widened set widens what is accepted, which is the test
that proves it is a factory rather than a constant in disguise.

**`sizeLabelFor` now takes the type's row**, so the ring diameter-to-size table is nine rows
rather than a constant and nearest-match is the only code. A test builds a shoe type with a
UK-size scale the codebase has never seen and the derivation follows it — which is what
"configurable" has to mean to be worth the word.

The declaration-integrity checks moved from unit to integration, because they changed meaning.
They used to check constants the compiler already checked; they now check **rows**, which nothing
checks — a type naming a fact that does not exist, varying on something it never asks about,
relabelling a fact it does not ask, or reading a size label from a measurement it does not take.
That is the check on a type an admin creates, which is the case that will matter once the screen
exists. Mutation-tested: an axis on an unasked fact and a label on an unasked fact each turn it
red.

A vocabulary gate caught "never per seller" in a comment — this codebase says org — which is the
kind of thing only a test notices.

## [PR-236] 2026-10-03 — The nine product types become rows [MIGRATION]

The first product-types PR. `ProductType` exists, the nine declarations are carried across
unchanged, and both `Product.productType` and `Category.productType` now reference it. No
behaviour changes: the code still reads the constants, and this PR is what lets the next one stop.

**The foreign key references `key`, not `id`**, which is the decision that makes this free.
Postgres permits a foreign key against any unique column, so every existing row keeps the exact
string it holds and simply gains integrity — no backfill, no id rewrite, no touching the ninety-four
products. Null stays legal, because a foreign key never constrains one, which is what the untyped
categories need: masalla bags, beauty and health, kitchen and dining.

Before this, `Product.productType` was a loose string. The compiler checked it only where a
constant was used, so a typo written through any other path would have been stored and later
published. Now the database refuses it.

The rows are inserted **before** the constraints are added, in the same migration, so a database
where a `productType` had already been set during testing does not fail the moment the key
appears. Idempotent on the unique key.

`labelScale` carries the ring diameter-to-size table, and `labelFrom` which measurements each type
reads a label from — both of which were claimed un-configurable when this was first assessed and
turn out to be data. Only jewellery has a scale, which the test asserts.

Eleven tests against a real schema. Mutation-tested three ways: dropping the foreign key, changing
its `RESTRICT` to `CASCADE`, and corrupting a carried fact list each turn it red. Worth recording
that the `CASCADE` mutation genuinely deleted a type and its product before the restore — a
mutation that lets a delete through does delete, and the fixture had to be rebuilt from the
migration's own insert.

## [PR-235] 2026-10-03 — Product types become something an admin creates

The nine types were written as a TypeScript object, which made adding one a release. The owner's
own frequency estimate inverted the recommendation to leave it that way: for the first hundred
sellers a new product line arrives often enough that a developer in the loop is a bottleneck on
onboarding, which is the main growth activity. Later it becomes rare again, but the expensive
period is now.

[product-types](specs/listing-vocabulary/product-types/) specifies the move. The split is between
the **vocabulary** and the **selection**: a fact carries a way of being answered and a validation
rule, so it stays in code; a type is a list of fact keys, so it becomes a row. Both reference
implementations draw the line in the same place —
[Akeneo](https://help.akeneo.com/v7-build-your-catalog/v7-manage-your-attributes) creates
attributes and families in the UI with only the attribute *types* fixed, and
[Shopify](https://shopify.dev/docs/apps/build/metafields/definitions) ships a standard taxonomy
filled in and lets merchants add definitions with only the *data types* fixed.

The decision that makes this cheap is the foreign key: `ProductType.key` is unique and both
`Product.productType` and `Category.productType` reference it, so every existing row keeps the
exact string it holds and simply gains integrity — no backfill, no id rewrite. That the columns
were `String?` rather than a Postgres enum turns out to be what makes it free, and an enum would
have been exactly wrong, since adding a value needs a migration.

Three costs raised when this was first assessed are resolved rather than accepted. The zod schema
becomes a factory so form and route still build from one function. The form costs two indexed
queries in a render that already reads the category, with value lists fetched only for the lists
that type uses — no cache, which this project deliberately does not have. And the ring-size scale
turns out to be data after all: nearest-match is generic, so a type is fully configurable rather
than half, which was a modelling error on first assessment.

D11 records what the owner closed today: a type belongs to the platform, never to a seller. The
permitted *answers* stay org-scopeable, because a shop knowing a colour the platform does not is
harmless where a shop knowing a different question set would break publishing.

## [PR-234] 2026-10-03 — Checked the vocabulary against the channel that publishes first

The vocabulary was derived from thirty-four Amazon, Flipkart and Meesho templates. The owner asked
whether Google and Meta had been considered, and they had not — which is a real gap in the order
the checking was done, because those are the channels that publish *first*. A feed file at a URL
needs nobody's approval ([ADR-0041](adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)),
while every marketplace needs an account, an approval, or partner status. The vocabulary was
verified against the channels that come last.

Checked now, and it holds. Google demands more of apparel than of any other category and a single
missing attribute is an immediate disapproval: `color`, `size`, `gender`, `age_group`, and
`item_group_id` on every variant. Eight of the ten are already carried.

The interesting result is that **`Ideal For` answers two of Google's questions at once.** The
marketplaces ask one question whose values are Men, Women, Boys, Girls, Baby Boys, Baby Girls,
Kids and Unisex; Google splits that into `gender` and `age_group`. So `age_group` is a mapping of
an answer already held rather than a fact that was missing — one canonical question, two channel
fields, which is exactly what [ADR-0045](adr/0045-channel-mappings-are-versioned-data.md) exists
for. That the marketplace-derived vocabulary happened to cover a channel it was not derived from
is evidence for the answerability test in
[ADR-0047](adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md): a fact
admitted because the shop can answer it tends to serve channels nobody checked.

`size` is required for apparel and is derived rather than stored; `Free Size` is an accepted value
and is what everything this store sells resolves to. `condition` is required only when a product
is not new, so for this store it is a constant in the Google adapter rather than a product fact —
recorded so it becomes one the day anything used is sold.

The ordering lesson is worth more than the finding: the first channel to publish is the one to
verify against first, and it was checked last because it was the least documented in templates.

## [PR-233] 2026-10-03 — A category with no product type says what that costs

The product-type field on the category form was optional with a neutral hint, which made it a
blank somebody skips rather than a decision somebody takes. Leaving it empty is legitimate —
three of this store's twelve categories have no type that fits, and a wrong type is worse than
none because it asks the seller the wrong questions — but the consequence was invisible.

The hint now states it while the field is empty: products here save and sell on the storefront,
and cannot be published to a marketplace. It returns to the short wording once a type is chosen,
so the warning is not permanent furniture.

Still optional rather than required, deliberately. Forcing a choice on a mixed category — one
holding a mat, a Quran cover and a tasbih — would make somebody guess, and the guess would be
stored.

## [PR-232] 2026-10-02 — A read-only survey, because the dev database is not evidence

The listing-vocabulary migration was being designed against the dev database, and the owner
pointed out it is not evidence: it was seeded from the old product form, so it shows what the
seed invented rather than what the shop typed.

`scripts/survey-catalogue.sql` asks the live catalogue seven questions instead, `SELECT` only —
it writes nothing, locks nothing and prints no credential. How much there is; the category tree
and what hangs off each node; what `sizes` and `colors` actually hold per category; how many
stored colours the new vocabulary already knows the word for; how many products a colour-axis
migration would produce; how many vary on both axes at once; and what `ProductStock` holds.

That last one is the part no migration can derive. One stock number covers every colour today, so
splitting twelve units of an abaya across black and maroon is a decision somebody makes, not a
sum. Any plan that quietly divides or duplicates it would be inventing inventory.

The shape of the problem is already visible in the seeded data even if the numbers are not
trustworthy: `sizes` carries four different kinds of thing — garment letters, a capacity in
millilitres, a physical dimension like `110x70cm`, and free-size words — so one migration rule
cannot read it. A capacity belongs in `measurements`, a dimension becomes two measurements, and
only the letters were ever a size. The TRD's D7 assumed one rule and will be rewritten once the
survey comes back.

## [PR-231] 2026-10-02 — An admin says which product type a category uses

The question was whether adding categories stays something the admin can do. It already was:
`src/app/(admin)/admin/categories/` has create, edit, delete, a bulk importer and a tree with
cycle checks, all audited, and `Category.shotList` is already a per-category setting an admin
edits. So no new module and no new spec — `productType` is the same shape as `shotList` and
joins the same form.

One select on the category form, defaulting to "Inherit from parent". `productTypeSchema` lives
beside the declarations so the enum has one spelling; the form's resolver and the route's parser
are the same schema, so what a shop is shown inline is what the server enforces
([ADR-0013](adr/0013-one-error-envelope-and-useserverform.md)).

Twelve tests, three of them on the symmetry Invariant 4 asks for: create and update accept the
same types and refuse the same rubbish, and `slug` is still refused on both. The update envelope
stays `.optional()` rather than `.default()` — in zod v4 a default fires inside a PATCH and
rewrites what the caller never mentioned, which is the bug the schema's own comment already
warned about for `description` and `parentId`. Mutation-tested: widening the type to any string
turns three tests red, and giving the update envelope a default turns the PATCH one red.

## [PR-230] 2026-10-02 — The permitted answers, read off the templates [MIGRATION]

1,026 `ListingValue` rows across twenty-two lists, generated from the platforms' own bulk-upload
templates rather than typed: 188 colours, 195 materials, 145 patterns, 125 scent families, and
the smaller lists for sleeve, stitch, fit, plating, purity, gemstone and the rest.

A data migration rather than the seed, which is the project's own rule for reference data
(Invariant 7): `prisma/seed.ts` is permanently dev-only and deletes every table, while
`vercel.json` runs `prisma migrate deploy` before every build — so a migration reaches every
environment on merge and the seed reaches none. The test is whether production breaks without it,
and without these a product form has empty dropdowns.

**The union, not the intersection**, which settles the TRD's open question in the direction
already recommended. The platforms do not disagree about what to call a colour — 31 of the 35
Flipkart publishes appear on Meesho spelled identically — they disagree about how many exist, 35
against 185. The narrower list would mean a colour the shop genuinely sells could not be recorded
at all, and the mapping work is the same either way. Values both platforms name sort first, so
the common ones sit at the top of a list and the long tail is below them.

Idempotent on the partial unique index from PR-228, so replaying it is a no-op rather than a
duplicate-key failure — checked by running it twice.

`baseMaterial` is its own fact with its own list, so "base metal" was removed from the sources
feeding `material`; without that the material list carried the jewellery metals as well.

## [PR-229] 2026-10-02 — ProductFamily, which cannot be sold [MIGRATION]

The fifth listing-vocabulary PR. `ProductFamily` is a new aggregate with its own repository
([ADR-0003](adr/0003-one-repository-per-aggregate.md)), carrying what a set of separately-selling
products share — the description, the facts, the measurements — and `Product` gains a nullable
`familyId`. Nullable because one abaya in one colour is one product and nothing asks a shop to
declare a family of one, and because requiring it would refuse every row that exists.

No behaviour changes yet: nothing creates a family, and every existing product keeps a null
`familyId`.

**The family holds no price, no stock and no `ProductStock` relation**, and that is enforced by
the columns not existing rather than by a check — the only way it cannot be forgotten. If a
family kept a stock number at all, something would eventually sell it and the four real counts
would not move. `tests/integration/product-family.test.ts` asserts the absence against
`information_schema`, because a later migration adding such a column is exactly how the leak
would reopen silently. Adding a `stock` column turns it red, which was checked.

`Product.familyId` is `Restrict`, not `Cascade`: a family carries no money but its members do
([ADR-0020](adr/0020-money-bearing-records-never-cascade.md)). Deleting a family with members is
refused and the real operation is retirement
([ADR-0032](adr/0032-records-people-authored-are-retired-not-deleted.md)), which leaves every
member reading exactly as before. Switching the constraint to `Cascade` turns that test red too.

The repository scopes every read and write by `orgId`, writes through `updateMany` so the scope
is part of the write rather than a read-then-write two requests can interleave, and whitelists
field by field so create and update stay symmetric (Invariant 4). It gains the two counts
variants D6 requires — families and sellable things are different numbers, and a screen saying
"Products" has to say which it means.

It also joins the ADR-0029 census in `tests/unit/product-visibility.test.ts`, which caught the
new file reading products and required it classified. The sellable count spreads `AVAILABLE`
rather than respelling `archivedAt: null`; `memberCount` deliberately counts archived members,
because it previews which products a family-level correction would change and an archived product
can be restored.

## [PR-228] 2026-10-02 — The listing vocabulary's schema [MIGRATION]

`Category` gains a nullable `productType`, inherited down the tree like `shotList`. `Product`
gains `productType` and `kind` as columns and `facts` and `measurements` as JSON, each entry
holding its value and the level that supplied it. `ListingValue` holds the permitted answers.
Every column is nullable and the migration is purely additive; no existing row changes.

**Only the discriminators earn columns, and that is a decision reading the code changed.** The
TRD said what is filtered, sorted or searched on earns a column, and named colour among them.
Nothing filters on `colors` or `sizes` — they are selected and written and appear in no `where`
clause anywhere in `server/` or `src/`. So colour, material and pattern are answers like any
other, in JSON with their origin. `productType` is a column because it says how to read the rest
of the row, and `kind` because the channel mapping will resolve a platform node from the pair. A
column added for a filter nobody has written is a second place for a value to live.

**The unique index Prisma generated had a hole.** `@@unique([list, key, orgId])` does not
constrain rows whose `orgId` is NULL, because Postgres treats NULLs as distinct — so two
platform-provided answers could share a list and a key, which is the drift a single global list
exists to prevent. The migration adds a partial unique index over `(list, key) WHERE orgId IS
NULL`, which Prisma's schema language cannot declare, so nothing in `schema.prisma` shows it.
`tests/integration/listing-value-uniqueness.test.ts` is what keeps it honest: dropping the index
turns that test red, which was checked rather than assumed.

A value is retired rather than deleted, because products already store its key and a deleted
answer would leave them reading as unlisted text
([ADR-0032](adr/0032-records-people-authored-are-retired-not-deleted.md)). A shop's own answer
carries its `orgId` and cascades with the org, so one shop's vocabulary cannot widen another's.

Generated against a throwaway database created and dropped for the purpose; the local dev
database was left alone, being twelve migrations behind and holding whatever it holds.

## [PR-227] 2026-10-02 — The fill step, as an ordered list of levels

The third listing-vocabulary PR, and the last pure one. `server/catalog/fill-facts.ts` fills a
fact the shop left blank from the family, then the brand, then the shop's defaults, and records
which level answered.

Precedence lives in the order of a list rather than inside branching code, so adding a level is
inserting an entry rather than editing every fact's fallback — and so that *which level answered*
survives, which is what the brand-level correction acts on. It is generic over its key type, so
one implementation serves both the columns and the type-specific tail.

Three behaviours worth naming. **Blank is not an answer**: an empty or whitespace string is a
field somebody cleared, so the step keeps looking rather than inheriting it; `NaN` is likewise a
blank number input rather than a number. A meaningful zero and a `false` are answers and are kept.
**An answer on the product always records as the product's**, which is what later leaves it alone
when a brand is corrected. And **editing clears the mark even where the new value equals the
inherited one**, because the choice was still deliberate and leaving the mark would let the next
correction silently revert it.

`takeOwnership` takes its edited keys as `NoInfer`, so the key set comes from the stored answers
rather than from whichever handful was edited — without it, editing one field narrowed the
returned type to that one field.

Twenty-two tests. Mutation-tested four ways: reordering the levels, counting a blank as an
answer, not clearing the mark on an edit, and recording the product's own answer as inherited
each go red.

## [PR-226] 2026-10-02 — A size label is worked out, never stored

The second listing-vocabulary PR. Still pure, still no schema and no caller.

`server/catalog/size-label.ts` works a size label out from a product's measurements. For
everything this store sells the answer is `Free`, which is a permitted value on every category it
sells into, and the measurements it came from travel with it so a screen can show its reasoning.
Jewellery is the exception: a ring's inner diameter maps to a real scale, nearest step wins, and
beyond either end it clamps rather than inventing a size.

It is derived and not stored, which is the decision worth stating. A label held in a column
alongside the measurements it came from is two facts that can disagree, and the stale one wins,
because whatever reads the column never learns a fresher answer existed. Measurements are stored
because a measurement derives a label and a label derives no measurement.

Also here: the measurements a type requires and a product has not given, which is what readiness
will report. It reports rather than refuses — nothing in this feature blocks saving.

Eighteen tests. Mutation-tested three ways: returning a constant label, taking the first ring
step rather than the nearest, and never reporting a missing measurement each go red.

## [PR-225] 2026-10-02 — The listing vocabulary's declarations

The first of the listing-vocabulary PRs. Pure declarations and one pure function, no schema
change, no caller yet — so nothing in the product's behaviour moves.

`server/catalog/listing-facts.ts` declares the facts a product type may ask beyond the spine,
each with how it is answered and which value list it draws on, plus the measurements and their
units. A fact is in it because the shop can answer it from the product without knowing which
platform is asking, which is the only admission test
([ADR-0047](adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md)).
Flipkart's procurement terms and Meesho's returns price fail that test and are absent.

`server/catalog/product-type.ts` declares the nine types, the kinds each holds, the facts it
asks, its measurements and the axis its members vary on. `resolveProductType` walks the category
tree for the nearest ancestor that declares one, mirroring `resolveShotList` — same tree, same
walk, same `seen` set, because a self-referencing tree can hold a cycle.

Three details the templates decided rather than we did. The variant axis can be a measurement
rather than a fact, because the same attar in 6 ml and 100 ml is two sellable things and no fact
expresses that. `Material` and `Fabric` are one question with a per-type label, because that is
all Flipkart's two words are. And a stored answer carries the level that supplied it in the same
entry, so origin costs no second column.

Twenty-eight tests, of which eight are the declaration-integrity checks: a type may not ask for a
fact that does not exist, may not vary on something it never asks about, may not relabel a fact
it does not ask, and a choice fact must point at a list that exists. Mutation-tested — varying on
an unasked fact and dropping a required mat dimension each go red, and removing the cycle guard
hangs the suite until it is killed, which is the guard's point.

`docs/ARCHITECTURE.md` gains the new test file in its count, and loses its claim that there is no
background job runner, which the worker made false three PRs ago and nothing noticed.

## [PR-224] 2026-10-02 — A product type is not a browsing category

Reading the schema before implementing found the vocabulary spec conflating two things. It said a
product "sits in one of nine categories", and `Category` already exists as the buyer's
merchandising tree — hero image, accent, ordering, arbitrary depth, reorganised whenever
merchandising wants. Had that been built as written, moving an abaya under a seasonal heading
would have changed the questions asked of it.

They are separate concerns and the codebase already separates them correctly once:
`Category.shotList` declares the photo slots its products fill, inherited down the tree from the
nearest ancestor that sets one (`server/catalog/shot-list.ts`). The product type now attaches the
same way. A category says which type its products use, a category that says nothing inherits, and
the tree stays free to be reorganised.

The resolved type is stored on the product on save rather than read through the category, so a
product read stays one row and merchandising cannot move a product's stored answers. Re-pointing
a category at a different type becomes an explicit migration of its products, with a count and a
confirmation, reusing the correction mechanism the inherited facts already need.

Named `productType` because that is what Amazon names it, and it is the same concept: the thing
that decides which attributes apply. Flipkart calls it a vertical, Meesho a category. Naming ours
after the dominant published vocabulary costs nothing and makes every adapter's mapping read as a
mapping ([ADR-0046](adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md)).

Caught by reading the schema rather than by review, which is the order ADR-0046 asks for and the
reason the first implementation PR has not been written yet.

## [PR-223] 2026-10-02 — The listing vocabulary, specified as three features

Drafting it produced 156 readable lines against a 100-line cap, which
[ADR-0010](adr/0010-spec-convention.md) treats as the signal that a feature is more than one
feature. It was three: what a category asks, what makes two things sell separately, and what gets
filled in from elsewhere. Each is independently demoable and each carries its own hazards.

The field set is read off thirty-four platform templates rather than from our own product model,
which was written without market knowledge and would otherwise have been the thing the new model
was shaped to fit.

What the templates changed, against the draft that preceded them. The variant axis is declared per
category rather than assumed to be size, because Flipkart declares axes per node and no two of its
twelve agree. Measurements are stored and size labels derived, because twelve of Meesho's nineteen
nodes require a measurement and none requires a label without one. A kind — abaya, burqa, niqab —
is a fact on the product rather than a category, because Flipkart holds the three as one node with
a field while Meesho holds three categories, and only a stored fact serves both. A combo is an
ordinary product with its own stock, because the shop counts it that way.

Two questions closed during review, both by the owner reading the draft. Whether a member needs
its own description: it does, and the family holds it as the answer to fill from so it is typed
once. Whether the fill step needs cycle protection: it does not, the levels being a fixed list of
three, and the guard was removed as the over-engineering it was.

One question stays open and needs the owner: how rich the colour list should be. Implementation
proceeds on the recommendation — the union, 31 of whose values Flipkart and Meesho already spell
identically — because the choice seeds data rather than shaping the model, and seeded data is
cheap to revisit.

## [PR-222] 2026-10-02 — Correction: the reader was dropping empty cells, and two figures were inflated

The stdlib xlsx reader appended cells in document order without reading each cell's own column
reference. A spreadsheet omits empty cells from a sparse row, so every value after a gap shifted
left. Dense sheets were unaffected, which is why the Amazon extract re-reads byte-identical and its
18 required of 390 stands. Sparse sheets were silently wrong.

Meesho's `Validation Sheet` is sparse, which is why it looked like noise and was reported as
Meesho publishing no value lists. It publishes all of them, and they are the richest source in the
set: 185 distinct colours against Flipkart's 35, plus fabric, pattern, sleeve, stitch, size and the
measurement ranges, per category. `listing-node-templates/extracted/meesho.json` now carries them.

Two figures in [PR-220] and [PR-221] were inflated by a second fault in the same extraction: two
template files for one node — Socks and Deodorant—Fragrances each ship twice — had their field
lists concatenated rather than replaced. **Meesho requires 23 to 40 compulsory fields per node,
not 23 to 56**, and **twelve of nineteen nodes require a measurement, not thirteen**. Both
corrections leave the conclusions standing: Meesho is still the binding constraint against
Amazon's 18, measurements are still required twice as often as labels, and **no node requires a
size label without also requiring measurements**, which is what
[ADR-0047](adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md) decision 4
rests on.

The colour question this settles: for an abaya, sixteen of Flipkart's seventeen colours appear on
Meesho spelled identically. Across all nodes, thirty-one values are common and spelled the same.
The platforms do not disagree about what to call a colour; they disagree about how many colours
exist. That makes an unmapped value a question of granularity rather than of vocabulary, and it is
answered once per value rather than per product.

An extraction bug is invisible in a way a code bug is not — nothing fails, the mapping is simply
built on a wrong list. The reader now places each cell by its own reference, and the rule that
follows is that a sheet which looks like noise is a reading to check before it is a finding to
report.

## [PR-221] 2026-10-01 — What the platform templates actually ask for, measured

[INTEGRATIONS.md](INTEGRATIONS.md) carried an estimate of the cross-platform core written on
2026-09-29 from the published specifications, before any template had been read. It named colour
and size as part of the shared core and closed with the per-category value lists being "a
dependency on access, not a gap in research".

The access arrived and the estimate was wrong on both counts, so the section is replaced with what
thirty-four templates measure rather than what the specifications implied. Colour and size are not
in the three-platform core. The core is thirteen fields and it is barely descriptive — the seller's
own code, description, maximum retail price, stock, brand, images, tax code, country of origin,
manufacturer, packer, importer, net weight and a variant key — of which nine are stated once by
the shop rather than per product.

Also now recorded there, each of which bears on a design decision rather than being trivia:

Required counts, not field counts, are the constraint, and Meesho is the binding one at 23 to 56
compulsory per category against Amazon's 18 of 390. Flipkart encodes requirement level as a cell
colour decoded from each workbook's own legend. A platform's category sometimes holds what another
keeps in a field, so the mapping is many-to-many and must be allowed to resolve to nothing. Variant
axes are declared per node and no two of Flipkart's twelve agree. And sizes are asked for as
measurements more often than as labels — thirteen of Meesho's nineteen nodes require a measurement
and none requires a label without one.

The "field name agreeing is not its values agreeing" finding survives and is strengthened: it holds
inside a single platform, where Flipkart's own colour list differs per node and its `Size` is three
incompatible scales under one label.

Dated and sourced, because the previous version of this section was neither, and a confident
estimate in a reference doc is worse than an absent one.

## [PR-220] 2026-10-01 — A canonical fact is admitted by answerability, not by agreement

[ADR-0042](adr/0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md)
set the right criterion and then added a clause that said something narrower: that "Amazon
requires it" is never a reason for a canonical field. Read strictly, that excludes a fact only one
platform asks for even when the shop can answer it without being told who is asking.

The templates made the cost concrete. Meesho's `Abayas` node requires `Bust Size` and
`Length Size`; Flipkart's `abaya-burqa` asks for neither. A shop measuring an abaya can answer
both. Under the intersection they are one platform's demand and would have been left out of the
vocabulary, and the first abaya published to Meesho would have been rejected.

The asymmetry behind it was named by the owner: sending a fact a platform ignores costs nothing,
and omitting one a platform requires stops the listing. Two errors of different sizes do not want
a criterion balanced between them.

[ADR-0047](adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md) therefore
keeps ADR-0042's answerability test as the only admission test — can the shop answer it from the
product, without knowing which platform it is for — and drops the requirement that more than one
platform ask. One is enough and none is enough. ADR-0042's decisions 2 to 5 stand: a fact the
shop cannot answer is still a channel extra declared by its adapter as a schema, never a bag.

It also records two things the templates settled. **Store the fact that derives the other**: a
measurement derives a size label and a label derives no measurement, so a garment's length and
bust are stored and `Free` is computed. Thirteen of Meesho's nineteen nodes require a
measurement, six require none, and none requires a size label without also requiring
measurements — so the deriving fact is also the one asked for more often. And **the burden is on
the extra**: the listing form is one form, because a per-platform section on it means the seller
fills three, which is the cost this phase exists to remove.

ADR-0042 is immutable, so its decision 1 is not edited. Its Status line and a note above its
Alternatives point at the refinement, and the two are read together.

Also added: Meesho's `Trousers---Pants` node, which confirms Meesho asks for no size label on
trousers either — only `Length`. The Meesho core holds at 32 fields across all nineteen nodes.

## [PR-219] 2026-10-01 — Correction: Flipkart names the size scale as a field of its own

The extract committed in PR-218 read Flipkart's `Brand Size` wrongly for two nodes. In `trouser`
and `salwar` that column is not a list — it is a three-column lookup of Ideal For, then a
Qualifier, then the allowed value, and the extraction kept only the first column. So the data
said the permitted sizes were "Baby Boys, Baby Boys, Baby Girls…" repeated, and said those two
nodes had no free size.

Both claims were wrong. `Free` is permitted for women's trousers and salwars, under the `Regular`
qualifier, which matters because this store sells free size throughout.

The Qualifier is the more interesting half. Flipkart names the *scale* explicitly — Regular
letters, Number, Euro, UK, US, or Kids age bands — and the allowed values depend on it and on
Ideal For together. That is the same conclusion the vocabulary reached from the other direction,
reading three incompatible size lists under one label and deciding a category must declare its
scale. One platform already does exactly that, so the design is matching an established shape
rather than inventing one.

Also recorded from the same pass, since they bear on the category mapping: Flipkart's `mat` node
carries `Type = Prayer`, so a prayer mat is that node rather than a category of its own.
`Tote` appears in the Type list of both `hand-messenger-bag` and `sling-bag`, so one of our kinds
can have two candidate nodes and the mapping has to choose. And a standalone hijab has no
Flipkart node in this set — `abaya-burqa` permits only Abaya, Burqa and Naqab — so a mapping must
be able to say a product has nowhere to go on a platform without that being an error.

The extract is data derived from someone else's files, so a reading error in it is silent in a
way a code bug is not: nothing fails, the mapping is just built on a wrong list. Worth stating
plainly that the remaining 31 files were extracted by the same code and only these two were
checked by hand against the source.

## [PR-218] 2026-10-01 — The platform templates, and what thirty-three of them agree on

The vocabulary was being designed against two sheets and our own product model. Thirty-three real
bulk-upload templates now sit behind it: Amazon's single workbook covering ten product types,
twelve Flipkart verticals, and eighteen Meesho categories — every node this store actually sells
into.

The binaries are not committed. Nineteen megabytes of another company's undiffable spreadsheets,
on an account that is not ours to publish them from, and git never forgets a blob. What is
committed is `listing-node-templates/extracted/`: field names, requirement levels, variant axes
and permitted value lists, one JSON per platform, which a diff can actually show. The manifest
carries a checksum and a date per file so the extract can be traced to its source.

Flipkart marks a field's requirement level as a cell colour rather than a value, decoded against
the legend each workbook carries on its summary sheet: blue mandatory, purple conditional, yellow
recommended, green optional, grey filled by Flipkart.

What the extract shows, which the two sheets did not:

Amazon declares 390 fields and requires 18 of them, 187 being conditional on other answers.
Flipkart requires 19 to 32 per node out of 66 to 132. Meesho is the strict one, at 23 to 56
compulsory per node — so the binding constraint on a listing form is Meesho, not Amazon.

The three platforms agree, in every node, on thirteen fields, and they are almost all identity,
money, stock and statutory compliance rather than description. The descriptive tail that two
platforms agree on is one to six fields per category, and across all eight of this store's
product groups it is the same handful: colour, pattern, material or fabric, size, net quantity,
occasion.

A field name agreeing is still not its values agreeing, and the templates show this inside a
single platform. Flipkart's own colour list differs per node — sixteen values in all eleven that
have one, nineteen more in only some. Its size list is three incompatible scales under one label:
thirty-seven mixed age bands and letters for an abaya, five words for a mat, forty-five numbers
for a ring. `Fabric` and `Material` are the same question asked of cloth and of everything else.

[ADR-0043](adr/0043-a-variant-is-a-product-in-a-family.md) said a variant is a product in a
family and left the axis open. The templates close it in the direction of per-category: Flipkart
declares the axes per node and no two of the twelve agree — size for an abaya, capacity and
colour for a bag, plating and size and colour for a ring, set and quantity for incense. The axis
cannot be assumed, which is why the category declares it.

