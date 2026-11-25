# BACKLOG.md — phased status map

- **Verified:** 2026-11-01
- **Covers:** `docs/specs/*/`

Where the product is, phase by phase. This is the **milestone map**, not a task list — per-feature detail lives in [specs/](specs/), decisions in [adr/](adr/), and history in `git log`.

> Ordering principle: **transaction integrity before new capability.** The store's money path is the thing customers touch and the thing that is hardest to correct after the fact, so it leads.

## Three tracks

What the platform solves for a small business, and where each lives. Every phase below serves one of these.

| Track | Problem solved | Lives in | Status |
|---|---|---|---|
| **1 — Own store** | A store and landing page the shop hands out on WhatsApp, cards and pamphlets, run from a phone | Phases 7, 9, 12 — [own-store](specs/own-store/) | 🔨 Phase 12: offers-hardening implemented 2026-10-29; order-fulfilment next |
| **2 — Photos made ready** | A phone photo becomes an image fit for every platform | Phase 11 — [media-library](specs/media-library/), [image-enhancement](specs/image-enhancement/) | 🔨 In progress |
| **3 — Sell everywhere** | One product, listed and stocked on Amazon, Flipkart, Google and Meta; WhatsApp and Instagram later | Phase 11 — [marketplace-integration](specs/marketplace-integration/), [channel-registry](specs/channel-registry/), [shopfront-feeds](specs/shopfront-feeds/) | 🔨 In progress |

---

## Phase status

