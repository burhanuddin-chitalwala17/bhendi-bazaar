# Spec — storefront-discovery

- **Summary:** A correct link preview, a place in search results, and a directory so a shop can be found
- **Status:** ✅ Implemented
- **Domain:** catalog
- **Phase:** 9 — Seller storefronts
- **Verified:** 2026-09-19
- **References:** [../spec.md](../spec.md) (programme), `431ed6e7:docs/specs/org-storefront/trd.md` D2/D4/D10, seo (`planning-archive-2026-11-25:docs/specs/seo/`), [seller-identity](../seller-identity/), [storefront-pages](../storefront-pages/), [storefront-branding](../storefront-branding/)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

The part that makes a storefront worth having a link to: a correct preview wherever it is pasted, a place
in search results, and a directory so a shop can be found by someone not already looking for it.

## Why

A storefront nobody can find is a page, not a shop. A shop is found three ways, and they are not equally
reliable.

**The link the seller shares** works on day one and is the only channel the seller controls. **The product
page** is the largest and the one the platform controls: a buyer looking at something is already interested
in whoever made it, so the seller's name on that page is the marketplace's own route into their shop —
worth more traffic than search will send for years, and it works whether or not the rest of this feature
ever pays off. **Search** is the slowest and the least certain, and it is the one most often mistaken for
the whole of discovery.

The mechanism for the second is [seller-identity](../seller-identity/); what this feature owes it is that
the loop closes — the product names the shop, the shop is worth arriving at, and the buyer can get back out
to the marketplace.

The domain carries a complication: it served a WordPress site before this one, and search engines still
hold that index (see [BACKLOG.md](../../../BACKLOG.md)). New public URLs arrive into a namespace that is
still being cleaned up, so what crawlers are told about them has to be deliberate.

## Where this stops and seo (`planning-archive-2026-11-25:docs/specs/seo/`) starts

The two overlap and the line is worth stating once. **seo (`planning-archive-2026-11-25:docs/specs/seo/`) owns the mechanism** — how any public
page declares a title, a canonical and a description, what a product looks like to a machine, and what HTTP
status an honest URL returns. It applies to the whole store, storefronts included, and this feature does not
restate or reimplement any of it.

**This feature owns applying that to shops, and the one surface seo has no reason to know about:** an
organisation's page describing *itself* rather than the platform, its entry in the sitemap, the answer a
retired handle gives, and a directory of shops — which exists nowhere else and is the only way to reach a
shop whose name you do not already know.

Where they touch, seo wins and this follows. That makes seo a dependency in practice even though it sits a
phase later: a storefront must be shareable the day it exists, so the per-org metadata here lands first and
is rewritten onto seo's pattern rather than competing with it.

## Requirements

- **R1** — A storefront link pasted into WhatsApp, Instagram or Slack shows the organisation's name, description and mark — not the platform's.
- **R2** — A storefront is indexable in its own right and states plainly what it is, through whatever pattern seo (`planning-archive-2026-11-25:docs/specs/seo/`) sets for every other page rather than one of its own.
- **R3** — Every live storefront is listed where search engines will find it; every dead one is not.
- **R4** — A product keeps one address. Nothing here creates a second URL for the same goods.
- **R4a** — A storefront has one current address. For 180 days after a change, a visitor or crawler arriving on the previous one is sent permanently to the current one, so shared links and ranking consolidate rather than split; after that the old address stops resolving and may in time belong to another shop.
- **R5** — A visitor can browse the shops on the platform and reach one they had not heard of.
- **R5a** — Every product on the platform is a route into its seller's storefront, and that route works before any storefront has been shared or indexed.
- **R5b** — A visitor who arrives in a storefront that way can get back out — to the product they came from, and to the wider marketplace.
- **R6** — An inactive organisation gives crawlers a definite answer, so a closed shop's URL stops being re-checked.
- **R7** — The platform's existing crawl rules are extended deliberately to admit storefronts, and still exclude everything gated.
- **R8** — Nothing published here vouches for a shop on the shop's own word — the platform does not assert a rating an organisation supplied about itself.
- **R10** — A storefront declares no machine-readable price of its own. Prices are time-boxed offers resolved against the clock ([ADR-0018](../../../adr/0018-one-effective-price-function.md)); a second surface declaring them is seo (`planning-archive-2026-11-25:docs/specs/seo/`)'s problem to solve once, for the product page, and a storefront links to that page rather than restating it.
- **R9** — While the store is pre-launch, storefronts are as invisible to crawlers as everything else.

## Product acceptance

- **A1** — A storefront link shared to WhatsApp shows the shop's name and picture in the preview.
- **A2** — A storefront appears in the sitemap within a day of going live, and leaves it when the shop closes.
- **A3** — Searching a shop's name on Google reaches its storefront rather than a product page or nothing.
- **A4** — A visitor can find a shop they did not know existed without knowing its handle.
- **A4a** — A buyer who has never heard of a shop reaches it from a product they were already looking at, in one tap, with no search involved.
- **A4b** — That buyer can return to the marketplace without using the browser's back button.
- **A5** — Setting the pre-launch crawl block hides every storefront, exactly as it hides the rest of the store.
- **A6** — A closed shop's URL is retired by crawlers rather than re-checked indefinitely.

## Out of scope (this feature)

- Paid placement, sponsored shops, or any ranking of one shop above another.
- Shop-level ratings and review aggregation. Nothing rates an organisation today, and a platform asserting a self-supplied rating invites a manual action.
- Search across shops as a feature of the marketplace search.
- The metadata pattern itself, product structured data, and the `not-found.tsx` / `error.tsx` boundaries that make an honest HTTP answer possible — all seo (`planning-archive-2026-11-25:docs/specs/seo/`), Phase 10.
- The Search Console and Bing Webmaster work on the inherited WordPress index — tracked in [BACKLOG.md](../../../BACKLOG.md); this feature must not make it worse.
