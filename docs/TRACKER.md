# Tracker

- **Created:** 2026-10-07
- **Updated:** 2026-11-12 (done and parked items removed; they are in git history and the CHANGELOG)
- **Source:** Platform audit (full sweep of buyer, seller, admin surfaces)

Status key: `[ ]` open, `[~]` in progress, `[x]` done, `[-]` on hold / parked / merged

---

## Bugs

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

## Follow-up fixes (found during testing)

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

### BL-006: Order status undo (packed → processing)
- **Surface:** Seller / Admin
- **Problem:** ORDER_TRANSITIONS is forward-only. No undo if packed by mistake.
- **Status:** `[ ]`

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

### F-013: Marketplace connector base + Flipkart adapter

- **Priority:** Tier 3
- **Surface:** Seller, Admin
- **Business reason:** "List once, sell everywhere." **The base is channel-neutral** for Flipkart, Amazon and Meesho. Built together with F-014 (owner, 2026-10-15).
- **What it needs:** Channel-neutral connector seam (credentials, listing push, order import, status), then the Flipkart adapter: seller authorisation, listing push through channel mappings, order import, labels. Sellers pushed to a marketplace must have a GSTIN.
- **Owner setup:** done 2026-10-15 — Flipkart Partner Services Network approval; third-party app created, credentials in env, redirect `https://bhendi-bazaar.com/api/channels/flipkart/callback`. A sandbox is **not** confirmed in current docs.
- **Plan (locked 2026-10-20):** [marketplace-integration](specs/marketplace-integration/), eight subfeatures in order (updated 2026-10-21) — channel-connectors, channel-import, product-merge, marketplace-facts, family-merge, channel-listings, inventory-sync, marketplace-publish — with every decision in its [decisions.md](specs/marketplace-integration/decisions.md). F-014 and F-019 are delivered by the same subfeatures. API behaviour is in [INTEGRATIONS.md](INTEGRATIONS.md#connecting-a-seller-what-the-two-apis-actually-do).
- **Known limits:** the public API cannot create a product (lists against an existing FSN only; new products go up by the seller's template); Flipkart does not say which seller authorised; location ids come from an unpublished API. Catalogue-creation access requested of Flipkart, unanswered.
- **Depends on:** F-004, F-006
- **Status:** `[~]` — channel-connectors and channel-import implemented 2026-10-21 (both marketplaces connected and their listings read on the owner's accounts); product-merge next

### F-014: Amazon connector (end-to-end)

- **Priority:** Tier 3
- **Surface:** Seller, Admin
- **What it needs:** SP-API registration, per-seller auth, an adapter on the F-013 base.
- **Owner setup:** done 2026-10-15 — public developer approved (after an appeal adding a written incident response plan); app client created in Draft with Product Listing, Pricing, Inventory and Order Tracking, no restricted roles. Redirects `https://bhendi-bazaar.com/api/channels/amazon/callback` and the `dev.` equivalent.
- **Known limits:** 25 seller authorisations until the app is listed on the Appstore (required of public apps; 3–4 week review). Sellers must re-authorise every 365 days. Orders API v0 is removed 27 March 2027, so order import targets v2026-01-01. Notifications need AWS, so orders are polled. New products need a GTIN or a brand exemption. No Amazon category mappings exist yet.
- **Status:** `[~]` — unparked by owner 2026-10-15; delivered by the marketplace-integration subfeatures with F-013 (Amazon end to end first, Q4)

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

### D-002: Add listing domain to docs/ARCHITECTURE.md

- Domain enumeration paragraph lists 14 domains but omits listing
- **Status:** `[ ]`

### D-003: Fix Domain header in listing spec files

- 8 spec/TRD files (listing-vocabulary and channel-registry) say `Domain: catalog` instead of `Domain: listing`
- **Status:** `[ ]`

### D-004: The listing domain needs a [CLAUDE.md](http://CLAUDE.md)

- Fully built domain with 23 files has no rulebook; every other domain of that size has one
- **Status:** `[ ]`

