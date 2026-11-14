# Changelog history

- **Verified:** 2026-11-12
- **Last PR number:** PR-286

One section per closed month, newest first: what shipped, in a few lines. The running month is in
[CHANGELOG.md](CHANGELOG.md). A closed month's full entries are dropped once summarised here; git keeps them —
`git log -S "PR-20" -- docs/CHANGELOG.md docs/changelog/` finds one. Rollover is prompted at session start
([ADR-0072](adr/0072-the-changelog-holds-the-running-month-and-a-closed-month-becomes-a-summary.md)).

## 2026-10

- **Listing vocabulary** (1–5 Oct): product types became admin-made rows, families and variants landed, the bulk
  sheet and product form read the vocabulary; the channel registry declared Flipkart, Google and Meta and their
  readiness (advises, never gates).
- **Rules enforced** (2–6 Oct): one repository per table, one API door for the browser, colour as a palette,
  credentials kept server-side with an origin check on mutations, stock with one writer.
- **Audit fixes** (7–8 Oct): org blocking replaced deletion, blocked sessions revoked, admin user/org detail
  pages, integration tests stopped touching real data.
- **Feeds, policies, shipping quote** (14 Oct): Google and Meta product feeds, the store policies page, shipping
  charged from a signed quote. SDLC gained a scope cut, decision log and UX stage (ADR-0061).
- **Marketplace integration** (20–31 Oct): channel connectors (Amazon and Flipkart accounts), listings imported
  and settled against products, marketplace facts filled, families merged, stock synced across channels.
- **Offers hardening** (29 Oct): one-per-customer codes hold under races, discount ceilings hold, platform funds
  on the 30-day lowest price. Rate limiting enforced through one registry.
- **GTM readiness** (31 Oct): review recorded; Next.js 16.4.3, nightly encrypted backups with a restore drill,
  health probe and startup env check, browser journeys gating the deploy, structured data.
- **Own store begun** (30–31 Oct): org-profile, product-form and order-fulfilment first units.

## 2026-09 · PR-84 to PR-217

- **Launch plumbing**: pre-launch crawl block, transactional email, deploys via GitHub Actions, a stable
  preview domain for `develop`.
- **Buyer features**: wishlist as rows, bidding (timed auctions on a link), phone numbers from any country,
  shared phone numbers, sign-in over the page, contact us, abandoned checkouts released, reviews with photos.
- **Images and storage**: moved to Cloudflare R2 behind one seam, stored small and served through the
  optimizer; every image became a library record with named gallery slots, crop and rotate.
- **Org storefronts**: every org got a storefront; products archive instead of delete; copy a product.
- **Server rendering**: no page is a client component; domains stopped reaching into each other's repositories.
- **Shipping**: one shipment vocabulary, returned parcels restock and reverse the ledger.
- **Worker and media**: Postgres job queue and our own worker; hosted video with transcoding; image
  enhancement (cut out, on white, studio, scene, enlarge) with a quota.
- **Seller profile**: private and public faces, brands and listing defaults, a brand page.

## 2026-08 · PR-01 to PR-83

- **Foundations**: the doc system (CLAUDE.md, ADRs, specs, skills), `server/` split into domains, CI gates,
  one error envelope with `useServerForm`, server-generated frozen slugs.
- **Money path**: integer paise, server-side pricing, payment confirmed only by the gateway, the last unit
  sells once.
- **Multi-vendor**: `Seller` became `Org` with members, the org portal and onboarding, portal separation,
  nested categories, addresses as records, stock per pickup location and orders shipped from it.
- **Store**: mobile-first app shell, product video, design tokens for every axis, configurable home banners,
  offers and the payout ledger, bulk catalogue upload.
- **Ops**: deploys run migrations, the seed guard, a local dev database, dashboard aggregation in the database.
