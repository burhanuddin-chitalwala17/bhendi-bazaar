# Tracker

- **Created:** 2026-10-07
- **Updated:** 2026-10-08
- **Source:** Platform audit (full sweep of buyer, seller, admin surfaces)

Status key: `[ ]` open, `[~]` in progress, `[x]` done

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
- **Fix:** `requireActiveSession()` added for mutation routes. Org API calls gated via `resolveOrgScope`
- **Status:** `[~]` — org API calls gated; checkout gate pending (file-cohesion constraint)
- **How to test:**
  1. Block a user from Admin > Users
  2. Log in as that user, try org portal → "suspended" message

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
- **Status:** `[ ]`

### BL-006: Order status undo (packed → processing)
- **Surface:** Seller / Admin
- **Problem:** ORDER_TRANSITIONS is forward-only. No undo if packed by mistake.
- **Status:** `[ ]`

### BL-007: Buyer product page — show facts and measurements
- **Surface:** Buyer — `/product/[slug]`
- **Problem:** Product attributes (colour, material, sleeve length) and measurements (length, bust, waist) are saved in the DB but the buyer product page doesn't render them. The `Product` domain type has no `facts` field.
- **What it needs:** Add `facts` and `measurements` to buyer `Product` type, include in DAL query, render a "Specifications" section on the product detail page below the description.
- **Status:** `[ ]`

### BL-008: Buyer variant switcher (product families)
- **Surface:** Buyer — `/product/[slug]`
- **Problem:** Products in a family (same item in different colours/sizes) are separate pages with no way to switch between them. A buyer visiting the blue abaya doesn't know the red one exists without going back to the listing.
- **What it needs:** When viewing a product that belongs to a family, load all siblings. Show variant axes (colour, size) as selectable options on the product page — clicking swaps gallery, price, stock without a full page navigation. The family and variant data exist (`ProductFamily`, `Product.familyId`, ADR-0043); the buyer-side switcher UI does not.
- **Depends on:** F-006 (product family management page) for seller-side setup
- **Status:** `[ ]`

### BL-009: Re-save products to pick up product type from category
- **Surface:** Seller
- **Problem:** Products created before a category had a product type assigned have `productType: null`. Their facts and measurements are empty. Re-saving the product after the category assignment fixes it (D1b: product type is resolved from the category tree at save time).
- **What it needs:** Either a bulk re-save migration, or a note in the product form that prompts re-saving when the product type is missing but the category has one.
- **Status:** `[ ]`

---

## Features



### F-001: Auction listing page

- **Priority:** Tier 1
- **Surface:** Buyer
- **Business reason:** Buyers can only reach auctions via direct links to `/bid/[slug]`. There is no way to discover ongoing or upcoming auctions. This kills auction participation and makes the bidding feature nearly invisible.
- **What it needs:** A `/auctions` page listing all ongoing and upcoming bidding events with countdown timers, product images, current highest bids, and filtering by status (live/upcoming/ended).
- **Status:** `[ ]`



### F-002: Buyer order cancellation and return/refund flow

- **Priority:** Tier 2
- **Surface:** Buyer
- **Business reason:** Buyers have no way to cancel an order or request a return. `REFUNDED` payment status exists but nothing triggers it. This is a legal requirement for e-commerce in India (Consumer Protection Act). Without it, every cancellation/return is manual email work for the admin.
- **What it needs:** Cancel button (pre-shipment), return request (post-delivery, time-windowed), refund initiation through Razorpay API, status tracking for the buyer.
- **Status:** `[ ]`



### F-003: Invoice generation with GST

- **Priority:** Tier 2
- **Surface:** Buyer
- **Business reason:** The current "download bill" is just browser print. Indian e-commerce requires a proper tax invoice with GST breakdown, invoice number, seller GSTIN, and buyer details. Without it, B2B buyers can't claim input tax credit.
- **What it needs:** Server-generated PDF invoice with: invoice number sequence, GSTIN of seller and buyer (if provided), HSN codes, CGST/SGST/IGST breakdown, QR code (for e-invoice compliance above threshold).
- **Status:** `[ ]`



### F-004: Subscription & billing (1, 3, 6, 12 month plans)

- **Priority:** Tier 2 (gates most Tier 3 work)
- **Surface:** Seller, Admin
- **Business reason:** The platform currently has zero recurring revenue from sellers — only per-sale commission. Subscription tiers gate premium features (channel connectors, social posting, image enhancers, storefront unlocking). Without this, there's no monetization path beyond commission and no way to differentiate free vs paid sellers.
- **What it needs:** Plan/Subscription/Invoice models, Stripe or Razorpay subscription integration, feature-gate middleware, upgrade/downgrade/cancel flows, grace period handling, admin management UI. Tiers: Free (locked storefront, no channels, no enhancer, no social), Paid (1/3/6/12 month options unlocking everything).
- **Status:** `[ ]`



