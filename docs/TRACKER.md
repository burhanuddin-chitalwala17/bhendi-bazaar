# Tracker

- **Created:** 2026-10-07
- **Updated:** 2026-10-09
- **Source:** Platform audit (full sweep of buyer, seller, admin surfaces)

Status key: `[ ]` open, `[~]` in progress, `[x]` done, `[-]` on hold / parked / merged

---

## Bugs

### B-001: Toast notifications have no close button

- **Severity:** Low
- **Surface:** Buyer (all pages)
- **Steps to recreate:**
  1. Trigger any action that shows a toast (add to cart, submit a review, etc.)
  2. Observe the toast in the top-right corner
  3. Try to dismiss it — there is no X button
- **Expected:** A visible close button on every toast
- **Actual:** Toasts auto-dismiss or are dismissed by clicking the body; no close button rendered
- **Root cause:** `closeButton` prop is not set on `<Toaster>` in `src/app/providers.tsx`
- **Fix:** Add `closeButton` to the Toaster component
- **Status:** `[x]` — fixed by owner before this session



### B-002: Checkout button disabled when cart is empty (violates ADR-0053)

- **Severity:** Medium
- **Surface:** Buyer — `/cart`
- **Steps to recreate:**
  1. Go to `/cart` with an empty cart
  2. The "Proceed to checkout" button is greyed out / disabled
- **Expected:** Button stays enabled; clicking it explains why checkout can't proceed
- **Actual:** Button is disabled, violating "never disable a button, never gate on a guess"
- **Root cause:** `disabled={!hasItems}` on the checkout button
- **Fix:** Remove `disabled`, show an inline message on click instead
- **Status:** `[x]` — button enabled, inline error + pulse effect on empty cart click



### B-003: Location delete button disabled instead of explaining (violates ADR-0053)

- **Severity:** Medium
- **Surface:** Seller — `/org/[orgId]/locations`
- **Steps to recreate:**
  1. Go to Locations in the org portal
  2. Try to delete a location that holds stock or has shipped parcels
  3. The delete button is disabled with a title tooltip
- **Expected:** Button stays enabled; clicking it shows a message ("move or zero stock first" / "deactivate instead")
- **Actual:** Disabled button with tooltip — user may not discover the tooltip
- **Fix:** Keep button enabled, show message on click
- **Status:** `[x]` — button enabled, server DomainError toasts via sonner



### B-004: Console.log debug statements in cartStore.ts

- **Severity:** Low
- **Surface:** Buyer — all pages where cart is used
- **Steps to recreate:**
  1. Open browser dev tools console
  2. Add/remove items from cart
  3. Debug logs appear in console
- **Expected:** No debug output in production
- **Actual:** Lines 121-134 of `cartStore.ts` have `console.log` statements
- **Fix:** Remove the debug logs
- **Status:** `[x]` — removed active console.log + setTimeout wrapper; kept console.warn for corrupted items



### B-005: Dead CartService interface in src/domain/cart.ts

- **Severity:** Low
- **Surface:** Codebase
- **Steps to recreate:**
  1. Grep for `CartService` — it is defined but never imported or used
- **Expected:** No dead code
- **Actual:** Unreachable interface
- **Fix:** Delete the file or the dead interface
- **Status:** `[x]` — interface deleted



### B-006: Product.weight has a stale task comment in schema

- **Severity:** Low
- **Surface:** Codebase — `prisma/schema.prisma`
- **Steps to recreate:**
  1. Open `prisma/schema.prisma`
  2. Find `Product.weight` — it has a `// ADD THIS:` comment
- **Expected:** Clean schema with no task artifacts
- **Actual:** Leftover comment from development
- **Fix:** Remove the comment
- **Status:** `[x]` — removed ADD THIS comments and Prisma marketing boilerplate



### B-007: Admin org delete route may violate ADR-0020 and ADR-0032

- **Severity:** High
- **Surface:** Admin — `/admin/orgs`
- **Steps to recreate:**
  1. Go to Admin > Organizations
  2. Click delete on an org
  3. A browser `confirm()` dialog appears (not a proper component)
  4. Confirming calls `DELETE /api/admin/orgs/[id]`
- **Expected:** No delete route for orgs; orgs should be deactivated (ADR-0032: records people authored are retired, never deleted; ADR-0020: money-bearing records never cascade)
- **Actual:** Delete route exists and uses browser `confirm()` instead of a proper confirmation dialog
- **Fix:** Remove delete route, replace with block/unblock action
- **Status:** `[x]` — DELETE removed, PATCH block/unblock added, portal guard shows suspended state, blocked orgs hidden from buyers



