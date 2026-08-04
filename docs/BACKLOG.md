# BACKLOG.md — phased status map

- **Verified:** 2026-08-04

Where the product is, phase by phase. This is the **milestone map**, not a task list — per-feature detail lives in [specs/](specs/), decisions in [adr/](adr/), and history in [CHANGELOG.md](CHANGELOG.md).

> Ordering principle: **transaction integrity before new capability.** The store's money path is the thing customers touch and the thing that is hardest to correct after the fact, so it leads.

---

## Phase status

| Phase | Goal | Domains | Status |
|---|---|---|---|
| **1** — Storefront & admin | Browse, cart, checkout UI, admin console for products/orders/users/reviews/sellers | catalog, cart, admin, identity | ✅ **Done** |
| **2** — Transaction integrity | The server is authoritative over price, payment state, and stock; money is exact | checkout, payments | 🚧 **In progress** — 4 specs drafted |
| **3** — Fulfilment | A confirmed order becomes a real booked shipment, priced on real weight | shipping | ⏳ Not started — 2 specs drafted |
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
| [shipping-fulfilment](specs/shipping-fulfilment/) | A confirmed order results in a real booked shipment with real tracking | 📝 Spec drafted — **open product question** |

`shipping-fulfilment` carries a decision only the product owner can make; see its `spec.md`. It depends on `product-weight-and-rates`, since booking real parcels at fictional weights is worse than not booking them.

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
- **Duplicate declarations** ([ADR-0003](adr/0003-one-repository-per-aggregate.md)) — runtime symbol names resolved in PR-08 (14 → 2). Two remain, both deliberate: `formatCurrency` is behaviourally identical, and `isValidPincode` needs the decision below. The 26 remaining *type* duplicates are the [CONTRACTS.md](CONTRACTS.md) work.
- **PIN code validation** — consolidated to one rule in PR-09 (eleven declarations → one). Remaining: query existing `Address` rows for PIN codes with a leading zero, which the tightened rule rejects on update.
- **Documentation system** — see [CHANGELOG.md](CHANGELOG.md) PR-01. Remaining: mine and delete [_archive/](_archive/); delete `src/lib/csrf.ts` (still dead).

---

## How to update this file
- Phase status change (start, block, complete) → edit the row.
- New spec → add a row under its phase.
- Scope shift inside a phase → sub-bullet, plus a [CHANGELOG.md](CHANGELOG.md) entry.
- **Append-edit, not append-only** — phase status legitimately changes.
- This file tracks *milestones and requirements*. It is not a defect list; a defect becomes either a spec (if it needs design) or a PR (if the rule is already stated in an ADR).
