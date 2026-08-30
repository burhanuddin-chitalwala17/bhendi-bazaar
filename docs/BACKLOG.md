# BACKLOG.md — phased status map

- **Verified:** 2026-08-30

Where the product is, phase by phase. This is the **milestone map**, not a task list — per-feature detail lives in [specs/](specs/), decisions in [adr/](adr/), and history in [CHANGELOG.md](CHANGELOG.md).

> Ordering principle: **transaction integrity before new capability.** The store's money path is the thing customers touch and the thing that is hardest to correct after the fact, so it leads.

---

## Phase status

| Phase | Goal | Domains | Status |
|---|---|---|---|
| **1** — Storefront & admin | Browse, cart, checkout UI, admin console for products/orders/users/reviews/sellers | catalog, cart, admin, identity | ✅ **Done** |
| **2** — Transaction integrity | The server is authoritative over price, payment state, and stock; money is exact | checkout, payments | ✅ **Done** — PR-37..40 |
| **3** — Fulfilment & marketplace | A confirmed order becomes a real booked shipment from a real location, and the store serves multiple vendors | shipping, catalog, identity | ⏳ Not started — 2 specs + a 9-subfeature programme drafted |
| **4** — Enforcement | Automated checks that hold the Invariants; blocking CI | *(cross-domain)* | ⏳ Not started — 1 spec drafted (rate-limiting) |
| **5** — Scale & operability | Indexed search, pagination, caching, error tracking | catalog, *(cross-domain)* | ⏳ Not started |
| **6** — Catalogue richness | What a product page can show about a product, beyond a price and a photograph | catalog, checkout | ⏳ Not started — 1 spec drafted (product-video) |
| **7** — Promotions & settlement | Offers the platform and its organisations can run, and a record of what each is owed | promotions, payouts, checkout | 🔨 In progress — engines, checkout, ledger and APIs landed (PR-67); screens outstanding |

---

## Phase 2 — Transaction integrity

The four specs below implement the Invariants in [../CLAUDE.md](../CLAUDE.md). They are sequenced: pricing authority must land before payment confirmation can check an amount against a trustworthy total.

| Spec | Requirement | ADR | Status |
|---|---|---|---|
| [server-side-pricing-authority](specs/server-side-pricing-authority/) | Prices, totals, and gateway amounts are computed by the server from persisted data | [0002](adr/0002-server-holds-pricing-authority.md) | ✅ Implemented — PR-38 |
| [payment-confirmation](specs/payment-confirmation/) | An order's paid state derives only from a verified gateway signal | [0005](adr/0005-payment-state-server-only.md) | ✅ Implemented — PR-39 |
| [inventory-reservation](specs/inventory-reservation/) | Stock is reserved atomically at placement and released on failure | [0007](adr/0007-conditional-stock-decrement.md) | ✅ Implemented — PR-40 |
| [money-as-paise](specs/money-as-paise/) | Monetary values are exact from catalogue to gateway to report | [0004](adr/0004-money-as-integer-paise.md) | ✅ Implemented — PR-37 |

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
| [rate-limiting](specs/rate-limiting/) | Sensitive endpoints are rate limited in production; an environment that can't enforce says so at deploy time, not silently at request time | 📝 Draft — closes PR-55's fail-open stopgap |

- Restore the test suite, prioritised by the Invariants ([TESTING.md](TESTING.md) sets the targets)
- Quality gates block the pipeline
- ~~`prisma migrate deploy` in the pipeline~~ ✅ Done — PR-57 put it in the Vercel build ([ADR-0014](adr/0014-deploys-run-their-own-migrations.md))
- `validateEnv()` called at boot, covering `ENCRYPTION_KEY` and the webhook secret
- `/bb-review` in use before every PR

## Phase 5 — Scale & operability

Not started, deliberately not detailed. Nothing here begins before Phase 2 closes.

Product search an index can serve (`pg_trgm` or `tsvector`) · pagination on storefront queries · database-side aggregation for admin dashboards · index review on `Order` · order cancellation and refunds · structured logging and error tracking · response caching.

## Phase 6 — Catalogue richness

A new phase, added 2026-08-13. Phase 1 built the storefront and closed; this is where capability *added to a product page* now lands, rather than reopening a done phase or filing it under Phase 5, which is about making what exists fast and observable.

| Spec | Requirement | Status |
|---|---|---|
| [product-video](specs/product-video/) | A product page shows video alongside its photographs, in an order the seller composes | 📝 Draft — all questions closed 2026-08-13 |
| [bulk-catalog-upload](specs/bulk-catalog-upload/) | An org sets up its catalogue from one spreadsheet plus local photos; admins likewise for categories. Corrects SKU uniqueness to org scope | ✅ Implemented — 2026-08-21 (PR-73) |

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

## Cross-cutting watch list

Not a phase, but tracked:

