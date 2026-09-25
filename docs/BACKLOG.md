# BACKLOG.md — phased status map

- **Verified:** 2026-09-26
- **Covers:** `docs/specs/*/`

Where the product is, phase by phase. This is the **milestone map**, not a task list — per-feature detail lives in [specs/](specs/), decisions in [adr/](adr/), and history in [CHANGELOG.md](CHANGELOG.md).

> Ordering principle: **transaction integrity before new capability.** The store's money path is the thing customers touch and the thing that is hardest to correct after the fact, so it leads.

---

## Phase status

| Phase | Goal | Domains | Status |
|---|---|---|---|
| **1** — Storefront & admin | Browse, cart, checkout UI, admin console for products/orders/users/reviews/sellers | catalog, cart, admin, identity | ✅ **Done** |
| **2** — Transaction integrity | The server is authoritative over price, payment state, and stock; money is exact | checkout, payments | ✅ **Done** — PR-37..40 |
| **3** — Fulfilment & marketplace | A confirmed order becomes a real booked shipment from a real location, and the store serves multiple vendors | shipping, catalog, identity | ⏳ Not started — 2 specs + a 9-subfeature programme drafted |
| **4** — Enforcement | Automated checks that hold the Invariants; blocking CI | *(cross-domain)* | 🔨 In progress — typecheck and tests block; documentation, security headers and Prisma error shapes are now guard suites (PR-117..119). Outstanding: lint still `continue-on-error`, rate limiting still detached, database-backed tests still skip in CI |
| **5** — Scale & operability | Indexed search, pagination, caching, error tracking | catalog, *(cross-domain)* | ⏳ Not started — 2 specs drafted (error-tracking, read-caching) |
| **6** — Catalogue richness | What a product page can show about a product, beyond a price and a photograph | catalog, checkout | ⏳ Not started — 1 spec drafted (product-video) |
| **7** — Promotions & settlement | Offers the platform and its organisations can run, and a record of what each is owed | promotions, payouts, checkout | 🔨 In progress — engines, checkout, ledger and APIs landed (PR-67); screens outstanding |
| **8** — Bidding | A product can be sold by timed bidding on a shareable link instead of at a fixed price | bidding, catalog, checkout, payouts | ✅ **Done** — PR-97 |
| **9** — Seller storefronts | Every selling organisation gets a public storefront of its own, at a link it can promote | catalog | ✅ **Done** — 7 subfeatures |
| **10** — Discoverability | The store is findable: every public page describes itself, every product is machine-readable, every URL answers honestly | catalog, *(cross-domain)* | ⏳ Not started — 1 spec drafted (seo) |
| **11** — Listing: one entry, every channel | A product is described once, from its photographs, and is ready for the store, Amazon, Flipkart and Instagram from that one entry | catalog, content, listing, social, *(cross-domain)* | 🔨 In progress — 3 of 9 specs accepted (worker-foundation, seller-profile, media-library) plus 2 subfeatures; ADR-0037, ADR-0038 |

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

Also in this phase, no spec required (they are corrections with an ADR already stating the rule): request-body parsing across the remaining handlers ([Invariant 4](../CLAUDE.md)), the seed guard ([Invariant 7](../CLAUDE.md)), and the `next-auth` / `next` upgrades.

## Phase 3 — Fulfilment

| Spec | Requirement | Status |
|---|---|---|
| [product-weight-and-rates](specs/product-weight-and-rates/) | A product's weight is persisted and drives its shipping quote | ✅ Done — PR-22/48/53; parcels bill at summed weight rounded up to whole kg |
| [multi-vendor-marketplace](specs/multi-vendor-marketplace/) | Three audiences, three portals, and the data model a marketplace needs | ✅ 9 of 10 subfeatures done (dashboard-widgets PR-50 closes the build); org-team deferred by decision — the one remaining |
| [shipping-fulfilment](specs/shipping-fulfilment/) | A confirmed order results in a real booked shipment with real tracking | ⏸️ Deferred by decision (2026-08-10): keep live quotes + manual fulfilment; build later |

`shipping-fulfilment`'s open question was decided 2026-08-10 — keep the current flow (live quotes, manual fulfilment); see its `spec.md`. It depends on `product-weight-and-rates`, since booking real parcels at fictional weights is worse than not booking them.

`multi-vendor-marketplace` sits between them and is the largest thing in the backlog. It began as one feature about where a product ships from and became nine subfeatures: answering it properly needed an owner for a pickup location, which needed an organisation, which needed people to belong to one — at which point the panel called "admin" was doing two jobs for two audiences. See its [spec.md](specs/multi-vendor-marketplace/spec.md) for the programme and [portal-split.md](specs/multi-vendor-marketplace/portal-split.md) for where each of today's 15 admin pages and 22 handlers lands.

One recorded gap remains on the money path: shipping is charged at the rate the client says it selected — the server matches it to a quoted parcel but does not re-derive the price. A server-side re-quote at order time would close it; watch item.