### F-005: Auto delivery scheduling

- **Priority:** Tier 2
- **Surface:** Admin
- **Business reason:** Currently admin manually books shipments on Shiprocket's website, then comes back and enters tracking details. This doesn't scale — every order requires 2 manual steps. Auto-scheduling means orders flow through without admin touching each one.
- **What it needs:** Extend Shiprocket integration to use their booking API: auto-create shipment on order confirmation, schedule pickup, generate label, fetch AWB. The provider interface (`server/shipping/providers/`) is already designed for this — the stub `mock.booking.ts` is ready to be replaced.
- **Status:** `[ ]`



### F-006: Product family management page

- **Priority:** Tier 2
- **Surface:** Seller
- **Business reason:** Families can only be created from inside the product form with just a name. There's no way to edit a family's shared facts, measurements, description, or variant axes after creation. Sellers managing product ranges (e.g., a kurta in 5 colours) can't manage the family's shared properties.
- **What it needs:** A standalone `/org/[orgId]/families` page with list/create/edit/retire. Form for shared facts, measurements, description, variant axis selection. Show member products.
- **Status:** `[ ]`



### F-007: Search improvement (full-text + filters)

- **Priority:** Tier 2
- **Surface:** Buyer
- **Business reason:** Search is a Prisma `contains` (SQL LIKE) on product name only. No typo tolerance, no relevance ranking, no filters. A buyer searching "red kurta" who types "red krta" gets zero results. Buyers can't narrow by category, price range, or sort by relevance/price. Poor search = lost sales.
- **What it needs:** pg_trgm or Postgres full-text search for typo tolerance and relevance. Filter sidebar: category, price range, brand. Sort: relevance, price low-high, price high-low, newest.
- **Status:** `[ ]`



### F-008: Seller review replies

- **Priority:** Tier 2
- **Surface:** Seller
- **Business reason:** Reviews are read-only for sellers. Sellers can't respond to negative reviews to offer resolution or thank positive reviewers. This is standard on every marketplace (Amazon, Flipkart) and builds buyer trust.
- **What it needs:** A reply field on each review in the seller portal. One reply per review. Shown publicly below the review on the product page. Moderable by admin.
- **Status:** `[ ]`



### F-009: Abandoned cart recovery emails

- **Priority:** Tier 2
- **Surface:** Admin, Buyer
- **Business reason:** Admin can see abandoned carts but can't act on them. Automated recovery emails are the highest-ROI marketing automation in e-commerce (typical 5-15% recovery rate). Each recovered cart is direct revenue.
- **What it needs:** A scheduled job that identifies carts idle > N hours with value > threshold, sends a templated email with cart contents and a return link. Configurable delay and frequency. Opt-out handling.
- **Status:** `[ ]`



### F-010: Org profile guided setup

- **Priority:** Tier 2
- **Surface:** Seller
- **Business reason:** The storefront editor dumps all fields at once — tagline, description, logo, cover image, accent, intro, story, location, owner info, pillars, social handles, policies. The "Waiting" labels are confusing ("Waiting on at least one block, with a heading and a line under it"). New sellers don't know what to fill or in what order, and abandon the setup.
- **What it needs:** A step-by-step wizard: (1) Identity — name, logo, tagline, (2) Story — about, owner, location, (3) Operations — delivery/returns policy, social handles, (4) Look — cover image, accent, pillars. Show progress. Let them skip and return.
- **Status:** `[ ]`



### F-011: Best selling products on storefront

- **Priority:** Tier 2
- **Surface:** Buyer (storefront)
- **Business reason:** The storefront currently shows "newest goods" but not best sellers. Best sellers are social proof — they tell a buyer "other people bought this and came back." Currently `getTopProducts` is a placeholder returning zero data.
- **What it needs:** Query `OrderItem` grouped by productId for the org, sum quantities over a rolling window (e.g., last 90 days). Show on storefront and org dashboard.
- **Status:** `[ ]`



### F-012: Google Shopping & Meta catalogue feeds

