# TRD — read-caching

- **Status:** Draft
- **Domain:** catalog, with cross-domain reads
- **Phase:** 5 — Scale & operability
- **Verified:** 2026-09-21
- **References:** [spec.md](spec.md), [ADR-0018](../../adr/0018-one-effective-price-function.md), [ADR-0029](../../adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md), [ADR-0030](../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md), [OPERATIONS.md](../../OPERATIONS.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach

Cache the reads, not the pages, and invalidate by event rather than by clock.

The distinction is what makes this compatible with [ADR-0018](../../adr/0018-one-effective-price-function.md). A cached *page* necessarily contains a rendered price and therefore cannot outlive an offer window. A cached *read* need not: the category tree, a product's descriptive columns and the catalogue rows behind a listing carry no resolved price, and they change only when someone edits them. The live offer set and the price resolver stay exactly where they are, running per request against the current clock, and the page is assembled from a cheap cached half and a fresh priced half.

Invalidating by event rather than by interval follows from the same constraint and from spec R4. An interval is a guess about when something changed and is wrong in both directions — stale while it waits, wasteful when nothing changed. Tagging each cached read and busting the tag from the write that caused the change makes R3 and R4 the same mechanism, and removes the class of bug where a withdrawn product is still on sale because an interval has not lapsed.

This uses the framework's own data cache. No Redis, no external cache service, and nothing shared with the rate limiter's Upstash instance despite both being colloquially "the cache" — locally the framework's cache is in-process and on-disk, which satisfies spec R7 by construction rather than by configuration.

## Technical decisions

- D1 — **Only price-free reads are cached.** The category tree (`categoriesDAL`'s ancestor and descendant reads, a single shared tree) and catalogue row reads. The offer set and `effectiveUnitPrice` are never cached under any key or interval (spec R2). A read path that needs a price and does not call the resolver is a defect under ADR-0018 and stays one.
- D2 — **Invalidation is by tag, from the write.** Each cached read is tagged by what it depends on — a product, an organisation, the category tree — and the service that mutates that thing busts the tag after its transaction commits. No interval-based revalidation on anything a seller or admin can edit.
- D3 — **Withdrawal busts before it returns**, not eventually. Archiving a product ([ADR-0029](../../adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md)), deactivating an organisation — whose effect must be platform-wide, not merely storefront-local ([ADR-0030](../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md)) — and a bidding window opening or closing are safety operations. Spec R4 makes them a correctness requirement rather than a freshness preference.
- D4 — **Bidding suspension is never cached.** It is derived at read time from the live event set and memoised per request by design ([ADR-0023](../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)), and re-checked inside the order transaction. Caching the derived answer would reintroduce exactly the staleness that ADR deliberately refused to store.
- D5 — **Stock is not cached, and is not what a cached row asserts.** A cached catalogue row carries descriptive columns; availability is read fresh. The authoritative check remains the guarded conditional decrement inside the order transaction (Invariant 6), so a cached listing can never oversell — spec R5 is about not misleading a shopper, not about the sale being safe, which it already is.
- D6 — **Nothing per-shopper is cached at all.** The storefront's auth-aware chrome is already client-side on the session and nothing under the main storefront reads cookies or headers on the server, which is what makes a shared cache safe here in the first place. That property is now load-bearing and should be asserted by a test rather than left as an observation (spec R6).
- D7 — **Prisma Accelerate is evaluated before any of this, not alongside it.** It is already provisioned and read by nothing. Proxy-level caching may cover part of the same ground, and measuring first avoids building an application-level cache over an unmeasured proxy one. Whichever wins, spec R8's before-and-after numbers come from the existing database operation budget tests.
- D8 — **Prefetching stays off in this feature.** Re-enabling it is the obvious follow-on once a page costs no database round trip, but it is a separate change with its own measurement and should not ride along and confuse R8's numbers.

## Packages

None expected. Prisma Accelerate under D7 is a configuration change to an already-provisioned service rather than a new dependency; if evaluation selects it, [DEPENDENCIES.md](../../DEPENDENCIES.md) and [OPERATIONS.md](../../OPERATIONS.md) record it then.

## UI approach

None. No visual change is intended, and any visible change is a defect — this feature's success is that nothing looks different and less work happens.

## Data model

None.

## API / contract changes

None.

## Test plan

- Integration — the database operation budget tests already in the tree are extended to assert the second render of a page performs no catalogue reads (spec A1, R8).
- Unit — tag invalidation: a product edit, an archive, an organisation deactivation and a category reorder each bust the tags their pages depend on.
- Unit — a guard asserting no cached read includes a resolved price, so ADR-0018 is enforced by a test rather than by review attention.
- Unit — D6's property: nothing under the storefront reads the session on the server.
- Integration — an offer expiring mid-sequence changes the rendered price on the next request with no invalidation step (spec A2).

## Delivery (PRs)

Three PRs.

1. **Measure** — Accelerate evaluated per D7 and the before numbers recorded. No application change; this is the PR that decides how much of the rest is needed.
2. **The category tree** — one shared read, tagged and busted on category writes. The smallest genuine slice, and the one with the least price exposure.
3. **Catalogue rows** — listings and product descriptive reads, with D3's withdrawal invalidation. This is the PR that changes behaviour under load and the one needing the guard test from D1.

## Open questions

- Q1 — Does Accelerate's own caching make PRs 2 and 3 unnecessary, partly or wholly? Answered by PR 1, and the reason PR 1 exists separately.
- Q2 — Is a short interval acceptable as a backstop alongside tag invalidation, in case a bust is ever missed? Argues against itself under spec R4, but a bounded staleness on price-free reads may be cheaper insurance than perfect tag discipline. Close before PR 3.