### B-008: Instagram share falls back to browser alert()

- **Severity:** Low
- **Surface:** Buyer — product detail share dialog
- **Steps to recreate:**
  1. Open a product detail page
  2. Click Share
  3. Choose Instagram
  4. A browser `alert()` fires saying "Link copied, paste it in Instagram"
- **Expected:** A toast or inline message
- **Actual:** Browser `alert()` dialog
- **Fix:** Replace `alert()` with a toast notification
- **Status:** `[x]` — replaced with sonner toast; also fixed URL bug (was copying relative path)



### B-009: Buyer order detail shows no tracking or fulfilment status

- **Severity:** High
- **Surface:** Buyer — `/order/[orderId]`
- **Steps to recreate:**
  1. Place an order and complete payment
  2. Admin enters tracking info (AWB, courier, tracking URL) from admin panel
  3. Go to buyer order detail page
  4. Tracking information and fulfilment status are not displayed
- **Expected:** Buyer sees tracking number, courier name, tracking URL, estimated delivery, and the order status (processing/packed/shipped/delivered)
- **Actual:** Only payment status is shown. Order fulfilment status and tracking info are absent.
- **Root cause:** `OrderSummary` component doesn't render tracking fields or order status, though the data exists in the database
- **Fix:** Add tracking info card and fulfilment status badge to buyer order detail
- **Status:** `[x]` — status badge + per-shipment tracking cards (courier, AWB, tracking URL, est. delivery)



### B-010: Admin dashboard top products is a placeholder

- **Severity:** Medium
- **Surface:** Admin — `/admin`
- **Steps to recreate:**
  1. Go to admin dashboard
  2. Look at top/best selling products section
  3. All products show `salesCount: 0, revenue: 0`
- **Expected:** Real sales data computed from orders
- **Actual:** `getTopProducts` returns featured products with hardcoded zero values. Comment in code: "Would need to calculate from orders."
- **Fix:** Dead code deleted — section never existed on dashboard
- **Status:** `[x]` — getTopProducts and getRevenueChart deleted (zero callers, placeholder data)



### B-011: Admin dashboard revenue chart is dead code

- **Severity:** Medium
- **Surface:** Admin — `/admin`
- **Steps to recreate:**
  1. Go to admin dashboard
  2. No revenue chart is visible
  3. Check `getRevenueChart` in the analytics service — it exists but is never called by any page
- **Expected:** Revenue chart rendered on dashboard
- **Actual:** Function exists, zero consumers
- **Fix:** Dead code deleted alongside B-010
- **Status:** `[x]` — function and type removed; real analytics is a future feature



### B-012: Admin users page rows are not clickable

- **Severity:** High
- **Surface:** Admin — `/admin/users`
- **Steps to recreate:**
  1. Go to Admin > Users
  2. See the user list
  3. Click on any user row — nothing happens
  4. No `/admin/users/[id]` page exists
- **Expected:** Clicking a user opens a detail page with profile, order history, addresses, activity
- **Actual:** Rows only have a block/unblock toggle. No navigation. No detail page.
- **Fix:** Create user detail page, make rows clickable
- **Status:** `[x]` — `/admin/users/[userId]` page with profile, stats, block/unblock; rows linked



### B-013: Admin orgs page has no detail view

- **Severity:** High
- **Surface:** Admin — `/admin/orgs`
- **Steps to recreate:**
  1. Go to Admin > Organizations
  2. Click on any org — opens a modal, not a page
  3. Modal shows basic info only. No product count, order history, member list, stats
  4. No `/admin/orgs/[orgId]` page exists
- **Expected:** Org detail page with products, orders, members, stats, commission terms
- **Actual:** Modal-only view with basic fields. Oldest-style admin page (full `"use client"` component)
- **Fix:** Create org detail page with full portal mirror
- **Status:** `[~]` — `/admin/orgs/[orgId]` with 5 live tabs (Dashboard, Products, Orders, Earnings, Reviews) + block toggle; 6 tabs pending readOnly support



### B-014: Product Types and Media not in admin sidebar

- **Severity:** Low
- **Surface:** Admin — sidebar navigation
- **Steps to recreate:**
  1. Look at admin sidebar
  2. Product Types and Media are not listed
  3. Both pages exist and work at `/admin/product-types` and `/admin/media`
