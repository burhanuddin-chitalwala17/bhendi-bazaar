# Spec — storefront-browse

- **Summary:** Search, category navigation and filters that see one organisation's catalogue and nothing else
- **Status:** ✅ Implemented
- **Domain:** catalog
- **Phase:** 9 — Seller storefronts
- **Verified:** 2026-09-19
- **References:** [../spec.md](../spec.md) (programme), `431ed6e7:docs/specs/org-storefront/trd.md` D6/D7/D11, [storefront-pages](../storefront-pages/), promotions (`planning-archive-2026-11-25:docs/specs/promotions/`)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

Search, category navigation and filters that see one organisation's catalogue and nothing else — the
storefront's own search bar and its own category bar.

## Why

A shop with two hundred items is unusable without them, and a visitor who searches inside a shop and gets
the whole marketplace back has been told the shop is not real. This is the difference between a storefront
and a filtered listing.

The marketplace's category tree is platform-owned and shared, so an organisation's category bar has to show
the parts of that tree it actually occupies — not every category the platform has, most of which are empty
for this shop.

## Requirements

- **R1** — A search made from a storefront returns only that organisation's goods.
- **R2** — The category bar shows only categories in which the organisation has something to sell.
- **R3** — Filters — price, offers, availability — apply within the organisation's catalogue.
- **R4** — Search, category and filters combine, and the combination is in the URL, so a filtered view can be shared and reopened.
- **R5** — Prices and offers shown here are the prices that will be charged, resolved the same way every other surface resolves them.
- **R6** — A search with no results says so and offers a way onward, rather than showing an empty grid.
- **R7** — Scoping is a property of the query. No request parameter can widen a storefront search beyond its organisation.
- **R8** — A long catalogue pages rather than loading whole, and a storefront that is being shared widely stays responsive.
- **R9** — The whole set works on a phone: the search bar, the category bar and the filters each have a mobile form, not a desktop one hidden below a breakpoint.

## Product acceptance

- **A1** — Searching a common word on a storefront and on the marketplace returns different sets; the storefront's is a subset.
- **A2** — A category with nothing in it for this shop does not appear in its category bar.
- **A3** — A filtered storefront URL, copied and reopened in another browser, shows the same view.
- **A4** — Adding a parameter to a storefront search cannot make another organisation's goods appear.
- **A5** — A shop with two hundred items is browsable on a phone without loading all two hundred.
- **A6** — A price seen in a filtered storefront listing is the price charged at checkout.

## Out of scope (this feature)

- Indexed search. Matching is `contains` today (`server/catalog/product.repository.ts`); replacing it with `pg_trgm` or `tsvector` is Phase 5 and applies to the whole store, not just storefronts.
- Search across shops, or ranking one shop against another.
- Sorting beyond what the marketplace listing already offers.
- Saved searches and search history.
