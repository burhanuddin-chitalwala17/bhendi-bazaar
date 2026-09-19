# Spec — seo

- **Status:** Draft
- **Domain:** cross-domain (catalog leads)
- **Phase:** 10 — Discoverability
- **Verified:** 2026-09-19
- **References:** [trd.md](trd.md), [ADR-0018](../../adr/0018-one-effective-price-function.md), [ADR-0023](../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md), [org-storefront/storefront-discovery](../org-storefront/storefront-discovery/spec.md), [BACKLOG.md](../../BACKLOG.md) cross-cutting watch list

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

The store saying what it is in the terms a search engine reads: a machine-readable description of every
product, a title and an address of its own on every public page, and an honest HTTP answer on every URL.

## Why

Organic search is the only acquisition channel this store has. There is no ad budget, the seller base is
small and local, and a marketplace's traffic problem is not that buyers dislike it but that they never
arrive. Every other phase has built things worth finding; none has made them findable.

The e-commerce result page is not won on a blue link. It is won on price, stock and stars appearing under
the title — and those appear only for a site that declares them. A store that declares nothing competes
with one line of text against competitors showing a price, and loses whatever its catalogue is worth.

Three things make this urgent rather than merely desirable. **Categories are the intent pages** — a buyer
searches for a kind of thing far more often than a named product — and today every category page describes
itself with the site-wide title, so the largest set of pages we could rank for intent is a set of
duplicates. **The domain carries a prior index** of a compromised WordPress site, so this store is not
starting from nothing but from something worse than nothing. And **Phase 9 publishes a new public URL
namespace** into exactly that, which is defensible only if the rules for what gets indexed are deliberate.

## Hazards this feature must answer

These are the ways the work goes wrong, named here so the technical approach cannot skip them.

- **A declared price that disagrees with the displayed price is a policy violation, not a bug.** Prices here
  are time-boxed offers resolved against the clock ([ADR-0018](../../adr/0018-one-effective-price-function.md)).
  Machine-readable price becomes a second surface needing the same resolution, and any caching that outlives
  an offer window publishes an expired price to a crawler.
- **Declaring an item purchasable when it is not** is the same violation in another column. An item held out
  of sale by a live bidding event can be neither bought nor priced normally ([ADR-0023](../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)),
  and is suspended by the clock rather than by a field, so nothing on the product says so.
- **A rating is a claim the platform makes.** Ratings here are collected by us, from us — asserting an
  average over one review, or any rating a seller supplied about itself, is what earns a manual action.
- **A wrong status code teaches a crawler the wrong thing, permanently.** A retired product URL that answers
  200 with an error page keeps its place in the index and its share of the crawl budget.
- **Search and filter URLs are unbounded space.** Offering them for ranking spends the crawl budget on
  near-duplicates of the pages that should have had it.

## Requirements

- **R1** — Every public page states its own title, description and canonical address. No two describe themselves identically.
- **R2** — A product page declares its price, currency, availability and seller in machine-readable form, resolved the same way and at the same moment as the price a buyer is shown on it.
- **R3** — A product that cannot be bought right now never declares that it can — whether it is out of stock, held by a live bidding event, or sold by a withdrawn organisation.
- **R4** — The platform declares no rating it did not collect, and declares an average only where there is enough of it to mean something.
- **R5** — A product's place in the catalogue is machine-readable, so a result can show its category trail rather than a bare address.
- **R6** — The platform states once, in machine-readable form, who it is, how it is reached, and where its search lives.
- **R7** — Every URL answers with the status that is true of it: a live page 200, a retired one gone for good, a failure never reported as either of those.
- **R8** — Only pages worth ranking are offered for ranking. Result and filter addresses may be followed but are not indexed and are not advertised.
- **R9** — The address set offered to crawlers says when each page last changed, using a real recorded time and never an invented one.
- **R10** — Every image that carries meaning is described in text; an image that is purely decorative says so.
- **R11** — What a page is ranked on is present in the HTML served to the crawler, not assembled in the browser afterwards.
- **R12** — The pages a buyer lands on from search meet Google's page-experience thresholds on a phone.
- **R13** — While the store is pre-launch, every mechanism here is as invisible to crawlers as the rest of the store.
- **R14** — A product keeps one address. Nothing here, and nothing a storefront projection does, creates a second address for the same goods.

## Product acceptance

- **A1** — Google's Rich Results Test on a product page reports a valid product, with price, currency, availability and seller.
- **A2** — Two different category pages produce two different titles and descriptions in a result preview.
- **A3** — A product held by a live bidding event is reported as unavailable, not in stock.
- **A4** — A product whose offer has expired is never shown at the expired price after a recrawl.
- **A5** — Requesting a retired product address returns a real not-found, and that address has left the sitemap.
- **A6** — A `site:` search returns no search-result addresses.
- **A7** — With the pre-launch crawl block set, no page is indexable and the sitemap advertises nothing.
- **A8** — On a phone at ~360px, a product page and a category page both pass Core Web Vitals in the field data already being collected.
- **A9** — A category page reached from a search result reads as being about that category, from its title alone, before it loads.

## Out of scope (this feature)

- Storefront and seller discovery — owned by [storefront-discovery](../org-storefront/storefront-discovery/spec.md), which states the same rules for `/store/<handle>`.
- The Search Console and Bing Webmaster work on the inherited WordPress index, including the manual-action check and backlink disavow — account work, tracked in [BACKLOG.md](../../BACKLOG.md).
- Editorial content, a blog, or anything that ranks on words rather than goods.
- Paid search and paid placement.
- Other languages, and any `hreflang` that would follow.
- Growing the number of reviews. R4 constrains what may be declared about the reviews that exist; it does not ask for more.