It reaches back into Phase 2: [stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) moves the stock guard from `Product.stock` onto a per-location row, so [inventory-reservation](specs/inventory-reservation/) must land first, and [order-and-cart-lines](specs/multi-vendor-marketplace/order-and-cart-lines/) wants [money-as-paise](specs/money-as-paise/) first so its price columns are not migrated twice.

## Phase 4 — Enforcement

Making Phase 2 and 3 stick rather than landing once. Mostly process, governed by [TESTING.md](TESTING.md); one spec so far:

| Spec | Requirement | Status |
|---|---|---|
| [rate-limiting](specs/rate-limiting/) | Sensitive endpoints are rate limited in every deployed environment; one that can't enforce is refused at deploy time, not silently at request time | 📝 Draft — closes PR-55's fail-open stopgap and PR-81's detachment |
| [supply-chain-integrity](specs/supply-chain-integrity/) | What the store ships carries no published vulnerability and no committed secret, and the pipeline is what establishes it | 📝 Draft |

- Restore the test suite, prioritised by the Invariants ([TESTING.md](TESTING.md) sets the targets)
- Quality gates block the pipeline
- ~~`prisma migrate deploy` in the pipeline~~ ✅ Done — PR-57 put it in the Vercel build ([ADR-0014](adr/0014-deploys-run-their-own-migrations.md))
- `validateEnv()` called at boot, covering `ENCRYPTION_KEY` and the webhook secret — now owned by [rate-limiting](specs/rate-limiting/) D2, which needs it to make "silently unlimited" unreachable
- `/bb-review` in use before every PR

## Phase 5 — Scale & operability

Two of this phase's strands are now specified; the rest stays deliberately undetailed.

| Spec | Requirement | Status |
|---|---|---|
| [error-tracking](specs/error-tracking/) | When something fails, somebody finds out — in minutes, with enough detail to act | 📝 Draft |
| [read-caching](specs/read-caching/) | A page that renders the same for everyone is built once, and no price on it is ever stale | 📝 Draft |

Both were pulled forward out of "not started" for the same reason: Phase 9 shipped a URL designed to be *shared*, so the storefront now attracts the one traffic shape that uncached reads handle worst, and the store's growing set of deliberately fail-open controls — the limiter, the reconciliation sweep, the ledger backfill — each record a failure and notify nobody.

Still unspecified: product search an index can serve (`pg_trgm` or `tsvector`) · pagination on storefront queries · database-side aggregation for admin dashboards · index review on `Order` · order cancellation and refunds · structured logging as a project-wide convention.

## Phase 6 — Catalogue richness

A new phase, added 2026-08-13. Phase 1 built the storefront and closed; this is where capability *added to a product page* now lands, rather than reopening a done phase or filing it under Phase 5, which is about making what exists fast and observable.

| Spec | Requirement | Status |
|---|---|---|
| [product-video](specs/product-video/) | A product page shows video alongside its photographs, in an order the seller composes | 📝 Draft — all questions closed 2026-08-13 |
| [bulk-catalog-upload](specs/bulk-catalog-upload/) | An org sets up its catalogue from one spreadsheet plus local photos; admins likewise for categories. Corrects SKU uniqueness to org scope | ✅ Implemented — 2026-08-21 (PR-73) |
| [product-archive](specs/product-archive/) | An org archives a product and restores it, without destroying the orders, payouts or ledger entries it appears on | ✅ Implemented — 2026-09-16 (PR-113) |

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

Sequenced after Phase 9 rather than before it, because storefronts add a public URL namespace and the rules for what gets indexed should be settled once, across both. The overlap is deliberate and bounded: [storefront-discovery](specs/org-storefront/storefront-discovery/) owns `/store/<handle>`, [seo](specs/seo/) owns the marketplace, and the two state the same rules for their own surfaces rather than one importing the other.

Two of this phase's constraints come from earlier decisions rather than from search practice. [ADR-0018](adr/0018-one-effective-price-function.md) means a machine-readable price is a second surface needing the same per-request resolution, so nothing here may be cached past an offer window — the declared price and the displayed price have to be the same value, not two readings of one. [ADR-0023](adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md) means availability is decided by the clock and not by a field, so an item held by a live bidding event must not be declared purchasable even though nothing on the product says it isn't. Getting either wrong is a Google policy violation rather than a display bug.

It also closes the **soft 404** entry on the watch list below, which has been open since it was recorded: the fix is one of four PRs here rather than a standalone commit, because the missing `not-found.tsx` and `error.tsx` boundaries are what make 404 and 500 separable at all.


## Phase 11 — Listing: one entry, every channel