- **Expected:** Both appear in the sidebar nav
- **Actual:** Only reachable by typing the URL directly
- **Fix:** Add both to admin sidebar `navItems`
- **Status:** `[x]` — added near Products/Categories with Layers and Images icons



### B-015: Product flags ON_OFFER and NEW_ARRIVAL are manual, not derived

- **Severity:** Medium
- **Surface:** Seller — product form
- **Steps to recreate:**
  1. Create a product
  2. Create an offer on that product via the promotions tab
  3. Go back to the product — it does NOT have the ON_OFFER flag automatically
  4. A product created today does NOT have the NEW_ARRIVAL flag automatically
- **Expected:** ON_OFFER derived from active promotions; NEW_ARRIVAL derived from creation date
- **Actual:** All 5 flags are manual checkboxes. A product with an active offer is not flagged ON_OFFER unless the seller manually checks it.
- **Fix:** Derive ON_OFFER from active sale price and NEW_ARRIVAL from createdAt (14 days). Keep FEATURED, HERO, CLEARANCE_SALE as manual.
- **Status:** `[x]` — computed at display time; form shows manual flags only



### B-016: Seller orders page is read-only with no search or filter

- **Severity:** Medium
- **Surface:** Seller — `/org/[orgId]/orders`
- **Steps to recreate:**
  1. Go to org portal > Orders
  2. See a paginated list of orders — no search bar, no status filter, no date filter
  3. Click an order — detail is view-only; seller cannot mark it as packed or shipped
- **Expected:** Search, status/date filters, and ability to update fulfilment status
- **Actual:** Bare paginated list, read-only
- **Fix:** Add search/filter controls; allow seller to mark as packed (not shipped — delivery partner handles that)
- **Status:** `[x]` — search by code, status filter, "Mark as Packed" button with new API route

---

## Follow-up fixes (found during testing)

### BF-001: Admin self-block prevention
- **Severity:** High
- **Surface:** Admin — `/admin/users`
- **Fix:** `toggleBlockUser` refuses `id === adminId`
- **Status:** `[x]`
- **How to test:**
  1. Go to Admin > Users, find your own account, click Block
  2. Should see toast: "You cannot block your own account"

### BF-002: Blocked user can still browse and purchase
- **Severity:** High
- **Surface:** All authenticated buyer actions
- **Fix:** `requireSession` now checks `isBlocked` on every authenticated request. Sign-in was already gated (credentials + Google). Active sessions are now revoked too.
- **Status:** `[x]`
- **How to test:**
  1. Block a user from Admin > Users
  2. If they have an active session, any page requiring auth shows "Your account has been suspended"
  3. Signing in again fails silently (credentials) or is refused (Google)

### BF-003: Location delete uses browser confirm()
- **Severity:** Low
- **Surface:** Seller — `/org/[orgId]/locations`
- **Fix:** Replaced with a proper Dialog component
- **Status:** `[x]`
- **How to test:**
  1. Go to Org Portal > Locations, click trash icon
  2. A dialog appears (not a browser confirm)

### BF-004: Org order detail shows `{order.code}` literally
- **Severity:** Medium
- **Surface:** Seller — `/org/[orgId]/orders/[orderId]`
- **Fix:** Changed string literal to JSX expression
- **Status:** `[x]`
- **How to test:**
  1. Go to Org Portal > Orders > click an order
  2. Title shows actual order code (e.g., `BB-NZ9B26R8`)

### BF-005: Blocked org's products throw runtime error instead of 404
- **Severity:** Medium
- **Surface:** Buyer — `/product/[slug]`
- **Fix:** Product page calls `notFound()`. Created `src/app/not-found.tsx`.
- **Status:** `[x]`
- **How to test:**
  1. Block an org, navigate to one of its product URLs
  2. Should see "Page not found" with back-to-home button

### BF-006: Admin orders table hydration mismatch on dates
- **Severity:** Low
- **Surface:** Admin — `/admin/orders`
- **Fix:** Pinned locale to `"en-IN"` in `OrdersTable.tsx`
- **Status:** `[x]`
- **How to test:**
  1. Go to Admin > Orders — no hydration error in console

### BF-007: Admin tracking entry should require packed status
- **Severity:** Medium
- **Surface:** Admin — order shipment panel
- **Fix:** Tracking API returns 400 if order is not yet packed
- **Status:** `[x]`
- **How to test:**
  1. Admin > Orders > order in `confirmed` state > try adding tracking
  2. Error: "Tracking can only be added after the seller marks the order as packed"
  3. Seller marks packed first, then admin adds tracking — succeeds

