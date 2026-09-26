# Spec — org-storefront

- **Summary:** Every selling organisation gets a storefront of its own at a link it can promote
- **Status:** ✅ Implemented — all seven subfeatures; each carries its own spec
- **Domain:** catalog, with cross-domain reads
- **Phase:** 9 — Seller storefronts
- **Verified:** 2026-09-19
- **References:** [multi-vendor-marketplace](../multi-vendor-marketplace/), [promotions](../promotions/), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0016](../../adr/0016-mobile-app-shell.md), [ADR-0018](../../adr/0018-one-effective-price-function.md), [ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md), and the subfeatures below

> Requirements and product approach only. Each subfeature's technical approach lives in its own `trd.md`.

## What this is

Every selling organisation gets its own storefront on the platform — a page that looks like theirs, lists
only their goods, searches only their catalogue, and lives at a link they can print on a card, paste into
a WhatsApp status or run an advertisement against.

## Why

A small shop that joins this marketplace today becomes invisible. The organisation is a real aggregate in
the data — it owns products, offers, shipments, earnings — and it is rendered nowhere a buyer can see.
Nothing on the storefront names who sold a thing, and there is no address a seller can hand to their own
customers. That is the wrong trade for them: they gave up their shopfront and got a catalogue entry.

The offer this programme makes is the one that brings a small business online at all — *you get a web
address of your own, and we run the rest of it.* The platform keeps what it is good at (payments, courier
rates, one checkout, one index that ranks) and the seller gets back the thing they lost.

## This reverses a recorded decision

[multi-vendor-marketplace](../multi-vendor-marketplace/spec.md) states under its out-of-scope heading:
*"Per-organisation branding, domains, or storefronts. One storefront, many vendors."* That was right when
the question was how to split a portal. It is being reversed deliberately, not by accident, and the
reversal is recorded in an ADR rather than by editing that spec.

## Requirements

- **R1** — Every organisation has a public storefront at a stable, human-readable URL it can promote. The URL survives the organisation renaming itself.
- **R2** — The storefront presents the organisation: its mark, a hero, who it is and what it sells. Reaching a human goes through the platform's own Contact us, never a channel of the shop's own (see out of scope).
- **R3** — The storefront lists that organisation's products and no other's, and buying from it behaves exactly as buying from the marketplace does.
- **R4** — A visitor can search, browse by category and filter within one organisation's catalogue without leaving its storefront.
- **R5** — From any product, a buyer can see which organisation sells it and reach that organisation's storefront.
- **R6** — An organisation composes its own storefront from the seller portal — no ticket, no deploy, no platform involvement.
- **R7** — A shared storefront link renders a correct preview wherever it is pasted, naming the organisation rather than the platform, and is indexable in its own right.
- **R8** — A storefront is a view of the marketplace, not a separate shop: one basket may hold goods from several organisations and is paid for once.
- **R9** — A storefront shows only what its organisation chose to publish. Nothing the platform holds commercially about it — commission, ledger, settlements, tax identifiers — is reachable.
- **R10** — An organisation that is inactive, or has nothing to sell, has a defined public answer at its URL rather than an error.
- **R11** — A visitor who arrives on a storefront can still reach the rest of the marketplace.
- **R12** — An organisation's own running offers appear on its storefront, through the one price resolver every other surface uses.
- **R13** — The platform can withdraw an organisation from public view with one switch — reads already honour it, the purchase refusal does not yet exist — and that removes its storefront *and every one of its products, everywhere on the platform* — not only from `/store/<handle>`. It is reversible and deletes nothing.
- **R14** — Each shop states its own delivery and returns terms, and a buyer can find them before they pay.

## Product acceptance

- **A1** — A seller pastes one link into WhatsApp; the recipient opens it on a phone, recognises whose shop it is, and completes a purchase without ever seeing a page that is not theirs.
- **A2** — Searching "kurta" on a storefront returns that organisation's kurtas only, and the same word on the marketplace returns everyone's.
- **A3** — Renaming an organisation does not break a link printed six months earlier.
- **A4** — Two organisations with near-identical names both get a working, distinct link.
- **A5** — A buyer on a product page can tell who sells it in one glance and reach their storefront in one tap.
- **A6** — An organisation uploads a logo and a banner, writes an introduction, and sees its storefront change without anyone else acting.
- **A7** — A basket holding goods from two organisations still checks out once, and each organisation still sees only its own part.
- **A8** — Editing a storefront URL cannot surface another organisation's goods, an inactive organisation, or any commercial term.
- **A9** — A storefront link shared to Instagram, WhatsApp and Google shows the organisation's name and mark, not the platform's.

## Hazards this programme must answer

Stated here so no subfeature's TRD can quietly skip one.