- **Priority:** Tier 3
- **Surface:** Seller, Admin
- **Business reason:** Google and Meta are "shopfront" channels — they fetch a feed file from your site and index products. This is the simplest marketplace integration: no real-time API, no order import. Just generate the file and host it. Products appear on Google Shopping and Facebook/Instagram shops. The channel readiness system already tells you if products are ready.
- **What it needs:** Feed generator that reads products + channel mappings, produces Google Merchant Center XML and Meta Commerce Manager CSV. Host at a public URL per org. Seller registers URL with Google/Meta. Gated behind subscription.
- **Status:** `[ ]`



### F-013: Flipkart connector (end-to-end)

- **Priority:** Tier 3
- **Surface:** Seller, Admin
- **Business reason:** Flipkart is India's second-largest marketplace. Sellers listing on Flipkart from BB means one product form, one inventory, multiple channels. This is the core value proposition of the listing phase — "list once, sell everywhere."
- **What it needs:** OAuth credential management per seller, Flipkart Seller API adapter, listing push (using channel mappings), order import, stock sync, return handling. ~4-6 weeks.
- **Depends on:** F-004 (subscription gating), channel-connectors spec
- **Status:** `[ ]`



### F-014: Amazon connector (end-to-end)

- **Priority:** Tier 3
- **Surface:** Seller, Admin
- **Business reason:** Amazon is India's largest marketplace. Same value proposition as Flipkart — list once, sell everywhere. Amazon SP-API is more complex than Flipkart's API but the pattern is the same.
- **What it needs:** SP-API registration, per-seller auth, listing push, order import, stock sync, return handling. ~4-6 weeks.
- **Depends on:** F-004 (subscription gating), channel-connectors spec
- **Status:** `[ ]`



### F-015: Instagram posting

- **Priority:** Tier 3
- **Surface:** Seller
- **Business reason:** Sellers want to post product photos to Instagram directly from their media library. Instagram is the primary discovery channel for fashion/lifestyle products in India. Currently sellers have to download images and post manually.
- **What it needs:** Meta Graph API integration, per-seller Facebook Business account linking, post draft generation (image + caption from product data), publish flow. Gated behind subscription.
- **Depends on:** F-004 (subscription gating)
- **Status:** `[ ]`



### F-016: Admin product archive for policy violations

- **Priority:** Tier 1
- **Surface:** Admin
- **Business reason:** Admin sees all products across orgs but can only view them — can't archive a product that violates platform policy. Currently requires asking the org to archive it themselves, which doesn't work for urgent takedowns (counterfeit, prohibited items).
- **What it needs:** An "Archive" action on the admin product view that archives the product with a platform reason, notifying the org. Separate from org self-archive.
- **Status:** `[ ]`



### F-017: Accent colour expansion

- **Priority:** Tier 2
- **Surface:** Seller (storefront)
- **Business reason:** Only 3 accent options (green, amber, blue) besides the default. Sellers with specific brand colours (e.g., a brand that uses pink or teal) can't match their storefront to their identity. More presets or a custom hex picker would let the storefront feel like the seller's own shop.
- **What it needs:** Either expand to 8-10 presets covering common brand colours, or allow custom hex input (with a validator that checks contrast ratios for accessibility).
- **Status:** `[ ]`



### F-018: Channel reporting (consolidated sales)

- **Priority:** Tier 3
- **Surface:** Seller, Admin
- **Business reason:** Once sellers sell on multiple channels, they need one view of what sold where, with revenue and commission per channel. Without this, sellers track each platform separately — the exact problem BB is supposed to solve.
- **What it needs:** Aggregate order data by channel, show per-channel revenue/units/returns. Admin sees platform-wide; seller sees their own.
- **Depends on:** F-013 / F-014 (marketplace connectors)
- **Status:** `[ ]`



### F-019: Inventory sync across channels

- **Priority:** Tier 3
- **Surface:** Seller
- **Business reason:** If a product sells on Amazon, stock must decrement on Flipkart and BB simultaneously. Without real-time sync, overselling is inevitable and causes cancellations and penalties on marketplaces.
- **What it needs:** Event-driven stock sync: when stock changes on any channel (sale, restock, return), propagate to all connected channels. Race condition handling with retries.
- **Depends on:** F-013 / F-014 (marketplace connectors)
- **Status:** `[ ]`



### F-020: Return/refund flow

- **Priority:** Tier 3
- **Surface:** Buyer, Seller, Admin
- **Business reason:** Buyers currently have no way to request a return. This is legally required and operationally necessary. Every return is currently manual email work. With marketplace integration, return handling must be consistent across channels.
- **What it needs:** Buyer-initiated return request (time-windowed), admin approval/rejection, reverse pickup scheduling, refund through Razorpay, restock on return receipt, per-org return policy enforcement.
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