A new phase, added 2026-09-25. The seller's real cost is not the storefront; it is describing the same product four times — Amazon, Flipkart, Meesho, the store — and photographing it badly once. The wedge is one entry that is ready for every channel, with the photographs as the primary evidence of what the product is and a phone photo turned marketplace-grade in one tap. Marketplace publishing itself comes later; this phase builds what it needs and measures itself against the seller's current 5–10 minutes per Amazon listing.

| Spec | Requirement | Status |
|---|---|---|
| [worker-foundation](specs/worker-foundation/) | The queue in our Postgres and the worker we own, with nothing in it: health in admin, per-org fairness, a machine rebuilt by one script ([ADR-0038](adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)) | 🔨 In progress — PR-148 (1 of 3) |
| [seller-profile](specs/seller-profile/) | A private face for what listing needs (brands, manufacturers, origin, tax codes) and a public face for what a buyer may see; nothing demanded before it is needed | 🔨 In progress — PR-149 (1 of 4) |
| [media-library](specs/media-library/) | Every stored image is a record with dimensions, source and uses; galleries fill by named slot; capture is guided on the phone | ✅ Accepted — 2026-09-26 |
| [seller-profile/brand-page](specs/seller-profile/brand-page/) | The about page becomes a brand landing page: hero, derived proof, story with a real person, category tiles, newest goods, terms, one call to shop; finished when the seller has written one line | ✅ Accepted — 2026-09-26 |
| [media-library/renditions](specs/media-library/renditions/) | Surfaces declared once; a rendition made on demand from the source or the seller's crop, kept as a derived image | ✅ Accepted — 2026-09-26 |
| image-enhancement | Cutout to white background and to a generated backdrop, as derived images, with a per-org usage ledger and quota; a dark or blurred warning at upload offers "improve this photo" as its way out; the first work on the owned worker | planned |
| listing-schema | A canonical vocabulary, per-channel mappings held as data, product families, one effective-attribute resolver, per-value provenance, and readiness per channel | planned |
| product-form | Minimum to save, inherited values marked with their source, facts asked at the point of need and written back to the brand, photo-derived suggestions confirmed before use | planned |
| instagram-post | A post draft generated only on explicit intent, replaceable, regenerable, skippable; manual share first | planned |
| channel-files | Export a valid marketplace flat-file row; import an existing Seller Central catalogue at onboarding | planned |
| instagram-publish | Automatic publishing through the Graph API, on the worker | planned |

Sequenced so that the three foundations run in parallel and the demo lands next: worker-foundation, seller-profile and media-library touch different tables and start together — the worker was pulled forward on 2026-09-25 because the library's sweep, pre-rendering and video transcoding are its first jobs; image-enhancement needs the library and the worker ([ADR-0038](adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)); listing-schema needs brands and the marketplace templates; everything after needs listing-schema. Two rules from earlier phases bind the whole of it: the server stays the sole authority on money ([Invariant 1](../CLAUDE.md)) whatever a channel says a price is, and the host constrains operations, never design ([ADR-0037](adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md)).

---

## Cross-cutting watch list

Not a phase, but tracked:

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
- **The Shiprocket webhook is unauthenticated** — `POST /api/webhooks/shipping/shiprocket` verifies no signature and no shared secret, so anyone who can guess a tracking number can mark a shipment, and hence an order, delivered. It also answers 200 on every failure, the opposite of the "fail loudly on an unmatched payload" that [INTEGRATIONS.md](INTEGRATIONS.md) prescribes for exactly this case. No money moves on `delivered` today — settlement does not read it — which is the only reason this is a watch-list entry rather than a stop-everything. Needs a shared-secret header or a hard-to-guess path, and knowing which of those Shiprocket's dashboard can actually send.
- **Rate limiting is detached, and says so** — PR-81 replaced three fail-open implementations with one seam in `src/lib/rate-limit/` that allows everything and reports `RATE_LIMITING_ENABLED === false`. No live module imports `@upstash/*`, so the request path carries no cache dependency; both implementations are parked beside the seam, unimported. **Unthrottled until the cache is wired:** `POST /api/auth/signup`, `/api/auth/forgot-password`, `/api/payments/create-order`, `/api/orders*`, `/api/cart*` — and `reset-password`, `resend-verification`, `verify-email`, which never had limits. Reconnecting is an edit to one file; the correctness fixes it needs first are in the parked file's header. Spec: [rate-limiting](specs/rate-limiting/), Phase 4.
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

- **Documentation system** — see [CHANGELOG.md](CHANGELOG.md) PR-01. Remaining: mine and delete [_archive/](_archive/); delete `src/lib/csrf.ts` (still dead).

---

## How to update this file
- Phase status change (start, block, complete) → edit the row.
- New spec → add a row under its phase.
- Scope shift inside a phase → sub-bullet, plus a [CHANGELOG.md](CHANGELOG.md) entry.
- **Append-edit, not append-only** — phase status legitimately changes.
- This file tracks *milestones and requirements*. It is not a defect list; a defect becomes either a spec (if it needs design) or a PR (if the rule is already stated in an ADR).