- **H1 — `/org` is already taken, and excluded from search.** It is the seller portal: gated in `src/middleware.ts` and disallowed in `src/app/robots.ts`. A public storefront cannot share that prefix, and whatever prefix it does take has to be added to the crawl rules deliberately.
- **H2 — A handle is public, changeable, and printed on things that cannot be recalled.** A retired handle is held 180 days — redirecting, and unavailable to anyone else — then released back to the pool. Both halves have teeth: without the hold, a rename silently 404s every card and paid advertisement in circulation; with the release, a link printed two years ago can eventually carry a customer to a **different shop**, which is worse than a dead one and indistinguishable from arriving at the right place. The window is the only thing between those outcomes, so it is a setting rather than a literal. Every existing organisation also has no handle at all, so one must be produced for every row before anything may link to one, and near-identical names must not collide.
- **H3 — The same product becomes reachable at two URLs.** Marketplace and storefront show one product. Left unstated, a search engine splits the ranking signal between them, which defeats the argument that justifies the feature.
- **H4 — Every storefront query runs for a stranger.** These are the first org-scoped reads with no membership behind them. Inactive organisations, unpublished storefronts and commercial fields must be unreachable by editing a URL, and that has to be a property of the query rather than of a template.
- **H5 — A seller writes text and links that strangers read on the platform's domain.** Introductions, policies and social links are organisation input rendered publicly under the platform's name. Unconstrained, that is an injection surface and a route to selling off-platform.
- **H6 — A storefront is public from the moment its organisation exists, and so is every product in it.** There is no approval step, and creating a product puts it on sale immediately: `Product.archivedAt` is a *withdrawal* state, not a draft one ([ADR-0029](../../adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md)), so nothing lets an org build a catalogue privately and reveal it. That is the decision ([ADR-0030](../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md) decision 9), not an oversight — but the empty shop and the half-built shop are both states the design has to carry well, not error paths. Curation is not blocked: `ProductFlag.FEATURED` and `HERO` exist (`server/catalog/product.flags.ts`), orgs set them through the product form, and `ProductFilter.featuredOnly` reads them — and archiving now gives an org a way to take one item off its shelf without deleting it.
- **H7 — A shared link is exactly the URL that gets a spike.** The storefront grid runs the same uncached, unpaginated catalogue read the category page does; see the storefront-caching entry in [BACKLOG.md](../../BACKLOG.md), which [ADR-0018](../../adr/0018-one-effective-price-function.md) constrains.
- **H8 — Deactivating an organisation does not recall its printed links.** What a promoted URL answers after the shop closes is a product decision, not a 500.
- **H9 — The withdrawal switch half works, and the missing half is the one that refuses a purchase.** `FROM_ACTIVE_ORG` (`server/catalog/product.visibility.ts`) is now spread by every public product read, so a withdrawn org's goods stop being *shown*. Nothing yet stops them being *bought*: the order transaction carries `assertNotUnderBidding` and `assertNotArchived` and no org equivalent, and every `isActive` check on the checkout path is on `OrgAddress` (pickup locations), not `Org`. Hiding is not refusing ([ADR-0029](../../adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md) decision 4), so [org-withdrawal](org-withdrawal/) still owns the gate — but it is now one assertion beside two that already exist, not the sweep this hazard first described.

## Subfeatures

| Subfeature | Requirement | Depends on |
| --- | --- | --- |
| [org-handle](org-handle/) | An organisation has a stable, public, human-readable name in a URL | — |
| [seller-identity](seller-identity/) | A buyer can see who sells a product and reach them | org-handle |
| [storefront-pages](storefront-pages/) | An organisation has a landing page and an about page of its own | org-handle |
| [storefront-browse](storefront-browse/) | Search, categories and filters, scoped to one organisation | storefront-pages |
| [storefront-branding](storefront-branding/) | An organisation composes its own storefront from the portal | storefront-pages |
| [storefront-discovery](storefront-discovery/) | A shared link previews, ranks, and every shop is findable | all of the above |
| [org-withdrawal](org-withdrawal/) | One switch takes a shop off the platform entirely, and puts it back | — |

`org-withdrawal` depends on nothing and can ship first; it closes a gap that exists on the marketplace
today, and it is the promise the rest of the programme rests on — publishing pages under the platform's
name with no gate in front of them is only defensible with a working way to take one down.

`org-handle` blocks every remaining subfeature. `seller-identity` is both the smallest slice with standalone value — it can
ship before any storefront exists — and the channel through which most storefronts will actually be found: a
buyer already looking at a product is the platform's own route into its seller's shop, and it needs nothing
shared and nothing indexed. `storefront-discovery` covers the slower channels, not the main one.

## Out of scope (this programme)

- **Subdomains and custom domains.** Decided against for now — see the decisions in [trd.md](trd.md) — and reachable later without moving the canonical URL.
- **A page builder.** Sellers fill in fields; they do not arrange blocks. The Amazon-Stores shape is a CMS and is larger than everything above put together.
- **Per-organisation checkout, payment accounts, or shipping policy.** R8 settles this: one basket, one payment, one set of courier rates.
- **A product draft or publish state**, and any approval or verification before a storefront goes live. Decided against in [ADR-0030](../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md) decision 9 — a shop is live when its organisation is created.
- **Following a shop, shop notifications, or shop-level messaging.**
- **A shop's own contact channel.** Decided 2026-09-19: [contact-us](../contact-us/) stays platform-scoped, so a storefront publishes no WhatsApp number, phone or inbox of its own and a buyer with a question reaches the platform. Revisit when a shop is expected to answer for itself.
- **New offer mechanics.** `Promotion` already carries `scope: ORG`; R12 is about surfacing what exists.
- **The platform's own About and landing pages.** Platform marketing, not a seller surface.
