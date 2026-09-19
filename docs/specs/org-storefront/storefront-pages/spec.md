# Spec — storefront-pages

- **Status:** Draft
- **Domain:** catalog
- **Phase:** 9 — Seller storefronts
- **Verified:** 2026-09-15
- **References:** [../spec.md](../spec.md) (programme), [../trd.md](../trd.md) D1/D5/D10, [org-handle](../org-handle/), [ADR-0015](../../../adr/0015-mobile-first-design.md), [ADR-0016](../../../adr/0016-mobile-app-shell.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

The storefront: a landing page for one organisation, an about page behind it, and a grid of that
organisation's goods — all at a link the organisation can hand out.

## Why

This is the thing being sold to a small business. A shop that closed its shutters and moved online wants an
address of its own, not a row in someone else's catalogue. The landing page is what an advertisement points
at; the about page is what makes a stranger willing to pay a shop they have never heard of.

The pages have to be worth arriving at cold, on a phone, from a WhatsApp forward — because that is how
almost every visit will start.

## Requirements

- **R1** — An organisation's storefront is reachable at a stable public URL built from its handle.
- **R2** — The landing page shows the organisation's mark, a hero, a one-line description of what they sell, and their goods.
- **R3** — The about page tells the organisation's story and how to reach them.
- **R4** — Only that organisation's goods appear, and every one of them behaves as it does on the marketplace: same price, same offers, same stock, same suspension when it is up for bidding.
- **R5** — Buying from a storefront puts goods in the same basket as buying from the marketplace, and there is one checkout.
- **R6** — A visitor can leave for the wider marketplace at any point, and reach their cart and account from within a storefront.
- **R7** — A storefront exists from the moment its organisation is created, with no approval, verification or publish step in between. Its address is shareable before it has listed anything.
- **R7a** — An organisation with nothing to sell yet shows a page that says so and still looks like a shop — this is the first state every storefront is in, not an error path.
- **R8** — An inactive organisation's URL gives a definite public answer, and it keeps its handle — being withdrawn hides a shop, it does not give away its address.
- **R9** — Nothing on any storefront page can be made to show another organisation's goods, or any commercial term, by editing the URL.
- **R10** — The landing page is designed for a phone first and holds a stranger's attention there.

## Product acceptance

- **A1** — A link pasted into WhatsApp opens on a phone as a page recognisably belonging to one shop.
- **A2** — A visitor who has never heard of the shop can, from these two pages alone, learn who they are and buy something.
- **A3** — Adding an item from a storefront and another from the marketplace yields one basket and one payment.
- **A4** — From a storefront, the cart, the account menu and the marketplace are each one tap away.
- **A5** — Changing the handle in the URL to another organisation's shows that organisation's shop and nothing of the first.
- **A6** — A brand-new organisation's storefront is presentable before it has listed anything, and its owner can share the link that same minute.
- **A7** — Nobody at the platform has to act between an organisation being created and its storefront being reachable.

## Out of scope (this feature)

- Scoped search, category navigation and filters — [storefront-browse](../storefront-browse/).
- Letting an organisation edit any of this — [storefront-branding](../storefront-branding/). Until that lands, the pages are built from fields the organisation already has: name, description, logo.
- Link previews, sitemap entries and the shop directory — [storefront-discovery](../storefront-discovery/).
- Curated or featured products. There is no draft state on a product to curate from (programme hazard H6).
- Re-serving product pages under the storefront path. One product keeps one URL ([../trd.md](../trd.md) D4).