### BF-008: Tracking save succeeds but response throws toast error
- **Severity:** Low
- **Surface:** Admin — order shipment panel
- **Fix:** `applyStatus` wrapped in try/catch — tracking saves regardless
- **Status:** `[x]`
- **How to test:**
  1. Mark order as packed, then add tracking from admin
  2. Should save with success toast (no error)

### BF-009: Admin org detail links escape to org portal
- **Severity:** Medium
- **Surface:** Admin — `/admin/orgs/[orgId]`
- **Fix:** `useProductsBasePath` and `OrgOrdersTable` detect `/admin/` path. Dashboard uses `/admin` basePath.
- **Status:** `[x]`
- **How to test:**
  1. Admin > Orgs > click org > Products tab > click product → goes to `/admin/products/...`
  2. Orders tab > click order → goes to `/admin/orders/...`

### BF-010: Admin org detail icons cross server→client boundary
- **Severity:** Medium
- **Surface:** Admin — `/admin/orgs/[orgId]`
- **Fix:** Moved TABS array into the client component
- **Status:** `[x]`
- **How to test:**
  1. Admin > Orgs > click org — tabs render with icons, no console errors

### BF-011: Mark as Packed required intermediate processing step
- **Severity:** Low
- **Surface:** Seller — `/org/[orgId]/orders/[orderId]`
- **Fix:** Single "Mark as Packed" button; backend chains `confirmed → processing → packed` automatically
- **Status:** `[x]`
- **How to test:**
  1. Place and pay for an order
  2. Org Portal > Orders > click it — one "Mark as Packed" button
  3. Click it — order moves to packed

### BF-012: Integration tests overwrote real dev data
- **Severity:** High
- **Surface:** Dev database (all modules)
- **Problem:** Category product types kept disappearing. The test fixture borrowed the first real org/category/user/carrier and suites reset or deleted their data: category product types, org sales channels, colour values, enhancement policy, real marketplace attribute maps.
- **Fix:** `ensureFixtures()` owns dedicated rows by fixed test keys. Three suites now restore shared reference data. New guard in `test-integrity.test.ts` blocks unscoped `findFirst` in tests.
- **Status:** `[x]`
- **How to test:**
  1. Assign product types to your categories in Admin > Categories
  2. Run `npx vitest run tests/integration`
  3. Reopen the categories — the product types are still there

### BF-013: Hydration errors from dates in admin tables
- **Severity:** Medium
- **Surface:** Admin — categories, users, carts, orders tables (and every other date on the site)
- **Problem:** Dates formatted with the runtime's locale and timezone differed between server and browser
- **Fix:** One set of date/count helpers pinned to en-IN + Asia/Kolkata; a test blocks raw `toLocale*String` calls
- **Status:** `[x]`
- **How to test:**
  1. Open Admin > Categories, Users, Carts, Orders
  2. No hydration error in the console; dates show as DD/MM/YYYY

### BF-014: Measurements blank when editing a product
- **Severity:** High
- **Surface:** Seller/Admin — product edit form
- **Problem:** Measurements saved correctly but were read back through the facts parser, which rejected them and returned nothing
- **Fix:** Dedicated `parseStoredMeasurements`; regression test blocks reading measurements through the facts parser
- **Status:** `[x]`
- **How to test:**
  1. Edit a product whose category has a product type (e.g. Abayas → Islamic wear)
  2. Fill in the measurements and save
  3. Open edit again — the measurements are filled in

### BF-015: Choosing "On its own" for product family fails validation
- **Severity:** Medium
- **Surface:** Seller/Admin — product form
- **Problem:** "On its own" sent an empty string; the schema demanded at least one character
- **Fix:** Empty picker values (family, brand, kind) are stored as no value
- **Status:** `[x]`
- **How to test:**
  1. Create or edit a product, set Family to "On its own", save
  2. Saves without the "Too small" error

---

## Backlog (from this session)

### BL-001: Media page org filter — searchable dropdown
- **Surface:** Admin — `/admin/media`
- **Problem:** Org filter is a horizontal chip list; doesn't scale
- **Status:** `[ ]`

### BL-002: Sidebar reorganisation
- **Surface:** Admin sidebar
- **Problem:** 17 nav items, getting long. Needs grouping or collapsible sections.
- **Status:** `[ ]`