- **The client/server contract** ([CONTRACTS.md](CONTRACTS.md)) — consolidating duplicate DTO declarations is a precondition for several specs above. Changes carry `[CONTRACT]`.
- **Repository consolidation** ([ADR-0003](adr/0003-one-repository-per-aggregate.md)) — the *structural* half is done: `server/` is now one directory per domain ([ADR-0012](adr/0012-modules-are-vertical-slices-by-domain.md), CHANGELOG PR-02), so each aggregate has exactly one home. What remains is merging the duplicate repository *modules* that now sit side by side inside a domain — e.g. `catalog/product.repository.ts` and `catalog/admin.product.repository.ts` both read `prisma.product`. That is a behaviour-affecting merge, so it belongs with whichever spec touches the aggregate.
- **Error-envelope adoption** ([ADR-0013](adr/0013-one-error-envelope-and-useserverform.md)) — every handler under `/api/admin` now returns through `toErrorResponse` (PR-21, PR-25). Remaining: the signup, forgot-password, reset-password and provider-connect **forms**, and the non-admin handlers they post to. Decision 7 makes conversion obligatory when a file is touched, so this shrinks as work happens rather than needing a dedicated sweep.
- **Duplicate declarations** ([ADR-0003](adr/0003-one-repository-per-aggregate.md)) — runtime symbol names resolved in PR-08 (14 → 2). Two remain, both deliberate: `formatCurrency` is behaviourally identical, and `isValidPincode` needs the decision below. The 26 remaining *type* duplicates are the [CONTRACTS.md](CONTRACTS.md) work.
- **PIN code validation** — consolidated to one rule in PR-09 (eleven declarations → one). Remaining: query existing `Address` rows for PIN codes with a leading zero, which the tightened rule rejects on update.
- **Error swallowing in the data layer** — PR-13 fixed `products.dal.ts`; the same catch-and-relabel pattern remains in the other DAL modules and in `server/catalog/product.repository.ts`, where a query failure is reported as `"Product not found"`. Preserve `cause`; keep absence distinguishable from failure.
- **Sale price is read two different ways** — `src/components/shared/PriceDisplay.tsx` treats a sale price as an offer only when it is positive and below the regular price, matching `effectiveUnitPrice` in `server/checkout/pricing.ts`. Eight other sites — the cart line, the checkout summary, the shipping-rate hook, both order detail pages, the org parcel value — simply fall back with `??`, so a sale price of zero or one above the regular price renders differently depending on where the buyer is looking. [promotions](specs/promotions/) PR 3 consolidates them onto the one function; until then it is a display inconsistency on the money path.
- **Soft 404 on a missing product** — a slug that does not resolve returns HTTP 200 with an error page rather than a real 404. `notFound()` on `NotFoundError` fixes it; matters for search-engine handling.
- **Route the database through Prisma Accelerate** — it is already provisioned (`PRISMA_DATABASE_URL`) and read by nothing. Pooling and caching at the proxy addresses serverless connection pressure more thoroughly than tuning `max` on the local pool. See [OPERATIONS.md](OPERATIONS.md) § Infrastructure.
- **Rate limiting is detached, and says so** — PR-81 replaced three fail-open implementations with one seam in `src/lib/rate-limit/` that allows everything and reports `RATE_LIMITING_ENABLED === false`. No live module imports `@upstash/*`, so the request path carries no cache dependency; both implementations are parked beside the seam, unimported. **Unthrottled until the cache is wired:** `POST /api/auth/signup`, `/api/auth/forgot-password`, `/api/payments/create-order`, `/api/orders*`, `/api/cart*` — and `reset-password`, `resend-verification`, `verify-email`, which never had limits. Reconnecting is an edit to one file; the correctness fixes it needs first are in the parked file's header. Spec: [rate-limiting](specs/rate-limiting/), Phase 4.
- **This domain served a WordPress site before this one, and search engines still hold its index** — the archive has 4,682 URLs for `bhendi-bazaar.com`. Genuine Bhendi Bazaar posts from 2019–2020 (`explore-bhendi-bazaar`, `ashara-ohbat-1442`), then from March 2021 a turn into Indonesian gambling spam (`situs-judi-slot-gacor`, `apakah-legal-bermain-di-kasino-online`), scraped filler, and adult posts — still serving 200s as late as September 2025. The two shapes share one permalink structure, which reads as a compromised WordPress install rather than a resale, though that cannot be established from outside. Bing is still crawling it: two such requests arrived 0.74s apart on 2026-08-30.

  PR-81 answered the code half — `src/app/robots.ts` and `src/app/sitemap.ts` state what exists, and `src/middleware.ts` returns **410 Gone** for the `/YYYY/MM/DD/` shape so crawlers retire those URLs instead of retrying a 404. **What remains needs an account, not a commit:**
    - Verify the domain in **Google Search Console** and **Bing Webmaster Tools**, and check both for a manual action inherited from the gambling era — one would cap the store's ranking regardless of the store's quality.
    - Submit the sitemap in each, and use removals for the old URL set.
    - Review the backlink profile; gambling and adult inbound links are disavow candidates.
    - Confirm `NEXT_PUBLIC_APP_URL` is set in the Vercel production environment — `appUrl()` throws without it, and both `robots.txt` and `sitemap.xml` are built from it.

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
