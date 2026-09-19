# TRD — org-storefront (programme)

- **Status:** Draft
- **Domain:** catalog, with cross-domain reads
- **Phase:** 9 — Seller storefronts
- **Verified:** 2026-09-19
- **References:** [spec.md](spec.md), [ADR-0009](../../adr/0009-docs-reference-code-never-copy-it.md), [ADR-0012](../../adr/0012-modules-are-vertical-slices-by-domain.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0018](../../adr/0018-one-effective-price-function.md), [ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md), [multi-vendor-marketplace](../multi-vendor-marketplace/)

> Programme-level technical decisions only — the ones every subfeature inherits. Per-subfeature approach lives in each subfeature's own `trd.md`. No code; references to existing code only, to justify a decision.

## Approach

A storefront is a **scoped projection of the marketplace**, not a second application. The same catalogue,
the same price resolver, the same cart, the same checkout — read through one more filter and dressed in
the organisation's own chrome. Nothing about a product changes because it is being shown on a storefront,
which is the same shape [ADR-0023](../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)
took for bidding and for the same reason: a projection cannot go stale, and a copy can.

The work lands in `server/catalog/`, which already owns organisations, products and categories
([ADR-0012](../../adr/0012-modules-are-vertical-slices-by-domain.md)). No new domain.

## Technical decisions

- **D1 — The storefront lives at a path on the platform's domain.** `/store/<handle>`, a new top-level route group, not a subdomain and not a per-org custom domain. One domain pools search authority, so a shop with no links of its own can still rank; session, cart and NextAuth cookies keep working untouched; and nothing has to operate wildcard DNS, wildcard certificates or per-domain provisioning. A subdomain can be layered on later as a redirect **to** this URL without moving the canonical one. Answers H1.
- **D2 — `/store` is a distinct prefix from `/org`, deliberately.** `/org` is the seller portal: gated in `src/middleware.ts` and disallowed in `src/app/robots.ts`. The storefront is anonymous and must be crawled, so it cannot share the prefix, and `robots.ts` has to allow `/store` explicitly rather than by omission. H1.
- **D3 — The handle is generated at creation and changeable thereafter, with a configurable redirect window, currently 180 days.** Generated from the name so nothing is asked of an owner on day one; changeable because a public address an algorithm chose should not be permanent. What makes it safe is that a change *adds* to history rather than replacing it — for a bounded window. Renaming the organisation moves nothing by itself. Collisions are resolved at generation against every handle currently in use or still held, never by the caller. H2.
- **D3a — Changing a handle is its own authorised operation.** Not a field on an organisation update, not settable at creation by the caller, and reachable only by the organisation's own owner or a platform administrator. [Invariant 4](../../../CLAUDE.md)'s prohibition on mass assignment is what is being preserved; the field simply stops being server-owned. No cap on frequency for now — a rate limit layers on top later without disturbing anything here. The owner is told what moves and what stops working, and when, before confirming.
- **D3b — The current handle is canonical, and a retired one redirects to it for 180 days.** A permanent redirect rather than a served page, so shared links and search engines consolidate on one address instead of splitting. This is the only redirect history in the project — `Product.slug` is frozen under Invariant 4 and has none, which is why the slug-redirects entry in [BACKLOG.md](../../BACKLOG.md) exists. Nothing here changes that; product slugs stay frozen.
- **D3c — A retired handle is held for a configurable window, currently 180 days, then released.** While held it redirects to the current handle *and* is unavailable to anyone else — one lifetime, one record, so there is no way for the two to disagree. Past it the handle returns to the pool and answers 404 until someone takes it; deliberately not 410, which tells a crawler the address is gone for good and would be a lie about a handle that can be reissued.
- **D3d — An organisation may revert to a handle it holds.** Inside the window that is guaranteed, since nobody else can have taken it. Outside it, the handle is ordinary — available if free, gone if not. A revert is an ordinary handle change and retires the handle being left in the usual way.
- **D3e — Claiming a handle deletes any redirect pointing away from it, in the same operation.** Reverting from `b` to `a` while `a → b` is still live is a redirect loop otherwise. The rule is unconditional rather than a revert-only special case, so no future path can reintroduce the loop.
- **D4 — The marketplace URL stays canonical for a product.** A storefront links to `/product/<slug>`; it does not re-serve the product under `/store/<handle>/…`. One product, one URL, no `rel=canonical` bookkeeping to maintain and no split ranking signal. The organisation's identity travels on the product page instead (`seller-identity`). H3.
- **D5 — Publicity is a property of the query, not the page.** Every storefront read goes through one org-scoped path that filters on the organisation being active and publishable and selects only publishable columns. `commissionBps`, `maxDiscountBps`, `gstNumber`, `panNumber`, ledger and settlement rows are never in the select list, so no template can leak one. This mirrors `toOrgOrderView` in `src/data-access-layer/org/orders.dal.ts`, which keeps a buyer's basket out of an org's view the same way. H4, and R9.
- **D6 — `ProductFilter` gains an `orgId`, resolved server-side.** `server/catalog/product.types.ts:37` has no org dimension today, so `getProducts` cannot scope a listing (`server/catalog/product.repository.ts:211`). The handle is resolved to an id on the server; the client never supplies an org id, matching how `categoryIds` is already described as "resolved server-side, never client input".
- **D6a — Storefront images go through the platform's image seam, not a second one.** Object store plus optimizer, under the stored ceiling ([ADR-0026](../../adr/0026-images-are-delivered-through-the-optimizer.md), [ADR-0028](../../adr/0028-images-live-in-cloudflare-r2.md)). A hero is the heaviest thing a storefront serves and the transfer allowance is shared with the whole catalogue, so a bypass here is charged to every other page.
- **D7 — Prices resolve through the one function.** `resolveProductPrice` via `loadPriceContext`, exactly as `src/data-access-layer/products.dal.ts` already does. A storefront that computed its own price would be the defect [ADR-0018](../../adr/0018-one-effective-price-function.md) exists to prevent, and org-scoped offers are already `Promotion.scope = ORG`, so R12 needs no new mechanism.
- **D8 — Branding is a fixed set of validated fields, and its one visual axis is a token.** Logo, hero, tagline, introduction, policies and links; the accent is chosen from the palette declared in `src/app/globals.css`, never a free colour value. Every other axis — type, tracking, elevation, shape, page width — stays as [ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md) sets it, so `tests/unit/design-tokens.test.ts` keeps holding and no seller can break a layout.
- **D9 — Seller-supplied text is parsed and rendered as text, and seller-supplied links are constrained.** Zod schemas under `src/lib/validation/schemas/`, plain text rather than markup, an allowlist of link destinations, and lengths that make a page rather than a pamphlet. H5.
- **D9a — A storefront is live from the moment its organisation is created, and nothing gates it on the way in.** No verification, no approval, no publish flag; `Org.isVerified` stays unread. The empty-shop state is a designed page, not an error path, because for a brand-new organisation it is the *first* thing the storefront is — and the address has to be shareable before there is anything to sell.
- **D9b — `Org.isActive` withdraws an organisation, through the seam that already exists.** The read half is done: `FROM_ACTIVE_ORG` in `server/catalog/product.visibility.ts` sits beside `ON_SALE` and is spread by every public product read, so archiving and withdrawal are two dimensions of one rule rather than two mechanisms. What [org-withdrawal](org-withdrawal/) still owns is the refusal — an assertion inside the order transaction beside `assertNotArchived` (`server/catalog/product.sale-gate.ts`), after the stock reservation, for the locking reason that gate documents — plus the cart, wishlist and bidding behaviour around it. The storefront's own answer for an inactive org is D10's 404.
- **D10 — An inactive organisation's storefront answers 404, not 500 and not an empty shop.** Deactivation hides a shop; it does not retire its address, so the handle is still that organisation's current one and no holding clock starts. `notFound()` gives a crawler a real answer. A closed shop that keeps serving a live-looking page is worse than one that is gone. H8.
- **D11 — Storefront listings paginate and cache what carries no resolved price.** The catalogue rows and the category tree may be cached; the live offer set and price resolution stay per-request, which is exactly what [ADR-0018](../../adr/0018-one-effective-price-function.md) constrains and what the storefront-caching entry in [BACKLOG.md](../../BACKLOG.md) already scopes. H7.