### BL-003: Real dashboard analytics
- **Surface:** Admin — `/admin`
- **Problem:** Top products and revenue chart deleted (were placeholder). No real analytics.
- **Status:** `[ ]`

### BL-004: Admin org detail — remaining 6 tabs
- **Surface:** Admin — `/admin/orgs/[orgId]`
- **Problem:** Storefront, Listing, Library, Offers, Bidding, Locations show "coming soon"
- **Status:** `[ ]`

### BL-005: Blocked user checkout gate
- **Surface:** Buyer — checkout
- **Problem:** Blocked user can still attempt checkout (file-cohesion constraint blocks the fix)
- **Status:** `[x]` — resolved by BF-002; `requireSession` now checks `isBlocked` on every request

### BL-006: Order status undo (packed → processing)
- **Surface:** Seller / Admin
- **Problem:** ORDER_TRANSITIONS is forward-only. No undo if packed by mistake.
- **Status:** `[ ]`

### BL-007: Buyer product page — show facts and measurements
- **Surface:** Buyer — `/product/[slug]`
- **Problem:** Product attributes (colour, material, sleeve length) and measurements (length, bust, waist) are saved in the DB but the buyer product page doesn't render them.
- **Fix:** Added `facts` and `measurements` to buyer `Product` type and DAL. Rendered a "Specifications" section on the product detail page below the description.
- **Status:** `[x]`
- **How to test:**
  1. Create/edit a product with a category that has a product type
  2. Fill in the attribute questions (colour, material, etc.) and measurements
  3. View the product as a buyer — a "Specifications" section shows below the description

### BL-008: Buyer variant switcher (product families)
- **Surface:** Buyer — `/product/[slug]`
- **Problem:** Products in a family (same item in different colours/sizes) are separate pages with no way to switch between them.
- **Fix:** When a product has a `familyId`, siblings are loaded and shown as an "Also available" section with thumbnail links. Clicking navigates to the sibling's page.
- **Status:** `[x]`
- **How to test:**
  1. Create 2+ products in the same family (via the product form's family picker)
  2. View any of them as a buyer — an "Also available" row shows the siblings with thumbnails
  3. Click a sibling — navigates to that product's page, with the current one highlighted

### BL-009: Re-save products to pick up product type from category
- **Surface:** Seller
- **Problem:** Products created before a category had a product type assigned have `productType: null`. Their facts and measurements are empty. Re-saving the product after the category assignment fixes it (D1b: product type is resolved from the category tree at save time).
- **What it needs:** Either a bulk re-save migration, or a note in the product form that prompts re-saving when the product type is missing but the category has one.
- **Status:** `[ ]`

---

## Features

Decisions from the 2026-10-09 planning pass. Manual operations are fine at today's order
volume: we automate when volume makes the manual step hurt, not before.

**Order of work:** quick wins (F-016, F-017, F-011, F-008) → F-021 commission → F-002
cancel + returns with F-024 per-shipment fulfilment → F-004 → F-006 → F-012 → F-013 +
F-019 → F-015. F-003, F-007, F-009, F-010, F-022, F-023, F-025 slot in between.



### F-001: Auction listing page

- **Priority:** Tier 1
- **Surface:** Buyer
- **Business reason:** Buyers can only reach auctions via direct links to `/bid/[slug]`. There is no way to discover ongoing or upcoming auctions.
- **What it needs:** A `/auctions` page listing ongoing and upcoming bidding events with countdowns, images, current highest bids, and a live/upcoming/ended filter.
- **Status:** `[-]` — on hold (owner, 2026-10-09)



### F-002: Order cancellation and returns (merged with former F-020)

- **Priority:** Tier 2
- **Surface:** Buyer, Seller, Admin
- **Business reason:** Buyers have no way to cancel or return. The Consumer Protection (E-Commerce) Rules 2020 require a displayed cancellation/return/refund policy; a self-serve button is not required, so the operation stays manual for now. What must not stay manual is the record: a refund our system doesn't know about leaves the ledger owing the seller for money the buyer got back.
- **Decisions:**
  - **No refund API.** Admin refunds in the Razorpay dashboard; Razorpay's signed `refund` webhook flips our payment state (Invariant 2's shape).
  - **Cancel (pre-shipment):** admin "Cancel order" releases stock in the transaction, marks the order cancelled, writes the ledger reversal.
  - **Return, two steps:** (1) *Return initiated* — buyer requests within the window (7 days after delivery, to confirm), admin approves and books reverse pickup manually on Shiprocket. (2) *Received and verified* — the **org owner** receives the item, records its condition and decides restock (it is their stock). The **refund is the admin's call**, separate from restock, so a seller can't withhold a buyer's money by marking an item damaged; a disputed return goes to admin with the seller's photos.
  - **Ledger reversal follows the refund, through events, not calls.** Payments verifies the Razorpay refund webhook and enqueues `payment.refunded` in the same transaction (ADR-0038). Checkout matches it to the open return/cancellation, which knows the items, and enqueues `return.refunded`. Payouts writes the per-item reversal, idempotent on the return id. No domain calls another. A daily check flags refunds with no matching return (e.g. a goodwill refund) and returns marked refund-due with no refund after N days.
  - **Reversal is per item**, not per order — returning one of three items reverses one line. Today `createReversal` negates the whole SALE entry (`orderId, orgId, kind` is unique).
