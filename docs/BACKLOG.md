# BACKLOG.md — phased status map

- **Verified:** 2026-08-08

Where the product is, phase by phase. This is the **milestone map**, not a task list — per-feature detail lives in [specs/](specs/), decisions in [adr/](adr/), and history in [CHANGELOG.md](CHANGELOG.md).

> Ordering principle: **transaction integrity before new capability.** The store's money path is the thing customers touch and the thing that is hardest to correct after the fact, so it leads.

---

## Phase status

| Phase | Goal | Domains | Status |
|---|---|---|---|
| **1** — Storefront & admin | Browse, cart, checkout UI, admin console for products/orders/users/reviews/sellers | catalog, cart, admin, identity | ✅ **Done** |
| **2** — Transaction integrity | The server is authoritative over price, payment state, and stock; money is exact | checkout, payments | 🚧 **In progress** — 4 specs drafted |
| **3** — Fulfilment & marketplace | A confirmed order becomes a real booked shipment from a real location, and the store serves multiple vendors | shipping, catalog, identity | ⏳ Not started — 2 specs + a 9-subfeature programme drafted |
| **4** — Enforcement | Automated checks that hold the Invariants; blocking CI | *(cross-domain)* | ⏳ Not started |
| **5** — Scale & operability | Indexed search, pagination, caching, error tracking | catalog, *(cross-domain)* | ⏳ Not started |

---

## Phase 2 — Transaction integrity

The four specs below implement the Invariants in [../CLAUDE.md](../CLAUDE.md). They are sequenced: pricing authority must land before payment confirmation can check an amount against a trustworthy total.

| Spec | Requirement | ADR | Status |
|---|---|---|---|
| [server-side-pricing-authority](specs/server-side-pricing-authority/) | Prices, totals, and gateway amounts are computed by the server from persisted data | [0002](adr/0002-server-holds-pricing-authority.md) | 📝 Spec drafted |
| [payment-confirmation](specs/payment-confirmation/) | An order's paid state derives only from a verified gateway signal | [0005](adr/0005-payment-state-server-only.md) | 📝 Spec drafted |
| [inventory-reservation](specs/inventory-reservation/) | Stock is reserved atomically at placement and released on failure | [0007](adr/0007-conditional-stock-decrement.md) | 📝 Spec drafted |
| [money-as-paise](specs/money-as-paise/) | Monetary values are exact from catalogue to gateway to report | [0004](adr/0004-money-as-integer-paise.md) | 📝 Spec drafted |

Also in this phase, no spec required (they are corrections with an ADR already stating the rule): request-body parsing across the remaining handlers ([Invariant 4](../CLAUDE.md)), the seed guard ([Invariant 7](../CLAUDE.md)), and the `next-auth` / `next` upgrades.

## Phase 3 — Fulfilment

| Spec | Requirement | Status |
|---|---|---|
| [product-weight-and-rates](specs/product-weight-and-rates/) | A product's weight is persisted and drives its shipping quote | 📝 Spec drafted |
| [multi-vendor-marketplace](specs/multi-vendor-marketplace/) | Three audiences, three portals, and the data model a marketplace needs | 🚧 In progress — 4 of 10 subfeatures done (organisations-and-membership PR-23/24; org-onboarding PR-28; portal-separation PR-25..30; org-portal-chrome PR-31) |
| [shipping-fulfilment](specs/shipping-fulfilment/) | A confirmed order results in a real booked shipment with real tracking | 📝 Spec drafted — **open product question** |

`shipping-fulfilment` carries a decision only the product owner can make; see its `spec.md`. It depends on `product-weight-and-rates`, since booking real parcels at fictional weights is worse than not booking them.

`multi-vendor-marketplace` sits between them and is the largest thing in the backlog. It began as one feature about where a product ships from and became nine subfeatures: answering it properly needed an owner for a pickup location, which needed an organisation, which needed people to belong to one — at which point the panel called "admin" was doing two jobs for two audiences. See its [spec.md](specs/multi-vendor-marketplace/spec.md) for the programme and [portal-split.md](specs/multi-vendor-marketplace/portal-split.md) for where each of today's 15 admin pages and 22 handlers lands.

It reaches back into Phase 2: [stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) moves the stock guard from `Product.stock` onto a per-location row, so [inventory-reservation](specs/inventory-reservation/) must land first, and [order-and-cart-lines](specs/multi-vendor-marketplace/order-and-cart-lines/) wants [money-as-paise](specs/money-as-paise/) first so its price columns are not migrated twice.

## Phase 4 — Enforcement

Making Phase 2 and 3 stick rather than landing once. No specs — these are process, governed by [TESTING.md](TESTING.md).

- Restore the test suite, prioritised by the Invariants ([TESTING.md](TESTING.md) sets the targets)
- Quality gates block the pipeline
- `prisma migrate deploy` in the pipeline
- `validateEnv()` called at boot, covering `ENCRYPTION_KEY` and the webhook secret
- `/bb-review` in use before every PR

## Phase 5 — Scale & operability

Not started, deliberately not detailed. Nothing here begins before Phase 2 closes.