## Packages

None expected. Images go to Cloudflare R2 and are served through the optimizer ([ADR-0028](../../adr/0028-images-live-in-cloudflare-r2.md), [ADR-0026](../../adr/0026-images-are-delivered-through-the-optimizer.md)); social previews use `next/og`, introduced by [bidding](../bidding/trd.md) D18.

## UI approach

Mobile-first ([ADR-0015](../../adr/0015-mobile-first-design.md)); a storefront is opened from a pasted link,
which means a phone almost every time. The storefront takes its own route group with its own chrome — the
organisation's mark and its scoped search in place of the platform navbar — while keeping the bottom tab
bar, the cart and the account menu, so R11 holds and a visitor is never trapped in one shop. Grids follow
`PRODUCT_GRID_CLASSES` at 3-up ([ADR-0016](../../adr/0016-mobile-app-shell.md)). Per-surface layouts are
each subfeature's business.

## Data model

`[MIGRATION]`, in `org-handle` and again in `storefront-branding`. `Org` gains a unique handle and a
storefront presentation group. No change to `Product`, `Cart`, `Order` or anything on the money path.

## API / contract changes

`[CONTRACT]` in `seller-identity`: `OrgSummary` (`server/catalog/org.types.ts`) gains the handle, since a
product card has to link to a storefront without a second round trip. `docs/CONTRACTS.md` moves with it.

## Test plan

Per [TESTING.md](../../TESTING.md). Unit: handle generation — collisions, transliteration, reserved words,
and stability across a rename. Guard tests, the substantive ones: no storefront query selects a commercial
column; an inactive organisation's handle 404s; a storefront listing returns rows for exactly one
organisation across search, category and filter paths. Integration: a basket spanning two organisations
still checks out once and still splits into per-org shipments.

## Open questions

None blocking. Two policies are settled and recorded rather than left open:

- **Whose terms are whose** — delivery and returns belong to the shop, payment and fraud to the platform, and a shop cannot disclaim the latter (`storefront-branding` R3a/R3b). What remains is drafting the platform's own wording, which is not an engineering question.
- **Who watches storefronts** — the platform owner reads them by hand, after a shop is live. Nothing is blocked on the way in and nobody waits for approval (D9a); a non-compliant shop is withdrawn with `Org.isActive` (D9b). An approval system may come later; it is deliberately not designed now, because a queue nobody has time to work is worse than a manual pass somebody actually does.