- **Depends on:** F-024 for per-shipment status
- **Status:** `[ ]`



### F-003: Invoice generation with GST

- **Priority:** Tier 2
- **Surface:** Buyer, Seller, Admin
- **Business reason:** "Download bill" is browser print. A tax invoice needs GSTINs, HSN codes and a CGST/SGST or IGST split; B2B buyers need it to claim input tax credit.
- **Decisions:**
  - **The seller issues the invoice** under their GSTIN; the platform invoices the seller for commission + 18% GST.
  - **GSTIN-only sellers at launch.** The law (Notification 34/2023) lets unregistered sellers use an Enrolment ID for intra-state sales, but Amazon India doesn't accept it either (checked on Seller Central, 2026-10-09). Revisit if small sellers ask.
  - Prices are tax-inclusive; taxable value is derived backwards, in paise. Seller state vs delivery state picks CGST+SGST or IGST.
  - Invoice number is sequential per seller per financial year, ≤16 chars, separate from the random order code (ADR-0025).
  - e-invoice QR only for sellers above ₹5 crore turnover — out of scope at launch.
- **Platform obligations (payouts, not the invoice):** TCS on seller sales (GSTR-8, monthly), TDS under 194-O.
- **Risk:** no CA review yet. Get a one-time CA review of rates and the invoice layout before this goes live.
- **Status:** `[ ]`



### F-004: Feature locks and the plans page

- **Priority:** Tier 2 (gates F-012, F-013, F-015)
- **Surface:** Seller, Admin
- **Business reason:** Premium features (channel connectors, social posting, image enhancers, storefront) need to be switched per org. Sellers pay the admin offline.
- **Decisions:**
  - **No time-based plans, no payment integration.** Admin turns an org's premium features on or off, with a note (amount, date, reference).
  - **Plans page is marketing:** explains the features and tiers. It does not show commission.
  - **Tier prices shown on the page.** It must look better than the platform itself: every feature with its use case, world-class marketing quality. Spike first (`/bb-brainstorm`): references and component sources (shadcn blocks, Launch UI, Tailark, Magic UI); any animation library is a new package and needs a TRD.
- **Open:** tier names, prices, and which features sit in which tier.
- **Status:** `[ ]`



### F-005: Auto delivery scheduling

- **Priority:** Tier 3 (deferred)
- **Surface:** Admin
- **Business reason:** Admin books on Shiprocket by hand and enters tracking. Fine at today's volume.
- **Decision:** deferred until daily orders make the manual step hurt. The provider seam (`server/shipping/providers/`) keeps the choice open; when picked up, compare aggregators (Shiprocket, NimbusPost, iThink, Shipway) on test environment, reverse-pickup API, COD remittance cycle and lane rates. Shiprocket appears to have no sandbox — confirm with their support.
- **Status:** `[-]` — deferred (owner, 2026-10-09)



### F-006: Product family management page

- **Priority:** Tier 2 (before F-012 / F-013)
- **Surface:** Seller
- **Business reason:** Families can only be created by name inside the product form. Channels require variants grouped (Google `item_group_id`, Amazon parent-child, Flipkart listing groups), so channel publishing depends on this.
- **What it needs:** `/org/[orgId]/families` with list/create/edit/retire, shared facts, measurements and description. **Variant generator:** pick axis values (Red, Blue × S, M, L) and create the products at once; each variant fills only price, stock and photos.
- **Status:** `[ ]`



### F-007: Search improvement (full-text + filters)

