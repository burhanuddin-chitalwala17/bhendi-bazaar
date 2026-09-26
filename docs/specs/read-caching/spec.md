# Spec — read-caching

- **Summary:** A page that renders the same for everyone is built once, and no price on it is ever stale
- **Status:** Draft
- **Domain:** catalog, with cross-domain reads
- **Phase:** 5 — Scale & operability
- **Verified:** 2026-09-21
- **References:** [trd.md](trd.md), [ADR-0018](../../adr/0018-one-effective-price-function.md), [org-storefront](../org-storefront/), [promotions](../promotions/), [CHANGELOG PR-70](../../CHANGELOG.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

A page that renders the same thing for every visitor is built once and served many times, without any price on it ever being stale.

## Why

Every storefront read reaches the database on every request, and the result is usually identical to the one served a second earlier. A category page is roughly three sequential round trips and renders the same markup for everyone. The August 2026 exhaustion of the database's monthly operation allowance made that concrete rather than theoretical, and the fixes that followed — eliminating redundant calls and collapsing relation fan-out — reduced the cost per page substantially but left the repetition untouched. Nothing is remembered between two requests for the same page.

This matters more now than it did, because the store has just acquired a class of URL designed to be shared. A seller promotes their storefront link, and the traffic that arrives is many people asking for exactly the same page at the same time — the precise shape of load that caching answers and that a per-request database read handles worst.

The obvious approach is barred, and this is the requirement rather than a footnote. [ADR-0018](../../adr/0018-one-effective-price-function.md) holds that every surface showing a price resolves it through one function against the current clock, and that no cached response may outlive an offer window. A blanket revalidation interval on a product or category page would advertise a price that has expired — the store showing one number and charging another, which is the failure the pricing invariants exist to prevent. So the requirement is not "cache the storefront"; it is to cache everything on those pages that is not a price, and leave price resolution exactly where it is.

## Requirements

- R1 — A repeat visitor to an unchanged page does not cause the database work that the first visitor caused.
- R2 — No price a shopper sees is ever older than the request that rendered it. An offer that started or ended a second ago is reflected immediately, on every surface, with no exception for a cached one.
- R3 — Editorial changes appear promptly and predictably. A seller who edits a product, an admin who reorders a category, sees the storefront reflect it without waiting for an interval to lapse and without anyone clearing anything by hand.
- R4 — A withdrawal takes effect at once. Archiving a product, deactivating an organisation or closing a bidding window must not leave a cached page still offering the thing — these are safety operations, not edits.
- R5 — Stock shown to a shopper is not misleading. It need not be exact to the second, but a cached page must not present a sold-out item as available for longer than a shopper would find reasonable.
- R6 — Nothing personal is ever served to the wrong person. Anything that varies by shopper — basket, session, addresses, order history — is never part of a shared cached result.
- R7 — Local development caches locally and reaches no external service, and a developer can see plainly whether a read was served from cache.
- R8 — The saving is measured, not assumed. Database operations per page are known before and after, and the improvement is recorded.

## Product acceptance

- A1 — Loading a category page twice performs the database reads once; the counts are pinned by the existing budget tests.
- A2 — An offer that expires at a given moment stops being shown at that moment, on the listing, the product page, the basket and the checkout alike, with no interval to wait out.
- A3 — Editing a product's name shows the new name on its storefront within seconds, without a deploy.
- A4 — Archiving a product removes it from every listing immediately.
- A5 — A shopper's basket and addresses never appear on another shopper's page under any cache state.
- A6 — A fresh clone runs with no cache configuration and no external service.

## Out of scope (this feature)

- Caching anything behind the admin or seller portals; both are authenticated, per-user, and low-traffic.
- Pagination of storefront listings, and search indexing — separate Phase 5 concerns with their own costs.
- Rate limiting, which shares the word "cache" in its infrastructure and nothing else — [rate-limiting](../rate-limiting/).
- Re-enabling link prefetching, which becomes worth revisiting once this lands but is a distinct change with its own measurement.