Product search an index can serve (`pg_trgm` or `tsvector`) · pagination on storefront queries · database-side aggregation for admin dashboards · index review on `Order` · order cancellation and refunds · structured logging and error tracking · response caching.

---

## Cross-cutting watch list

Not a phase, but tracked:

- **The client/server contract** ([CONTRACTS.md](CONTRACTS.md)) — consolidating duplicate DTO declarations is a precondition for several specs above. Changes carry `[CONTRACT]`.
- **Repository consolidation** ([ADR-0003](adr/0003-one-repository-per-aggregate.md)) — the *structural* half is done: `server/` is now one directory per domain ([ADR-0012](adr/0012-modules-are-vertical-slices-by-domain.md), CHANGELOG PR-02), so each aggregate has exactly one home. What remains is merging the duplicate repository *modules* that now sit side by side inside a domain — e.g. `catalog/product.repository.ts` and `catalog/admin.product.repository.ts` both read `prisma.product`. That is a behaviour-affecting merge, so it belongs with whichever spec touches the aggregate.
- **Error-envelope adoption** ([ADR-0013](adr/0013-one-error-envelope-and-useserverform.md)) — every handler under `/api/admin` now returns through `toErrorResponse` (PR-21, PR-25). Remaining: the signup, forgot-password, reset-password and provider-connect **forms**, and the non-admin handlers they post to. Decision 7 makes conversion obligatory when a file is touched, so this shrinks as work happens rather than needing a dedicated sweep.
- **Duplicate declarations** ([ADR-0003](adr/0003-one-repository-per-aggregate.md)) — runtime symbol names resolved in PR-08 (14 → 2). Two remain, both deliberate: `formatCurrency` is behaviourally identical, and `isValidPincode` needs the decision below. The 26 remaining *type* duplicates are the [CONTRACTS.md](CONTRACTS.md) work.
- **PIN code validation** — consolidated to one rule in PR-09 (eleven declarations → one). Remaining: query existing `Address` rows for PIN codes with a leading zero, which the tightened rule rejects on update.
- **Error swallowing in the data layer** — PR-13 fixed `products.dal.ts`; the same catch-and-relabel pattern remains in the other DAL modules and in `server/catalog/product.repository.ts`, where a query failure is reported as `"Product not found"`. Preserve `cause`; keep absence distinguishable from failure.
- **Soft 404 on a missing product** — a slug that does not resolve returns HTTP 200 with an error page rather than a real 404. `notFound()` on `NotFoundError` fixes it; matters for search-engine handling.
- **Route the database through Prisma Accelerate** — it is already provisioned (`PRISMA_DATABASE_URL`) and read by nothing. Pooling and caching at the proxy addresses serverless connection pressure more thoroughly than tuning `max` on the local pool. See [OPERATIONS.md](OPERATIONS.md) § Infrastructure.
- **Prune unused connection strings from `.env`** — `POSTGRES_URL`, `DB_URL`, `REDIS_URL`, `KV_URL`, `PRISMA_DATABASE_URL` are read by nothing. Several live connection strings in one file is the hazard behind [Invariant 7](../CLAUDE.md).
- **Slug redirects** — slugs are now generated and frozen (PR-15), but there is no redirect for a slug that changed before that rule existed. One product's URL moved (`product test 001` → `product-test-001`); the old URL 404s. If slugs ever need to change again, a slug-history table or redirect is required.
- **Existing products all weigh 0.5 kg** — weight was collected and never persisted until PR-22, so every row created before it carries the schema default. [product-weight-and-rates](specs/product-weight-and-rates/) R6; rates are wrong in both directions until the catalogue is corrected.
- **`Product.categoryId` cascades on delete** — deleting a category would delete its products. Unreachable today because `adminCategoryService.deleteCategory` refuses when `productsCount > 0`, but that is an application-level read-then-write check, not a database guarantee. `onDelete: Restrict`, as `sellerId` already uses, moves the guarantee to where it cannot be bypassed. Needs a migration.
- **`Category.accentColorClass` stores Tailwind classes as data** — rows hold literals like `bg-emerald-50` (and seeds hold whole gradient strings), so presentation is frozen into the database and the tokenisation pass had to allowlist the option list rather than convert it (PR-33 broke it once by rewriting the options away from the stored values). The fix is a semantic key (`emerald`, `blue`, …) mapped to classes at render — belongs to [category-tree](specs/multi-vendor-marketplace/category-tree/), which touches the model anyway.
- **Documentation system** — see [CHANGELOG.md](CHANGELOG.md) PR-01. Remaining: mine and delete [_archive/](_archive/); delete `src/lib/csrf.ts` (still dead).

---

## How to update this file
- Phase status change (start, block, complete) → edit the row.
- New spec → add a row under its phase.
- Scope shift inside a phase → sub-bullet, plus a [CHANGELOG.md](CHANGELOG.md) entry.
- **Append-edit, not append-only** — phase status legitimately changes.
- This file tracks *milestones and requirements*. It is not a defect list; a defect becomes either a spec (if it needs design) or a PR (if the rule is already stated in an ADR).