- **Priority:** Tier 2
- **Surface:** Buyer
- **Business reason:** Search is SQL `LIKE` on name only: no typo tolerance, no ranking, no filters. The win is result quality; latency gains matter only as the catalogue grows.
- **What it needs:** pg_trgm and/or Postgres full-text search across name, category, brand and facts. Filters: category, price, brand. Sort: relevance, price, newest. **First:** confirm Prisma Postgres supports `pg_trgm`.
- **Status:** `[ ]`



### F-008: Seller review replies

- **Priority:** Tier 2
- **Surface:** Seller
- **What it needs:** One reply per review from the seller portal, shown publicly below the review, moderable by admin.
- **Status:** `[ ]`



### F-009: Abandoned cart recovery emails

- **Priority:** Tier 2
- **Surface:** Admin, Buyer
- **What it needs:** Scheduled job for carts idle > N hours above a value threshold; templated email with a return link; configurable delay; unsubscribe link and opt-out honoured.
- **Status:** `[ ]`



### F-010: Org onboarding and guided profile setup

- **Priority:** Tier 2
- **Surface:** Seller
- **Business reason:** The storefront editor shows every field at once with confusing "Waiting on…" labels; new sellers abandon setup.
- **What it needs:** Step-by-step wizard — (1) Identity, (2) Story, (3) Operations, (4) Look. Every field has a hint saying what to write plus a good example. Live storefront preview, progress bar, skip and return. Rewrite the "Waiting" labels in plain words.
- **Status:** `[ ]`



### F-011: Best selling products on storefront (+ broken sort)

- **Priority:** Tier 2
- **Surface:** Buyer (storefront)
- **What it needs:** `OrderItem` grouped by product for the org over a rolling 90 days; shown on storefront and org dashboard. **Also fix the sort dropdown:** it offers price sorts, but a comment in `src/app/(store)/store/[handle]/page.tsx` says price sort was dropped with pagination. Root-cause before fixing.
- **Status:** `[ ]`



### F-012: Google Shopping & Meta catalogue feeds

- **Priority:** Tier 3 (first channel)
- **Surface:** Seller, Admin
- **Business reason:** Cheapest channel: a feed file, no orders coming back.
- **Owner setup:** Google Merchant Center and Meta Commerce Manager, both with domain verification. Decide one platform account vs one per seller (shops share one domain, so likely one).
- **What it needs:** Feed with brand, condition, availability, price, image, gender, age group, colour, size, `item_group_id` (needs F-006), refreshed on a schedule. Gated by F-004.
- **Status:** `[ ]`



### F-013: Marketplace connector base + Flipkart adapter

- **Priority:** Tier 3
- **Surface:** Seller, Admin
- **Business reason:** "List once, sell everywhere." **The base is channel-neutral** for Flipkart, Amazon and Meesho; Flipkart is first only because it is quickest.
- **What it needs:** Channel-neutral connector seam (credentials, listing push, order import, status), then the Flipkart adapter: seller authorisation, listing push through channel mappings, order import, labels. Sellers pushed to a marketplace must have a GSTIN.
- **Owner setup now:** apply for Flipkart third-party API access — approval is the long pole. Flipkart has a sandbox.
- **Depends on:** F-004, F-006, channel-connectors spec
- **Status:** `[ ]`



### F-014: Amazon connector (end-to-end)

- **Priority:** Tier 3
- **Surface:** Seller, Admin
- **What it needs:** SP-API registration, per-seller auth, an adapter on the F-013 base.
- **Status:** `[-]` — parked until F-012 and F-013 are done end to end (owner, 2026-10-09)



### F-015: Instagram posting

- **Priority:** Tier 3
- **Surface:** Seller
- **Owner setup now:** Instagram Business account linked to a Facebook Page, Meta business verification, Meta app review for publishing (weeks).
- **What it needs:** Account linking, draft post from product data, publish. Images from R2 as JPEG, aspect 4:5 to 1.91:1; daily post cap. Gated by F-004.
- **Depends on:** F-004
- **Status:** `[ ]`



### F-016: Admin product archive for policy violations

- **Priority:** Tier 1
- **Surface:** Admin
- **What it needs:** "Archive" on the admin product view with a platform reason, notifying the org. Separate from org self-archive.
- **Status:** `[ ]`



### F-017: Accent colour expansion

- **Priority:** Tier 2
- **Surface:** Seller (storefront)
- **Decision:** 8–10 presets, not a free hex picker — fits ADR-0049 and can't produce an unreadable shop.
- **Status:** `[ ]`



