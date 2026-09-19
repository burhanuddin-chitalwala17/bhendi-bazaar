# Spec — org-withdrawal

- **Status:** Draft
- **Domain:** catalog, reaching into cart, checkout, bidding, promotions
- **Phase:** 9 — Seller storefronts
- **Verified:** 2026-09-19
- **References:** [../spec.md](../spec.md) (programme) R13 and H9, [../trd.md](../trd.md) D9b, [ADR-0030](../../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md) decision 10, [ADR-0023](../../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md), [bidding](../../bidding/)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

One switch that takes an organisation off the platform — its storefront and every one of its goods,
everywhere a buyer can see them — and one that puts it back.

## Why

It is the platform's only remedy. A storefront is live the moment an organisation is created, with no
approval in front of it ([ADR-0030](../../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md)
decision 9), which is the right trade only if there is a way to act on a shop that turns out to be selling
something it should not. Without it the platform has published a page under its own name and has no way to
withdraw it.

`Org.isActive` already exists and is already set by the console. **It currently does nothing a buyer would
notice** — no storefront or catalogue query reads it, and the only `isActive` filters on the read path are
on `OrgAddress` pickup locations. So the switch is in the wall with no wire behind it, and the platform
believes it has a control it does not have. That is worse than knowing there is none.

The same switch is what an organisation that closes should get: goods gone from sale, nothing deleted.

## Requirements

- **R1** — Making an organisation inactive removes it from every place a buyer could encounter it: its storefront, listings, category pages, search, suggestions, home-page rows, similar-product rails, the sitemap, and its products' own pages.
- **R2** — It removes the organisation's goods from those places too, not merely the organisation. A withdrawn shop's product must not remain buyable through a link someone already has.
- **R3** — Nothing about withdrawal is destructive. The organisation, its catalogue, its media, its offers and its history all survive exactly as they were.
- **R4** — Reactivating restores everything, with nothing to re-enter and no backfill to run.
- **R5** — A purchase of a withdrawn organisation's goods is refused at the point the order is written, not only hidden from the page. A buyer who already had it in a basket, or who replays a request, is refused.
- **R6** — Goods that vanish this way leave a basket the way goods that go to auction already do, rather than failing at payment.
- **R7** — Orders, shipments, ledger entries and settlements that already exist are untouched and still render, for the buyer, the organisation and the platform.
- **R8** — The organisation itself keeps its portal. Withdrawal is about what the public sees, not about locking people out of their own records.
- **R9** — An open bidding event on a withdrawn organisation's product stops accepting bids and stops being publicly reachable.
- **R10** — A withdrawn organisation's offers stop being advertised and stop applying.
- **R11** — The platform can see which organisations are withdrawn, and when, and by whom.
- **R12** — A withdrawn organisation's URLs give crawlers a definite answer, so they are dropped rather than re-checked indefinitely.

## Product acceptance

- **A1** — Withdrawing an organisation removes its products from the home page, every category, search, suggestions and the sitemap, with no further action.
- **A2** — A direct link to a withdrawn organisation's product, held from before, no longer reaches a page that can be bought from.
- **A3** — A basket holding a withdrawn organisation's goods cannot be checked out, and says why rather than failing at the gateway.
- **A4** — A request replayed against the order endpoint after withdrawal is refused.
- **A5** — An order placed before withdrawal still opens, for the buyer and for the organisation, with every line intact.
- **A6** — Reactivating puts everything back within one page load, and nothing had to be re-entered.
- **A7** — A withdrawn organisation's owner can still sign in and see their own orders and earnings.
- **A8** — A bid cannot be placed on a withdrawn organisation's item.
- **A9** — A coupon belonging to a withdrawn organisation stops working.

## Hazards

- **H1 — There are at least a dozen public read paths and the compiler cannot tell you when you miss one.** Listings, product page, similar products, hero row, offers row, search, suggestions, sitemap, wishlist, storefront, bidding page. Missing one leaves a withdrawn shop selling, which is exactly the failure this feature exists to prevent. [ADR-0023](../../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md) admits the same weakness for bidding; whatever makes this checkable has to be a test, because nothing else will catch it.
- **H2 — Hiding is not refusing.** A page that stops rendering a button still has a route behind it. The authoritative refusal belongs where the stock guard already is, inside the order transaction — the one race-safe point the codebase has.
- **H3 — Withdrawal must not read as deletion anywhere on the money path.** Records carrying money or attribution never disappear ([ADR-0020](../../../adr/0020-money-bearing-records-never-cascade.md)); a past order is a fact about what happened and is not the platform's to unpublish.
- **H4 — A buyer can be mid-checkout when the switch is flipped.** They must be told, not charged and then disappointed.
- **H5 — Withdrawal is a fact about an organisation, and it must not be copied onto its products.** A per-product flag would need writing at withdrawal and unwriting at reactivation, and would be wrong in between — the mistake [ADR-0023](../../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md) already rejected for bidding.
- **H6 — This is the first change in the programme that touches the marketplace rather than only the storefront.** Every existing buyer-facing query is in scope, so the blast radius is larger than anything else here.

## Out of scope (this feature)

- Any approval, verification or gate *before* a shop goes live. Decided against in [ADR-0030](../../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md) decisions 9 and 10; review is a manual pass over live shops.
- Detecting non-compliance. This is the remedy, not the alarm — who looks, and what prompts a look, is a person's job for now.
- Partial withdrawal — hiding one product, or one category of a shop's goods. The switch is the whole organisation.
- Telling a withdrawn organisation why, or any appeal flow.
- Withdrawing an individual product. That is a product-status feature and does not exist.
