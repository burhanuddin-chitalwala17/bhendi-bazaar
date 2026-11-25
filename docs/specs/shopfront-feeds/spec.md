# Spec — shopfront-feeds

- **Summary:** Two feeds at public URLs — one Google Merchant Center fetches, one Meta Commerce Manager fetches — each listing every product a shop has sent to that channel at the price and availability a buyer would see
- **Status:** Implemented
- **Domain:** cross-domain (catalog, listing, promotions, bidding)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-14
- **References:** `431ed6e7:docs/specs/shopfront-feeds/trd.md`, [channel-registry](../channel-registry/), seo (`planning-archive-2026-11-25:docs/specs/seo/`), [ADR-0018](../../adr/0018-one-effective-price-function.md), [ADR-0023](../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md), [ADR-0041](../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)

> Requirements and product approach only. The technical approach was trd.md, removed once shipped (ADR-0073): `git show 431ed6e7:docs/specs/shopfront-feeds/trd.md`.

## What this feature is
A product feed per shopfront channel: a file at a fixed address on our site that Google, or Meta,
fetches on a schedule and turns into listings — free listings on Google Shopping, a catalogue on
Facebook and Instagram. Nobody uploads it; it is read fresh each time it is fetched.

## Why
Google and Meta are shopfront channels ([ADR-0041](../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)):
each comes and reads a file, needs no API approval, and sends the buyer back to our product page.
It is the cheapest real publishing there is, and the first test that the channel mappings work.
A feed that a person maintains by hand drifts within a day; one built on request cannot.
The two are built together because Meta reads Google's format; what differs is which shops opted in.

## Requirements
- R1 — A product listed, repriced, sold out, archived or put up for bidding is reflected the next
  time the channel fetches, with nobody doing anything.
- R2 — The declared price is the price the product page shows at that moment, offer included. A
  feed that says one price while the page says another is a policy violation, not a typo.
  Between fetches the feed may lag the page; the owner accepted that gap on 2026-10-14,
  since the page is always current and Google pauses a mismatched item rather than showing it.
- R3 — An item held by a live bidding event is declared not buyable, though nothing on the product
  says so ([ADR-0023](../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)).
- R4 — Only what a buyer could reach is listed: not archived, from a shop that is trading.
- R5 — A shop is in a channel's feed only if it has turned that channel on in its settings, and
  each channel is its own answer: Google on and Meta off puts the shop in one feed only. Off is
  what a shop that was never asked means; the platform never publishes a shop's goods unasked.
- R6 — Each product carries the category its type is mapped to for that channel, from the channel
  mappings already recorded, so a feed and the readiness screen cannot disagree.
- R7 — Every link and image in a feed opens on our domain, and the link is the product's page.
- R8 — While the pre-launch crawl block is on, both feeds list nothing, as the sitemap does.

## Hazards the TRD must answer
- **A cached feed is a stale price.** Whatever caching is chosen has to be argued against R2.
  *Answered by D1.*
- **Buyable is three answers, not one** — stock, archive, bidding. Deciding it a fourth way in the
  feed is how the feed and the buy button come to disagree. *Answered by D2 and D4.*
- **A product with no image or no description** is rejected by both channels. It must be left out
  or sent knowingly, not discovered in a diagnostics screen.
  *Answered by D8.*
- **The channels agree today and already disagree in places** — Google writes `in_stock`, Meta
  `in stock`. One feed served to both would hide the first disagreement that matters.
  *Answered by D3.*

## Product acceptance
- A1 — With a shop's Google switch on, a newly saved product appears in the Google feed on the next load.
- A2 — A product on offer is declared at its offer price, with its list price alongside.
- A3 — An out-of-stock, archived, or bidding-held product is out of stock or absent, matching its page.
- A4 — A shop with Google on and Meta off is in the Google feed and absent from the Meta feed.
- A5 — Merchant Center and Commerce Manager each accept their URL as a scheduled fetch with no
  feed-format errors.

## Out of scope (this feature)
- Product structured data on pages — seo (`planning-archive-2026-11-25:docs/specs/seo/`).
- Instagram posts, and Meta's own checkout (not offered in India) — `instagram-post`, later.
- Per-shop feeds and shops' own Merchant Center or Business accounts — later, with `channel-connectors`.
- Shipping and returns, which are set once in each channel's console, not per product.