| Phase | Goal | Domains | Status |
|---|---|---|---|
| **1** — Storefront & admin | Browse, cart, checkout UI, admin console for products/orders/users/reviews/sellers | catalog, cart, admin, identity | ✅ **Done** |
| **2** — Transaction integrity | The server is authoritative over price, payment state, and stock; money is exact | checkout, payments | ✅ **Done** — PR-37..40 |
| **3** — Fulfilment & marketplace | A confirmed order becomes a real booked shipment from a real location, and the store serves multiple vendors | shipping, catalog, identity | ⏳ Not started — 2 specs + a 9-subfeature programme drafted |
| **4** — Enforcement | Automated checks that hold the Invariants; blocking CI | *(cross-domain)* | 🔨 In progress — typecheck and tests block; documentation, security headers and Prisma error shapes are now guard suites (PR-117..119). Rate limiting enforced product-wide through one registry (2026-10-29). Outstanding: lint still `continue-on-error`, database-backed tests still skip in CI |
| **5** — Scale & operability | Indexed search, pagination, caching, error tracking | catalog, *(cross-domain)* | ⏳ Not started — 2 specs drafted (error-tracking, read-caching) |
| **6** — Catalogue richness | What a product page can show about a product, beyond a price and a photograph | catalog, checkout | ⏳ Not started — 1 spec drafted (product-video) |
| **7** — Promotions & settlement | Offers the platform and its organisations can run, and a record of what each is owed | promotions, payouts, checkout | 🔨 In progress — engines, checkout, ledger and APIs landed (PR-67); screens outstanding |
| **8** — Bidding | A product can be sold by timed bidding on a shareable link instead of at a fixed price | bidding, catalog, checkout, payouts | ✅ **Done** — PR-97 |
| **9** — Seller storefronts | Every selling organisation gets a public storefront of its own, at a link it can promote | catalog | ✅ **Done** — 7 subfeatures |
| **10** — Discoverability | The store is findable: every public page describes itself, every product is machine-readable, every URL answers honestly | catalog, *(cross-domain)* | ⏳ Not started — 1 spec drafted (seo) |
| **11** — Listing: one entry, every channel | A product is described once, from its photographs, and is ready for the store, Amazon, Flipkart and Instagram from that one entry | catalog, content, listing, social, *(cross-domain)* | 🔨 In progress — 3 of 9 specs accepted (worker-foundation, seller-profile, media-library) plus 2 subfeatures accepted and 1 drafted (video-hosting); ADR-0037, ADR-0038, ADR-0039 |
| **12** — The shop's own store | A small shop runs a store it is proud to hand out, from its phone, and no offer or order costs the platform money it did not choose to spend | catalog, checkout, promotions, shipping, notifications, payouts | 🔨 In progress — offers-hardening implemented 2026-10-29 (units 1–6); six verticals to come |
| **13** — Design system | The store, seller portal and admin feel designed rather than assembled: one type scale, one icon voice, one page grammar, phone first | *(front end, cross-domain)* | 🔨 Built 2026-11-04 (uncommitted, awaiting owner's visual review); React Compiler and follow-ups open; ADR-0066 proposed |

---

## Phase 2 — Transaction integrity

The five specs below implement the Invariants in [../CLAUDE.md](../CLAUDE.md). They are sequenced: pricing authority must land before payment confirmation can check an amount against a trustworthy total.

| Spec | Requirement | ADR | Status |
|---|---|---|---|
| [server-side-pricing-authority](specs/server-side-pricing-authority/) | Prices, totals, and gateway amounts are computed by the server from persisted data | [0002](adr/0002-server-holds-pricing-authority.md) | ✅ Implemented — PR-38 |
| [payment-confirmation](specs/payment-confirmation/) | An order's paid state derives only from a verified gateway signal | [0005](adr/0005-payment-state-server-only.md) | ✅ Implemented — PR-39 |
| [inventory-reservation](specs/inventory-reservation/) | Stock is reserved atomically at placement and released on failure | [0007](adr/0007-conditional-stock-decrement.md) | ✅ Implemented — PR-40 |
| [money-as-paise](specs/money-as-paise/) | Monetary values are exact from catalogue to gateway to report | [0004](adr/0004-money-as-integer-paise.md) | ✅ Implemented — PR-37 |
| [checkout-abandonment](specs/checkout-abandonment/) | An unpaid checkout releases its goods within minutes and is shown to nobody | [0025](adr/0025-order-codes-are-random-not-sequential.md) | ✅ Implemented — PR-104 |
| [payment-confirmation/unmatched-payments](specs/payment-confirmation/unmatched-payments/) | Money that arrives for an order the store already released is recorded and refunded, never lost | [0005](adr/0005-payment-state-server-only.md) | ✅ Implemented — PR #95 |

Parked from [unmatched-payments](specs/payment-confirmation/unmatched-payments/decisions.md): a buyer email when a late payment's refund starts (Q8); the buyer checkout's wording when its confirm is refused for a released order (Q9); a capture whose amount differs from the order's total, still refused loudly (Q11). A gateway sweep for a late capture whose webhook never arrived (Q10) is Phase 5.

Also in this phase, no spec required (they are corrections with an ADR already stating the rule): request-body parsing across the remaining handlers ([Invariant 4](../CLAUDE.md)), the seed guard ([Invariant 7](../CLAUDE.md)), and the `next-auth` / `next` upgrades.

## Phase 3 — Fulfilment

| Spec | Requirement | Status |
|---|---|---|
| [product-weight-and-rates](specs/product-weight-and-rates/) | A product's weight is persisted and drives its shipping quote | ✅ Done — PR-22/48/53; parcels bill at summed weight rounded up to whole kg |
| [multi-vendor-marketplace](specs/multi-vendor-marketplace/) | Three audiences, three portals, and the data model a marketplace needs | ✅ 9 of 10 subfeatures done (dashboard-widgets PR-50 closes the build); org-team deferred by decision — the one remaining |
| [shipping-fulfilment](specs/shipping-fulfilment/) | A confirmed order results in a real booked shipment with real tracking | ⏸️ Deferred by decision (2026-08-10): keep live quotes + manual fulfilment; build later |

`shipping-fulfilment`'s open question was decided 2026-08-10 — keep the current flow (live quotes, manual fulfilment); see its `spec.md`. It depends on `product-weight-and-rates`, since booking real parcels at fictional weights is worse than not booking them.

`multi-vendor-marketplace` sits between them and is the largest thing in the backlog. It began as one feature about where a product ships from and became nine subfeatures: answering it properly needed an owner for a pickup location, which needed an organisation, which needed people to belong to one — at which point the panel called "admin" was doing two jobs for two audiences. See its [spec.md](specs/multi-vendor-marketplace/spec.md) for the programme and `431ed6e7:docs/specs/multi-vendor-marketplace/portal-split.md` for where each of today's 15 admin pages and 22 handlers lands.

One recorded gap remains on the money path: shipping is charged at the rate the client says it selected — the server matches it to a quoted parcel but does not re-derive the price. A server-side re-quote at order time would close it; watch item.

It reaches back into Phase 2: [stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) moves the stock guard from `Product.stock` onto a per-location row, so [inventory-reservation](specs/inventory-reservation/) must land first, and [order-and-cart-lines](specs/multi-vendor-marketplace/order-and-cart-lines/) wants [money-as-paise](specs/money-as-paise/) first so its price columns are not migrated twice.

## Phase 4 — Enforcement

Making Phase 2 and 3 stick rather than landing once. Mostly process, governed by [TESTING.md](TESTING.md); one spec so far:

| Spec | Requirement | Status |
|---|---|---|
| [rate-limiting](specs/rate-limiting/) | Every public endpoint is classified for rate limiting in one registry, enforced in every deployed environment; a deploy that can't enforce is refused | ✅ Implemented (2026-10-29) — product-wide: every public route is limited or exempt with a reason ([ADR-0063](adr/0063-every-public-route-is-classified-for-rate-limiting-in-one-registry.md)). Later: CI proxy for the shared store (Q13), portal handler limits (Q15), the outage alert with error-tracking (Q14) |
| [supply-chain-integrity](specs/supply-chain-integrity/) | What the store ships carries no published vulnerability and no committed secret, and the pipeline is what establishes it | 📝 Draft |

- Restore the test suite, prioritised by the Invariants ([TESTING.md](TESTING.md) sets the targets)
- Quality gates block the pipeline
- ~~`prisma migrate deploy` in the pipeline~~ ✅ Done — PR-57 put it in the Vercel build ([ADR-0014](adr/0014-deploys-run-their-own-migrations.md))
- `validateEnv()` called at boot ✅ for the rate-limit configuration, which it refuses; the rest of its list is reported, not refused, until each is checked against Vercel, and it still omits `ENCRYPTION_KEY` ([rate-limiting](specs/rate-limiting/) Q11)
- `/bb-review` in use before every PR

## Phase 5 — Scale & operability

Two of this phase's strands are now specified; the rest stays deliberately undetailed.

| Spec | Requirement | Status |
|---|---|---|
| [error-tracking](specs/error-tracking/) | When something fails, somebody finds out — in minutes, with enough detail to act | 📝 Draft |
| [read-caching](specs/read-caching/) | A page that renders the same for everyone is built once, and no price on it is ever stale | 📝 Draft |
| in-app notifications: requests on the bell | "Ready" and "new request" as in-app notifications once the in-app notifications branch (PR #57) is rebased and merged (setup-requests Q19) | ⏸ Later |

Both were pulled forward out of "not started" for the same reason: Phase 9 shipped a URL designed to be *shared*, so the storefront now attracts the one traffic shape that uncached reads handle worst, and the store's growing set of deliberately fail-open controls — the limiter, the reconciliation sweep, the ledger backfill — each record a failure and notify nobody.

Still unspecified: product search an index can serve (`pg_trgm` or `tsvector`) · pagination on storefront queries · database-side aggregation for admin dashboards · index review on `Order` · order cancellation and refunds · structured logging as a project-wide convention.

## Phase 6 — Catalogue richness

A new phase, added 2026-08-13. Phase 1 built the storefront and closed; this is where capability *added to a product page* now lands, rather than reopening a done phase or filing it under Phase 5, which is about making what exists fast and observable.

| Spec | Requirement | Status |
|---|---|---|
| [product-video](specs/product-video/) | A product page shows video alongside its photographs, in an order the seller composes | 📝 Draft — all questions closed 2026-08-13 |
| [bulk-catalog-upload](specs/bulk-catalog-upload/) | An org sets up its catalogue from one spreadsheet plus local photos; admins likewise for categories. Corrects SKU uniqueness to org scope | ✅ Implemented — 2026-08-21 (PR-73) |
| [product-archive](specs/product-archive/) | An org archives a product and restores it, without destroying the orders, payouts or ledger entries it appears on | ✅ Implemented — 2026-09-16 (PR-113) |
| [copy-product](specs/copy-product/) | An org starts a new product from one of its own — description, category, attributes and flags carried, identity and price left behind | ✅ Implemented — 2026-09-23 (PR-147) |

`product-archive` is catalogue *lifecycle* rather than page capability, and lands here because it is the phase that owns the catalogue; it needs nothing from the rest of the phase and nothing in the phase needs it.

Ordering does not bind this phase to the ones before it, with one exception: `product-video` replaces `Product.images` with a `ProductMedia` relation, so it is a `[CONTRACT]` change on the product DTO and wants the [CONTRACTS.md](CONTRACTS.md) consolidation on the watch list below not to be mid-flight when it lands.

## Phase 7 — Promotions & settlement

A new phase, added 2026-08-15. It pairs two features that look separate and are not: the moment the platform and an organisation can both discount the same item, "what did this order earn" stops being a subtraction and becomes a question about who funded the discount. A ledger built without that answer would be wrong from its first row.

| Spec | Requirement | Status |
|---|---|---|
| [promotions](specs/promotions/) | The platform and each organisation can run time-boxed offers, applied automatically or unlocked by a coupon code | 🔨 In progress — PR-67 |
| [org-payouts](specs/org-payouts/) | A record of what each organisation has earned, what the platform kept, and what is still owed | 🔨 In progress — PR-67 |

Strictly ordered: `promotions` before `org-payouts`. The ledger reads the funding split each discount records, so building it first would mean writing entries whose attribution is a constant zero and then migrating them.

`promotions` reaches back into the catalogue: it removes `Product.salePrice` and re-expresses each markdown as an organisation-funded offer, which makes it a `[CONTRACT]` change on the product and cart DTOs. That is deliberate rather than incidental — a markdown is an organisation's own offer, and an offer outside the comparison can be neither weighed against a platform offer nor attributed to whoever paid for it.

`org-payouts` is a ledger, not a payments integration. Money continues to move by bank transfer; what it adds is the record of how much and whether it has gone.

---

## Phase 8 — Bidding

A new phase, added 2026-09-09. A fixed price cannot find out what a one-off item is worth, and a bidding link is also the one thing a product page is not — a reason to share, with a deadline and a number that moves.

| Spec | Requirement | Status |
|---|---|---|
| [bidding](specs/bidding/) | An organisation puts one product up for timed bidding on a shareable link; the platform sells it directly and records what it fetched | ✅ Implemented — PR-97 |

Depends on Phase 7. The amount a bidding sale fetches is what the organisation is owed, so it has to reach the same ledger `org-payouts` builds rather than a parallel one.

Two things about this phase are deliberate and easy to mistake for gaps. **Settlement is by hand:** the platform speaks to the winning bidder directly and enters the price it sold for, so no payment flow is built and the figure an organisation is paid on is one a person types. **Nothing runs on a schedule:** an event ends because its end time has passed, observed whenever it is next looked at, so correctness never rests on a job having run.

It also lands the store's first real purchase gate. Adding to cart checks nothing today and stock is enforced in exactly one place — the order transaction — so suspending sale during an event has to hold at that same point, and the same seam is what any future reason to bar a purchase will use.

## Phase 9 — Seller storefronts

A new phase, added 2026-09-15. Phases 1–8 built a marketplace; this is the first that builds something *for the seller to show people*. A small shop that joins today becomes invisible — the organisation owns products, offers, shipments and earnings, and is rendered nowhere a buyer can see, so the trade it made was its shopfront for a catalogue row. This phase gives it back an address.

| Spec | Requirement | Status |
|---|---|---|
| [org-storefront](specs/org-storefront/) | Every organisation has a storefront at a link it can promote: its own landing and about pages, its own goods, its own search | ✅ Implemented — **7 subfeatures** |

Depends on Phase 3's [multi-vendor-marketplace](specs/multi-vendor-marketplace/), which built the organisation this phase makes public — and **reverses one of its recorded out-of-scope lines** (*"per-organisation branding, domains, or storefronts"*). That reversal needs an ADR before the first PR; it is a change of direction, not an oversight being corrected.

Three things about this phase are deliberate. **A storefront is a projection, not a second shop:** same catalogue, same price resolver, same basket, same checkout — so nothing on the money path moves and an order spanning two organisations still splits exactly as it does now. **It is a path, not a subdomain:** `/store/<handle>` on the platform's domain, so search authority pools into one site and no wildcard DNS or per-domain certificate has to be operated; a subdomain stays available later as a redirect to the same canonical URL. **Branding is fields, not a page builder:** an accent from the declared palette and validated copy, so [ADR-0022](adr/0022-design-decisions-go-through-tokens.md) keeps holding and no seller can break a layout.

One subfeature closes a gap that exists **today**, independent of storefronts: [org-withdrawal](specs/org-storefront/org-withdrawal/). `Org.isActive` is set by the console and read by nothing a buyer sees — no catalogue or storefront query filters on it — so deactivating an organisation currently leaves every product it sells listed and purchasable. Since this phase publishes public pages under the platform's name with no approval in front of them, the remedy has to work before that is defensible, and it is the one piece here that touches the marketplace read path rather than only the storefront.

Two existing watch-list entries below become load-bearing here rather than merely open: **storefront reads are uncached and unpaginated** — a shared link is precisely the URL that gets a traffic spike — and **the inherited WordPress index**, since this phase adds a new public URL namespace into one that crawlers are still working through.

---

## Phase 10 — Discoverability

A new phase, added 2026-09-19. Phases 1–9 built a marketplace and gave its sellers a shopfront; none of them made any of it findable. Organic search is the store's only acquisition channel — there is no ad budget — and an e-commerce result is won on price, stock and stars appearing beneath the title, which appear only for a site that declares them. The store declares nothing today.

| Spec | Requirement | Status |
|---|---|---|
| [seo](specs/seo/) | Every public page describes itself, every product is machine-readable at the price it is actually sold for, and every URL answers with the status that is true of it | 📝 Draft |
| [store-policies](specs/store-policies/) | One public page states how the store ships, cancels, returns, refunds and handles data, in words that match what it actually does | 📝 Draft |

Sequenced after Phase 9 rather than before it, because storefronts add a public URL namespace and the rules for what gets indexed should be settled once, across both. The overlap is deliberate and bounded: [storefront-discovery](specs/org-storefront/storefront-discovery/) owns `/store/<handle>`, [seo](specs/seo/) owns the marketplace, and the two state the same rules for their own surfaces rather than one importing the other.

Two of this phase's constraints come from earlier decisions rather than from search practice. [ADR-0018](adr/0018-one-effective-price-function.md) means a machine-readable price is a second surface needing the same per-request resolution, so nothing here may be cached past an offer window — the declared price and the displayed price have to be the same value, not two readings of one. [ADR-0023](adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md) means availability is decided by the clock and not by a field, so an item held by a live bidding event must not be declared purchasable even though nothing on the product says it isn't. Getting either wrong is a Google policy violation rather than a display bug.

It also closes the **soft 404** entry on the watch list below, which has been open since it was recorded: the fix is one of four PRs here rather than a standalone commit, because the missing `not-found.tsx` and `error.tsx` boundaries are what make 404 and 500 separable at all.


## Phase 13 — Design system

Added 2026-11-04 from the platform UI audit. Programme overview: [design-system](specs/design-system/); every decision in its decisions.md.

| Spec | Requirement | Status |
|---|---|---|
| [design-system/foundations](specs/design-system/foundations/) | Type scale (phone first), icon seam on Phosphor, motion and depth tokens, the gates | 🔨 Built 2026-11-04, awaiting owner review |
| design-system/page-grammar | One page header, action bar, empty/error/loading state, tabs, status badge, list-or-table | 🔨 Built 2026-11-04, awaiting owner review |
| design-system/storefront-journey | Home, category and search, product page, cart, checkout, order page | 🔨 Built 2026-11-04, awaiting owner review |
| design-system/seller-workspace | Products list for a phone with bulk edits, top bar, orders | 🔨 Built 2026-11-04, awaiting owner review |
| design-system/admin-console | Grouped navigation, dashboard led by one figure, dense tables | 🔨 Built 2026-11-04, awaiting owner review |
| design-system/brand-icons | 6–10 brand icons drafted by Claude, approved by the owner | 🔨 Built 2026-11-04, awaiting owner review |
| design-system/image-slots | One picture field with phone and desktop versions, crop or fit, for admin and shop banners | 🔨 Built 2026-11-04, awaiting owner review |
| design-system/render-performance | Build on the caching that landed on main | planned |
| [navigation-flows](specs/navigation-flows/) | Every feature finishes and exits back where it started, one step at a time, without losing typed work | ⏸ Parked 2026-11-12: listing fix loop and the three address fixes shipped; the rest waits (audit.md is the worklist) |
| navigation-flows Q13 *(later)* | Buyer returns and refunds: no flow exists today | parked |
| navigation-flows Q14 *(later)* | Marketplace read and stock-sync wording for sellers | parked |
| storefront-look Q9 *(later)* | The marketplace home banner without a shade, as storefronts | parked |
| design-system Q13–Q17 *(later)* | Admin chart, auth and /sell, `shared/forms/product` move, ⌘K, view transitions | parked |

---

## Phase 12 — The shop's own store

Added 2026-10-29: track 1 of three (see *Three tracks*). Programme overview: [own-store](specs/own-store/); every decision in its decisions.md.

| Spec | Requirement | Status |
|---|---|---|
| [own-store/offers-hardening](specs/own-store/offers-hardening/) | No offer costs the platform more than it chose to spend | ✅ Implemented — 2026-10-29, units 1–6 on branch offers-hardening |
| [own-store/order-fulfilment](specs/own-store/order-fulfilment/) | Shop marks a parcel ready, the platform books pickup, buyer and shop see one timeline; cancellation; one email matrix | 🔨 UX signed off 2026-10-30; TRD and build next |
| own-store/product-form | Create and edit in short steps on a phone; admin can help a shop | planned |
| own-store/bulk-sheet | Template with instructions and dropdowns, version-stamped; errors returned in the seller's own file | planned |
| own-store/seller-onboarding | Task home, setup list, grouped navigation, phone tab bar, in-place creation | planned |
| own-store/org-profile | Essentials only; contact and legal editable; tax and bank asked at first payout | planned |
| own-store/storefront-themes | Four templates, own header with the platform's logo and contacts, shared cart, "Visit {Shop name}" | planned |
| [own-store/storefront-look](specs/own-store/storefront-look/) | Every template on the platform type scale, a first phone screen never bare, banners vivid with no shade | 🔨 UX signed off 2026-11-13; TRD drafted |
| [own-store/storefront-font](specs/own-store/storefront-font/) | A shop picks its store's heading font from a short curated list; sizes stay the platform's | 🔨 UX signed off 2026-11-13; TRD drafted |
| storefront-font Q3–Q5 *(later)* | Body-font choice, fonts on request, non-Latin scripts | parked |
| offers-hardening Q8 *(later)* | A shop ending its own markdown just before a platform campaign | parked |
| offers-hardening Q10, Q13 *(later)* | Coupon use and ledger reversal for an order cancelled before dispatch or before payment | parked, order-fulfilment |

---

## Phase 11 — Listing: one entry, every channel

A new phase, added 2026-09-25. The seller's real cost is not the storefront; it is describing the same product four times — Amazon, Flipkart, Meesho, the store — and photographing it badly once. The wedge is one entry that is ready for every channel, with the photographs as the primary evidence of what the product is and a phone photo turned marketplace-grade in one tap. Marketplace publishing itself comes later; this phase builds what it needs and measures itself against the seller's current 5–10 minutes per Amazon listing.

| Spec | Requirement | Status |
|---|---|---|
| [worker-foundation](specs/worker-foundation/) | The queue in our Postgres and the worker we own, with nothing in it: health in admin, per-org fairness, a machine rebuilt by one script ([ADR-0038](adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)) | ✅ Implemented — PR-150, PR-154, PR-210 (2026-09-29) |
| [seller-profile](specs/seller-profile/) | A private face for what listing needs (brands, manufacturers, origin, tax codes) and a public face for what a buyer may see; nothing demanded before it is needed | ✅ Implemented — PR-151, PR-162, PR-175, PR-182, PR-184, PR-208 (2026-09-28) |
| [media-library](specs/media-library/) | Every stored image is a record with dimensions, source and uses; galleries fill by named slot; capture is guided on the phone | ✅ Implemented — PR-152, PR-161, PR-163, PR-177, PR-178, PR-209, PR-211 (2026-09-29) |
| [seller-profile/brand-page](specs/seller-profile/brand-page/) | The about page becomes a brand landing page: hero, derived proof, story with a real person, category tiles, newest goods, terms, one call to shop; finished when the seller has written one line | ✅ Implemented — PR-182, PR-184, PR-208 (2026-09-28) |
| [media-library/renditions](specs/media-library/renditions/) | Surfaces declared once; a rendition made on demand from the source or the seller's crop, kept as a derived image | ✅ Implemented — PR-211 (2026-09-29) |
| [media-library/video-hosting](specs/media-library/video-hosting/) | A short video uploads from the phone like a photograph; the worker makes the sizes that play, and it is an image's peer in the library | ✅ Implemented — 2026-09-27 (PR-180, PR-181, PR-183) |
| [media-library/viewer](specs/media-library/viewer/) | Any library item full screen, swiping through the rest; the original saved to the device | ✅ Implemented — 2026-11-25 (5ab6d8bd, 69033278, 94a656e9) |
| [media-library/bulk-actions](specs/media-library/bulk-actions/) | Select many library items; download as one zip, retire, or tag them together | 🔨 Built 2026-11-25, awaiting owner review |
| [media-library/picker-filters](specs/media-library/picker-filters/) | The library picker filters by tag, usage, source and date, as the Library page does | 📝 Accepted — 2026-11-24; ready to build |
| viewer Q6 *(later)* | The full-screen viewer on surfaces other than the Library | parked |
| bulk-actions Q8 *(later)* | Selecting library items beyond what is loaded | parked |
| bulk-actions Q9 *(later)* | Bulk crop or improve | parked |
| picker-filters Q4 *(later)* | Search the picker by product name | parked |
| [image-enhancement](specs/image-enhancement/) | A phone photo becomes a marketplace-grade image on demand — cut out, on white, in a studio, in a scene, brightened, enlarged — each a tool applied alone, each result accepted or discarded | ✅ Implemented — PR-185, PR-190, PR-191, PR-193, PR-198 (2026-09-28) |
| [listing-vocabulary](specs/listing-vocabulary/) | One description of a product that every surface and every channel reads — split into three subfeatures below | ✅ Implemented — PR-236…PR-253 (2026-10-04) |
| [listing-vocabulary/categories](specs/listing-vocabulary/categories/) | Nine categories, each naming the kinds it holds and the few questions it asks; measurements stored, size labels derived | ✅ Implemented — PR-236…PR-246 (2026-10-03) |
| [listing-vocabulary/variants](specs/listing-vocabulary/variants/) | Anything that sells on its own is its own product with its own stock; the category declares what varies | ✅ Implemented — PR-247, PR-249, PR-250 (2026-10-04) |
| [listing-vocabulary/inherited-facts](specs/listing-vocabulary/inherited-facts/) | A blank fact filled from the family, the brand or the shop's defaults, stored on the product and shown with its origin | ✅ Implemented — PR-227, PR-253 (2026-10-04) |
| [listing-vocabulary/product-types](specs/listing-vocabulary/product-types/) | The question sets become rows an admin creates and edits, so onboarding a seller with a new product line does not wait for a developer | ✅ Implemented — PR-236, PR-237, PR-238, PR-240, PR-241 (2026-10-03) |
| product-form | Minimum to save, inherited values marked with their source, facts asked at the point of need and written back to the brand, photo-derived suggestions confirmed before use | ⚠️ Mostly built — the form asks the type's questions and marks inherited values (PR-244, PR-253); photo-derived suggestions remain, unspecified |
| product-form/bulk-sheet | One sheet for several product types at once, Amazon's shape rather than Flipkart's one-per-node; permitted values as dropdowns; **creates and updates by SKU**, so an existing catalogue is fixed in one upload rather than one form at a time | ✅ Implemented — PR-248, PR-251, PR-252 (2026-10-04) |
| [channel-registry](specs/channel-registry/) | Channels classed by where the sale completes; category, attribute and value mappings as versioned data; readiness answered before publishing rather than after a rejection, advising and never gating | ✅ Implemented — PR-255…PR-267 (2026-10-04) |
| [channel-registry/readiness-fix](specs/channel-registry/readiness-fix/) | The products card names each channel's missing facts; one page per fact answers it for many products, saved as picked | 🔨 Built 2026-11-03, uncommitted; waiting for the owner's check on a phone |
| [shopfront-feeds](specs/shopfront-feeds/) | One feed file at a URL that Google Shopping and Meta both fetch. First real publishing, and it needs approval from nobody | ✅ Implemented — 2026-10-14 |
| [marketplace-integration](specs/marketplace-integration/) | Overview: one master product per item, one stock figure, Flipkart and Amazon run from here. Eight subfeatures below, in order; decisions in its decisions.md | 📝 Draft — 2026-10-20 |
| [marketplace-integration/channel-connectors](specs/marketplace-integration/channel-connectors/) | Connect an Amazon or Flipkart account by consent and see its health. The trial of ADR-0061 | ✅ Implemented — 2026-10-21, both connected on the owner's accounts |
| [marketplace-integration/channel-import](specs/marketplace-integration/channel-import/) | Every listing on a connected marketplace arrives in an inbox; exact-SKU matches link themselves | ✅ Implemented — 2026-10-21, Amazon and Flipkart listings read on the owner's accounts |
| [marketplace-integration/product-merge](specs/marketplace-integration/product-merge/) | The owner settles every not-linked listing: match, add as new, or leave off; one product per item across both marketplaces | ✅ Implemented — 2026-10-23, Settle, match, leave off and photo copy checked by the owner |
| [marketplace-integration/marketplace-facts](specs/marketplace-integration/marketplace-facts/) | A listing's attributes and details fill its product where empty, the rest asked once per product; Amazon's mappings built | ✅ Implemented — 2026-10-25, facts on the Settle page and the product card checked by the owner |
| [marketplace-integration/family-merge](specs/marketplace-integration/family-merge/) | An item's colours (or bottle sizes, platings, packs) from a marketplace become one family of products; Amazon's groups used, Flipkart's grouped by the owner | ✅ Deployed 2026-11-01; waiting for the owner's phone check |
| [marketplace-integration/channel-listings](specs/marketplace-integration/channel-listings/) | Each product's Amazon and Flipkart listing on its own screen: inherits the product, keeps only what differs, locks what must match, shows what the marketplace has | 🔨 Built 2026-11-02, uncommitted; waiting for the owner's check on a phone |
| [marketplace-integration/inventory-sync](specs/marketplace-integration/inventory-sync/) | A sale or cancellation anywhere moves one stock figure; daily resync finds differences. On a subscription this is the product, not a late phase | ✅ Deployed 2026-11-01; sync paused on Amazon until turned back on |
| family-merge Q13 *(later)* | Pairing a family's Amazon and Flipkart listings member by member in one step | parked, after channel-listings |
| family-merge Q15 *(later)* | A family's own photographs | parked, with marketplace-publish |
| inventory-sync Q14 *(later)* | Returns, through inspection before stock is real again | parked, its own feature |
| inventory-sync Q5 *(later)* | Stock held in Amazon's warehouse (FBA) | parked, if a shop uses FBA |
| inventory-sync Q21 *(due before 2027-03-27)* | Move Amazon's order check from the Orders API v0 to `searchOrders` (2026-01-01), after confirming its response shape on a live order | planned |
| [marketplace-integration/marketplace-publish](specs/marketplace-integration/marketplace-publish/) | Review and publish listing changes and new listings (families too) to Amazon, price and pause to Flipkart; each answer back on its field | 🔨 Built 2026-11-02, uncommitted; waiting for the owner's check on a phone |
| [listing-model](specs/listing-model/) | Overview: one BB product holding every channel's attributes (Amazon, Flipkart, Meesho, Google, Meta); each channel's own catalogue; one mapping layer. Five subfeatures, one release; ADR-0070 | 📝 Draft — 2026-11-07 |
| [listing-model/channel-catalogue](specs/listing-model/channel-catalogue/) | Each channel's types and fields stored with what they require; readiness names every required field missing, before sending | 📝 Draft — 2026-11-07 |
| [listing-model/field-maps](specs/listing-model/field-maps/) | One map per channel field, made by Claude from each channel's own documentation; admin read-and-edit | 📝 Draft — 2026-11-07 |
| [listing-model/attributes](specs/listing-model/attributes/) | Attributes and typed values as rows a developer adds; brand parties fill compliance attributes; type follows category | 📝 Draft — 2026-11-07 |
| [listing-model/dynamic-form](specs/listing-model/dynamic-form/) | The form asks every channel's attributes, required for connected ones; per-channel completeness; brand parties | 📝 Draft — 2026-11-07 |
| [listing-model/retire-old-paths](specs/listing-model/retire-old-paths/) | Old fact list, facts column and old map tables removed in the same release, after a full comparison | 📝 Draft — 2026-11-07 |
| [setup-requests](specs/setup-requests/) | Two tickets for what a shop can't fix itself: a requirement the app raises and the admin enables with one tap or one decision (Amazon fields, Amazon category); an issue the shop writes under a category, fixed by a developer | 🔨 Built 2026-11-05, uncommitted; waiting for the owner's check (set `HOME_BRAND_ORG_ID`) |
| setup-requests: value match | Amazon rejects our answer for a field: a third kind on the same engine (setup-requests Q16) | ⏸ Later |
| setup-requests: product type | A listing being settled matches none of our types: a kind on the same engine (Q17) | ⏸ Later |
| setup-requests: Flipkart and other audiences | Each a new kind once the engine exists (Q20) | ⏸ Later |
| channel-listings Q17, Q18 *(later)* | Amazon search keywords; editing many listings at once | parked |
| marketplace-publish Q20, Q21 *(later)* | Instant answers by Amazon notification (AWS queue); a business price | parked |
| channel-reporting | What sold where, per channel and consolidated, each figure naming the channels it covers and when each last reported | planned |
| instagram-post | A post draft generated only on explicit intent, replaceable, regenerable, skippable; manual share first. Separate from the Meta catalogue, which is a shopfront feed | planned |
| [subscriptions/feature-access](specs/subscriptions/feature-access/) | The admin locks or unlocks Channels, Storefront and Image enhancement per shop; every screen, route, job and public page honours it | ✅ Built 2026-11-12 on `feat/feature-access`; set `HOME_BRAND_ORG_ID` before deploying |
| subscriptions/billing | Collecting ₹699 a month (one flat price, no tiers, no per-seat) and flipping the same switches; needed before anyone is charged (feature-access Q21–Q23) | planned |

The four foundations are done: the worker, the shop's profile, the media library and photo
enhancement. What follows was re-sequenced on 2026-09-29 after a spike into what the platforms
actually require ([INTEGRATIONS.md](INTEGRATIONS.md)), and it is ordered by what it costs to prove
rather than by ambition.

`listing-vocabulary` first, because it improves the listing form itself and depends on nobody
outside. Then `channel-registry`, which makes "is this ready for Amazon" answerable without
publishing anything. Then `shopfront-feeds`, the first real publishing, chosen third because
Google and Meta come and fetch a file and so need approval from no one — which makes it the
honest test of whether the mapping layer works. Only then `channel-connectors`, and marketplace
publishing behind it.

`inventory-sync` and `channel-reporting` sit late in the line and are not late in importance. The
revenue is a flat subscription ([ADR-0044](adr/0044-a-marketplace-orders-money-is-reported-not-computed.md)),
so nobody renews for having listed once; they renew because their stock stayed right across five
platforms and one screen told them what sold. Publishing is what makes those two possible.

Two things run on other people's calendars and should start before the code that needs them.
Amazon requires a **Professional** selling account before any API conversation, and its public
developer registration wants a publicly reachable site describing the service to sellers. Meesho
has no public API at all: an integrator is whitelisted by relationship, then each shop is enabled
by email. Both are scheduling dependencies rather than engineering ones.

Three rules from earlier phases bind the whole of it: the server stays the sole authority on money
([Invariant 1](../CLAUDE.md)) wherever we run the checkout, and where we do not the amount is
reported rather than computed ([ADR-0044](adr/0044-a-marketplace-orders-money-is-reported-not-computed.md));
the host constrains operations, never design ([ADR-0037](adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md)).

---

## Cross-cutting watch list

Not a phase, but tracked:

- **Public contact and brand facts are hardcoded in `src/lib/config.ts`** — the support email and
  WhatsApp number that "Contact us" and the admin links use, from the 2026-10-23 marketplace-facts
  decisions (Q12). `config.ts` keeps public brand facts in code by design. Decide whether to move the
  contact details to environment variables, so they can change without a redeploy, and whether the
  support email should be a business address rather than a personal one. Owner's call.

- **The seeded listing values held near-duplicates** — resolved 2026-10-04 (PR-246). The union
  of two platforms' vocabularies gave one concept two entries wherever they worded or spelled it
  differently. The owner chose the trade's word where it was a judgement ("full sleeves is the
  correct term"); the rest followed a stated convention. Discarded forms are retired rather than
  deleted, because each is what one platform writes and the mapping layer will need it.

- **The existing models have never been checked against current practice** —
  [ADR-0046](adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md) requires it
  of anything new, and everything built before it was reasoned from this codebase alone. Worth one
  focused pass over the stored shapes in the schema, the job queue, the caching approach, the
  image pipeline and the auth handling, asking of each what the field does now. Deferred by
  decision on 2026-09-29 so it does not swallow the listing phase; it is a piece of work in its
  own right, not a line item inside another.

- **The client/server contract** ([CONTRACTS.md](CONTRACTS.md)) — consolidating duplicate DTO declarations is a precondition for several specs above. Changes carry `[CONTRACT]`.
- **Repository consolidation** ([ADR-0003](adr/0003-one-repository-per-aggregate.md)) — the *structural* half is done: `server/` is now one directory per domain ([ADR-0012](adr/0012-modules-are-vertical-slices-by-domain.md), CHANGELOG PR-02), so each aggregate has exactly one home. What remains is merging the duplicate repository *modules* that now sit side by side inside a domain — e.g. `catalog/product.repository.ts` and `catalog/admin.product.repository.ts` both read `prisma.product`. That is a behaviour-affecting merge, so it belongs with whichever spec touches the aggregate.
- **Error-envelope adoption** ([ADR-0013](adr/0013-one-error-envelope-and-useserverform.md)) — every handler under `/api/admin` now returns through `toErrorResponse` (PR-21, PR-25). Remaining: the signup, forgot-password, reset-password and provider-connect **forms**, the bidding panel's guest details (`BidPanel` — its phone field moved to `PhoneInput` in PR-102 without the conversion, which would rewrite the bid submit flow), and the non-admin handlers they post to. Decision 7 makes conversion obligatory when a file is touched, so this shrinks as work happens rather than needing a dedicated sweep.
- **Duplicate declarations** ([ADR-0003](adr/0003-one-repository-per-aggregate.md)) — runtime symbol names resolved in PR-08 (14 → 2). Two remain, both deliberate: `formatCurrency` is behaviourally identical, and `isValidPincode` needs the decision below. The 26 remaining *type* duplicates are the [CONTRACTS.md](CONTRACTS.md) work.
- **Phone-based sign-in and recovery are blocked, not merely unbuilt** ([ADR-0024](adr/0024-phone-is-contact-data-not-an-identity-key.md)) — since PR-103 a phone number may back any number of accounts, so OTP login, "recover my account by phone" and any dedupe-by-number all lose the assumption they rest on. Each needs a way to disambiguate *which* account before it can be built, and that is its own ADR. Phone is also no longer any signal against throwaway accounts.
- **A guided shoot needs a native camera.** [media-library](specs/media-library/) checks photos after they are chosen because a web page's camera button opens the phone's camera app and hands back a file; an in-browser viewfinder would give live framing and a shot sequence but forfeits the phone's own image processing and fails inside in-app browsers. If a native app is ever built, the guided shoot — front, back, label, one tap each — is its first feature.
- **Courier phone format** — every phone has been E.164 since [international-phone](specs/international-phone/) (PR-102), and may be non-Indian. What Shiprocket accepts for a pickup or delivery phone is unverified, and must be known before [shipping-fulfilment](specs/shipping-fulfilment/) books real parcels.
- **PIN code validation** — consolidated to one rule in PR-09 (eleven declarations → one). Remaining: query existing `Address` rows for PIN codes with a leading zero, which the tightened rule rejects on update.
- **Error swallowing in the data layer** — PR-13 fixed `products.dal.ts`; the same catch-and-relabel pattern remains in the other DAL modules and in `server/catalog/product.repository.ts`, where a query failure is reported as `"Product not found"`. Preserve `cause`; keep absence distinguishable from failure.
- **Sale price is read two different ways** — `src/components/shared/PriceDisplay.tsx` treats a sale price as an offer only when it is positive and below the regular price, matching `effectiveUnitPrice` in `server/checkout/pricing.ts`. Eight other sites — the cart line, the checkout summary, the shipping-rate hook, both order detail pages, the org parcel value — simply fall back with `??`, so a sale price of zero or one above the regular price renders differently depending on where the buyer is looking. [promotions](specs/promotions/) PR 3 consolidates them onto the one function; until then it is a display inconsistency on the money path.
- ~~**A sold product cannot be taken off the storefront**~~ ✅ Closed — PR-112 made the refusal honest and PR-113 made it avoidable: a product leaves sale by archiving ([ADR-0029](adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md), [product-archive](specs/product-archive/)). Hard delete survives only for a product no record depends on.
- **Soft 404 on a missing product** — a slug that does not resolve returns HTTP 200 with an error page rather than a real 404. `notFound()` on `NotFoundError` fixes it; matters for search-engine handling. Now owned by [seo](specs/seo/) R7, Phase 10 — it needs the `not-found.tsx`/`error.tsx` boundaries that do not exist yet, so it is not the one-line change this entry assumed.
- **Route the database through Prisma Accelerate** — it is already provisioned (`PRISMA_DATABASE_URL`) and read by nothing. Pooling and caching at the proxy addresses serverless connection pressure more thoroughly than tuning `max` on the local pool. See [OPERATIONS.md](OPERATIONS.md) § Infrastructure.
- **Storefront reads are uncached, and page-level ISR cannot fix it** — PR-82 and PR-83 turned prefetch off at all 61 link sites (storefront, then the portals), which removed the speculative load but not the per-request cost: a category page is still roughly three sequential round trips, and it renders identical HTML for every visitor. Nothing under `src/app/(main)` reads `cookies()`, `headers()` or the session on the server — the auth-aware chrome is all `"use client"` on `useSession()` — so there is nothing per-user in the render to justify repeating it.

  The obvious fix is barred: [ADR-0018](adr/0018-one-effective-price-function.md) caps offer resolution at one request and states that response caching and ISR must not outlive an offer window, so a fixed `revalidate` would advertise an expired offer's price. **What is available is caching the reads that carry no resolved price** — the category tree (`categoriesDAL.getDescendants`/`getAncestors`, one shared tree read) and the catalogue rows — while the live offer set and price resolution stay per-request, which is what the ADR actually constrains. Pairs with the Accelerate entry above; do that first and measure, since proxy-level caching may cover part of it.

  Once those reads are cached, revisit prefetch rather than leaving it off permanently: a `loading.tsx` boundary plus a non-zero `experimental.staleTimes.dynamic` (it defaults to `0`, which is why the prefetches were discarded) would make it pay off on a page that no longer costs a database round trip.

- **`Shipment.status` has three vocabularies, and the fix is specced** — the type declares nine values, the schema comment four different ones, and the code writes a third mix (`api/admin/shipments/[id]/tracking` writes `"shipped"`, which the type does not contain). A courier reporting *in transit* already stores a value no admin badge matches, so the row renders unstyled. [shipment-lifecycle](specs/shipment-lifecycle/) designs the canonical set, the return leg, and what each state means for stock, refunds and settlement. **One open question blocks it:** whether `LOST` restocks.
- **Server-by-default is done** ([ADR-0034](adr/0034-render-on-the-server-by-default.md)) — `tests/unit/rendering-strategy.test.ts` refuses a new client `page.tsx` or `layout.tsx`, and **both allowlists are empty**: not one page or layout in the tree opts its subtree out. Ten did when the gate landed. What the conversions left behind is the next entry.

- **One pair of handlers needs a screen rather than a deletion** — `tests/unit/route-reachability.test.ts` resolves every `/api/...` string in the app against every route file, and its `UNREACHABLE` list is down to `PATCH`/`DELETE /api/admin/payouts/entries/[id]`: correcting and removing an unsettled ledger entry, built and never given a control. That is a decision, not a deletion — the console gets the control, or the handlers go. The nine `GET`s the server-component conversions orphaned are gone, with the two client modules that called them.
- **Domain decoupling is enforced, with 13 cross-domain repository imports allowlisted** ([ADR-0033](adr/0033-a-domain-is-reached-through-its-public-surface.md)) — each entry in `tests/unit/module-boundaries.test.ts` names the service method the owning domain needs to grow. `payouts` → `checkout/order.repository` is the one worth doing first: settlement reading order rows directly is how `VISIBLE_ORDER_WHERE` could silently stop applying.
- **Security response headers exist as of PR-117** — a nonce-based CSP built per request in `src/middleware.ts` from `src/lib/security-headers.ts`, plus HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`. `script-src` carries no `'unsafe-inline'`. `CSP_REPORT_ONLY=1` downgrades enforcement without a code change — the escape hatch if a policy change breaks a page, not a place to leave things.
- **Lint still does not block** — `.github/workflows/ci.yml` keeps `continue-on-error: true` on the lint step. 40 `no-explicit-any` errors remain, down from 81; **`src/app/api/` is at zero**, which was the priority since that is the trust boundary. The rest are in admin pages, hooks and the shipping provider layer. The flag comes off when they do ([TESTING.md](TESTING.md)).
- **The courier webhook is authenticated since order-fulfilment unit 4** — `POST /api/webhooks/shipping/courier` (not named for the carrier: Shiprocket refuses such a URL) requires the token typed beside its URL in Shiprocket's dashboard (`x-api-key`, compared in constant time), answers 401 without it and 500 on a failure, and records an update it cannot apply on the admin's conflict list. Watch: set `SHIPROCKET_WEBHOOK_TOKEN` in every deployment and register the new URL with it — until then every courier update is refused.
- **Rate limiting is enforced through one registry (2026-10-29)** — every public route is limited under a policy or exempt with a reason, and a deploy without the store's configuration is refused ([rate-limiting](specs/rate-limiting/)). Watch: the development store in the local `.env` no longer resolves, so confirm each Vercel environment's store is live; a store outage fails open and is only logged until error-tracking adds the alert.
- **This domain served a WordPress site before this one, and search engines still hold its index** — the archive has 4,682 URLs for `bhendi-bazaar.com`. Genuine Bhendi Bazaar posts from 2019–2020 (`explore-bhendi-bazaar`, `ashara-ohbat-1442`), then from March 2021 a turn into Indonesian gambling spam (`situs-judi-slot-gacor`, `apakah-legal-bermain-di-kasino-online`), scraped filler, and adult posts — still serving 200s as late as September 2025. The two shapes share one permalink structure, which reads as a compromised WordPress install rather than a resale, though that cannot be established from outside. Bing is still crawling it: two such requests arrived 0.74s apart on 2026-08-30.

  PR-81 answered the code half — `src/app/robots.ts` and `src/app/sitemap.ts` state what exists, and `src/middleware.ts` returns **410 Gone** for the `/YYYY/MM/DD/` shape so crawlers retire those URLs instead of retrying a 404. **What remains needs an account, not a commit:**
    - Verify the domain in **Google Search Console** and **Bing Webmaster Tools**, and check both for a manual action inherited from the gambling era — one would cap the store's ranking regardless of the store's quality.
    - Submit the sitemap in each, and use removals for the old URL set.
    - Review the backlink profile; gambling and adult inbound links are disavow candidates.
    - Confirm `NEXT_PUBLIC_APP_URL` is set in the Vercel production environment — `appUrl()` throws without it, and both `robots.txt` and `sitemap.xml` are built from it.

- **Two idioms for every cross-cutting job in a route handler** — validation is `schema.parse(await request.json())` in 32 handlers and `validateRequest(request, schema)` in 11; errors are `toErrorResponse` in 57 files and a bare `NextResponse.json({ error })` in 19, with **13 files using both**. Neither split is a correctness bug today — 43 of 52 mutating handlers do validate, and the 9 that do not are uploads taking FormData, signature-verifying webhooks, and no-body actions. The cost is that a reviewer cannot tell a correct handler from an incorrect one by shape. [ADR-0013](adr/0013-one-error-envelope-and-useserverform.md) already makes error conversion obligatory on touch; validation wants the same rule and one chosen idiom.

- **Validation schemas live in `src/` and the server reaches out for their types** — `server/catalog/org.service.ts`, `server/bidding/bidding.service.ts`, `server/promotions/admin.promotion.service.ts` and `server/payouts/ledger.service.ts` each `import type` from `src/lib/validation/schemas/`, which is the direction CLAUDE.md forbids. `CreateOrgInput` was the tractable half and now lives in `server/catalog/org.types.ts` with `src/domain/org.ts` re-exporting it. The remaining three are `z.infer` of schemas the forms also consume, so inverting them means **moving the schemas themselves into `server/`** — defensible (`src/` may import from `server/`, and a zod schema is isomorphic) but it changes where every form imports from, so it is a decision needing an ADR rather than a drive-by edit.

- **`ProductFilter` is declared twice and has already drifted** — `server/catalog/product.types.ts` carries `categoryIds`, `limit` and `offset`; the copy in `src/domain/product.ts` carries none of them. The client's is a strict subset today, so nothing is broken, which is exactly how `ProductFlag` drifted before it. Part of the [CONTRACTS.md](CONTRACTS.md) type-duplication work; 20 exported type names are duplicated across `server/` and `src/`, `ProductFilters`, `UpdateProfileInput` and `CreateOrderWithShipmentsInput` at three declarations each.

- **`ProductFlag` is declared three times, and TypeScript enums are nominal** — `server/catalog/product.flags.ts`, `src/types/product.ts` and `src/types/shared.ts`. Two of them cannot be assigned to each other even though their members are identical, which is why narrowing at the data layer had to pick the one the domain type happens to use. CLAUDE.md already cites this symbol as the reason for the no-magic-strings rule; it is still three.

- **Prune unused connection strings from `.env`** — `POSTGRES_URL`, `DB_URL`, `REDIS_URL`, `KV_URL`, `PRISMA_DATABASE_URL` are read by nothing. Several live connection strings in one file is the hazard behind [Invariant 7](../CLAUDE.md).
- **Slug redirects** — slugs are now generated and frozen (PR-15), but there is no redirect for a slug that changed before that rule existed. One product's URL moved (`product test 001` → `product-test-001`); the old URL 404s. If slugs ever need to change again, a slug-history table or redirect is required.
- **Existing products all weigh 0.5 kg** — weight was collected and never persisted until PR-22, so every row created before it carries the schema default. [product-weight-and-rates](specs/product-weight-and-rates/) R6; rates are wrong in both directions until the catalogue is corrected.
- ~~**`Product.categoryId` cascades on delete**~~ ✅ Closed — the `category_tree` migration moved it to `onDelete: Restrict` on 2026-08-10 (`prisma/migrations/20260810120000_category_tree/`); this entry stayed open for six days afterwards because the fix was a local judgement with nothing to check the watch list against. Now a stated rule: [ADR-0020](adr/0020-money-bearing-records-never-cascade.md).

- **Documentation system** — see [the changelog archive](archive/CHANGELOG-HISTORY.md), 2026-08. The pre-2026-08 `_archive/` was deleted on 2026-11-12 (readable at commit 431ed6e7). The dead CSRF helper was deleted on 2026-10-05; the Origin check in `src/middleware.ts` is the protection ([ADR-0060](adr/0060-mutations-stay-on-route-handlers-and-a-mutating-request-must-come-from-our-origin.md)).

---

## How to update this file
- Phase status change (start, block, complete) → edit the row.
- New spec → add a row under its phase.
- Scope shift inside a phase → sub-bullet; the commit says why.
- **Append-edit, not append-only** — phase status legitimately changes.
- This file tracks *milestones and requirements*. It is not a defect list; a defect becomes either a spec (if it needs design) or a PR (if the rule is already stated in an ADR).