### F-018: Channel reporting (consolidated sales)

- **Priority:** Tier 3
- **Status:** `[-]` — parked (owner, 2026-10-09). Publishing and inventory sync come first.



### F-019: Inventory sync across channels

- **Priority:** Tier 3 (required)
- **Surface:** Seller
- **Business reason:** A sale on one channel must reduce stock everywhere, or overselling causes cancellations and marketplace penalties. **Channel-neutral, separate from F-013.**
- **What it needs:** Stock events (sale, cancel, return, restock) from any channel propagate to all connected channels through the job queue (ADR-0038), with retries. Needs order import from each channel even without reporting. **Channel returns restock us:** only when received in good condition; RTO (undelivered) and customer returns are different events.
- **Depends on:** F-013 base
- **Status:** `[ ]`



### F-020: Return/refund flow

- **Status:** `[-]` — merged into F-002 (owner, 2026-10-09)



### F-021: Commission default 2%, configurable

- **Priority:** Tier 1
- **Surface:** Admin, Seller
- **Business reason:** Commission (on-platform sales only) is hardcoded at 15% (schema default `commissionBps 1500`, fallbacks in `server/payouts/ledger.service.ts` and `ledger.repository.ts`).
- **What it needs:** Platform default as an admin-editable setting, starting at 2%; per-org override stays; org owner emailed when their rate changes. Past orders are already safe — the rate is snapshotted per ledger line. Existing orgs move from 15% to 2% (owner, 2026-10-10); the change applies to orders paid after it. Platform absorbs gateway fees for now.
- **Status:** `[ ]`



### F-022: Courier cost record

- **Priority:** Tier 2
- **Surface:** Admin
- **Business reason:** We pay the courier directly; each shipment stores what the buyer was charged but not what we paid.
- **What it needs:** "Actual cost paid" on each shipment, entered with the AWB; admin report of charged vs paid, per order and per month. A full shipping ledger only if Shiprocket wallet reconciliation is needed later.
- **Status:** `[ ]`



### F-023: 45-day payout hold

- **Priority:** Tier 2
- **Surface:** Admin
- **Business reason:** Payouts happen off-platform; paying before the return window closes means chasing the seller for refunded money.
- **What it needs:** A ledger entry is eligible 45 days after delivery. The payout screen shows the policy as a disclaimer and highlights entries still inside the window — warns, never blocks.
- **Status:** `[ ]`



### F-024: Per-shipment fulfilment

- **Priority:** Tier 1 (before F-002)
- **Surface:** Seller, Admin, Buyer
- **Business reason:** Orders already split into one `Shipment` per seller and pickup location, each with its own tracking and charge. But "Mark as Packed" and status are order-level, so one seller packing marks the whole multi-seller order packed.
- **What it needs:** Pack, track and deliver per shipment; order status derived from its shipments (e.g. "Partly shipped"); buyer order page groups items under each shipment's tracking card.
- **Status:** `[ ]`



### F-025: E-commerce rules compliance

- **Priority:** Tier 1
- **Surface:** Buyer
- **Business reason:** The Consumer Protection (E-Commerce) Rules 2020 require more than a policy page.
- **What it needs:** Cancellation/return/refund policy page; named grievance officer with contact (acknowledge in 48h, resolve within a month); seller name and address on product pages; country of origin on listings; no cancellation charge unless the platform bears an equal one. Not legal advice — confirm with a lawyer when possible.
- **Status:** `[ ]`

---



## Documentation fixes (from audit)



### D-001: Add listing domain to docs/README.md

- The listing domain is absent from both the domain docs table and "remaining domains" paragraph
- **Status:** `[ ]`



### D-002: Add listing domain to docs/ARCHITECTURE.md

- Domain enumeration paragraph lists 14 domains but omits listing
- **Status:** `[ ]`



### D-003: Fix Domain header in listing spec files

- 8 spec/TRD files (listing-vocabulary and channel-registry) say `Domain: catalog` instead of `Domain: listing`
- **Status:** `[ ]`



### D-004: The listing domain needs a [CLAUDE.md](http://CLAUDE.md)

- Fully built domain with 23 files has no rulebook; every other domain of that size has one
- **Status:** `[ ]`



### D-005: Update docs/BACKLOG.md verified date

- Currently verified 2026-09-29, before the listing extraction (PR-283 was 2026-10-05)
- **Status:** `[ ]`

