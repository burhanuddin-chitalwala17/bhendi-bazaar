# TRD — seo

- **Status:** Draft
- **Domain:** cross-domain (catalog leads)
- **Phase:** 10 — Discoverability
- **Verified:** 2026-09-19
- **References:** [spec.md](spec.md), [ADR-0018](../../adr/0018-one-effective-price-function.md), [ADR-0023](../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md), [ADR-0009](../../adr/0009-docs-reference-code-never-copy-it.md), [org-storefront/trd.md](../org-storefront/trd.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

No new read path. Everything a search engine needs about a product is already resolved for the page that
displays it — `src/domain/product.ts` carries the resolved `salePrice`, `stock`, `rating`, `reviewsCount`,
`org` and `biddingSlug` on one shape — so the machine-readable description is a second **projection of the
same value**, built by a pure function from the object the page is already rendering. That is the whole
design: the declared price cannot drift from the displayed price because there is nothing for it to drift
from, and correctness is provable in a unit test rather than by inspecting a rendered page.

Everything else here is either a metadata function the route is missing, or a status code the route gets
wrong. Neither needs new infrastructure; both need to be enforced by a test that fails when the next route
is added without them, because a per-route obligation nobody checks is one that decays.

## Technical decisions

- **D1 — JSON-LD, not microdata or RDFa.** It is a separate node rather than attributes woven through the
  markup, so a styling change cannot break it, and it is a plain value that can be asserted on in a test.
  Microdata was rejected for the opposite reason: it couples the description to the DOM it is describing.
- **D2 — Builders are pure functions over the DAL shape, in a shared module, never a second query.** They
  take the same `Product` the page received and return the object to serialise. This is how
  [ADR-0018](../../adr/0018-one-effective-price-function.md) is satisfied without restating it: the builder
  has no access to a price of its own. A component that fetched the product again would be the defect the
  ADR describes.
- **D3 — Availability is derived three ways, matching the buy button exactly.** A present `biddingSlug`
  means the item is held out of normal sale ([ADR-0023](../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md));
  zero stock means out of stock; otherwise in stock. `status` alone never means purchasable, per the same ADR.
- **D4 — Price validity is declared from the offer window, or not at all.** Offers are resolved against a
  clock (`server/promotions/price-context.ts`), so a crawler that caches a page must be told when the price
  stops being true. Where no offer applies there is no window, and the field is omitted rather than invented —
  the same reasoning the current sitemap uses for `lastModified`.
- **D5 — An aggregate rating is declared only above a review-count floor, and never for an organisation.**
  Product ratings are collected by the platform from buyers and may be declared; an organisation has no
  rating the platform collected, which [storefront-discovery](../org-storefront/storefront-discovery/spec.md) R8
  already settles. The floor is an open question below.
- **D6 — `metadataBase` is set once on the root layout, and every public route gains `generateMetadata`.**
  Category titles and descriptions come from the category row, which already carries both. The search route
  is marked not-indexed but followable, so link equity still flows to the products it lists while the result
  page itself is not offered for ranking. `/s` leaves the sitemap.
- **D7 — Absence becomes a real not-found at the page, not in the data layer.** `src/data-access-layer/products.dal.ts`
  already keeps `NotFoundError` distinct from failure; the page discards that distinction by not handling it,
  and there is no `not-found.tsx` or `error.tsx` anywhere under `src/app`. Adding both boundaries is what makes
  404 and 500 separable at all — without them one rendering path serves both meanings.
- **D8 — Sitemap freshness comes from `Product.updatedAt`, projected through the DAL.** The column exists and
  is maintained by Prisma; `listSlugs` currently drops everything but the slug. Real recorded times only.
- **D9 — The sitemap stays a single file.** The 50,000-URL limit is far above this catalogue; splitting it now
  would be infrastructure for a problem we do not have. Revisit at five figures.
- **D10 — The pre-launch block is not re-implemented per emitter.** `src/lib/crawl-block.ts` already turns the
  whole site away at three layers, and structured data on a page no crawler may fetch is inert. A second gate
  inside each builder would be a second thing to remember and a second thing to get wrong.
- **D11 — Breadcrumbs reuse the ancestor trail the category page already reads.** `categoriesDAL.getAncestors`
  resolves against the request-memoised tree, so the machine-readable trail costs no additional query.

## Packages

One, types-only: **`schema-dts`** (Google, no runtime code) to type the JSON-LD objects the builders return.
A structured-data object is otherwise a bag of strings where a mistyped `@type` fails silently and is only
discovered in a testing tool, which is precisely the class of error the project's no-magic-strings rule
exists to prevent. Rejected alternative: hand-written interfaces for the four types we emit — cheaper today,
but they encode our reading of the vocabulary rather than the vocabulary. Add to [DEPENDENCIES.md](../../DEPENDENCIES.md)
with that justification.

## UI approach

Almost none — structured data is invisible, and metadata renders in the head. The two new surfaces are the
`not-found.tsx` and `error.tsx` boundaries, which are pages a buyer will occasionally see. Both are built on
`PageShell`/`PageHeader` at base width, single column at ~360px: a short heading, one line of explanation,
and one full-width primary action back to the catalogue, sitting above the bottom tab bar rather than at
`bottom-0` ([ADR-0016](../../adr/0016-mobile-app-shell.md)). Desktop adds nothing but width. Separately, the
alt-text work is content, not layout: the buyer-facing images currently passing `alt=""` get real text, and
the genuinely decorative ones keep the empty attribute deliberately.

## Data model

None. `Product.updatedAt` and `Category.description` both already exist; this feature only reads them.

## API / contract changes

None. Nothing here crosses the client/server DTO boundary — the builders run on the server and their output
is serialised into the page. No `[CONTRACT]` flag.

## Test plan

Unit tests over the builders are the substance, since a builder is a pure function: one case each for
in-stock, out-of-stock, held-by-bidding, on-offer and no-reviews, asserting that the declared price equals
the resolved price and that availability matches what the page would show. A route-sweep test in the style of
`tests/unit/design-tokens.test.ts` fails when a public page under `src/app/(main)` has no `generateMetadata`,
which is what keeps R1 true as routes are added. An integration test asserts a retired slug returns 404 and
not 200. Cross-reference [TESTING.md](../../TESTING.md).

## Delivery (PRs)

1. **Crawl health** — `notFound()` on absence, the two boundaries, `metadataBase`, `/s` not-indexed and out of
   the sitemap, alt text. **Changes behaviour:** status codes move from 200 to 404 on retired addresses.
2. **Page metadata** — `generateMetadata` and canonicals for the home, category and search routes, plus the
   route-sweep test. Closes the duplicate-title problem, which is the largest single ranking gap.
3. **Structured data** — the builder module and the product, breadcrumb, organisation and site emitters.
4. **Sitemap freshness** — `updatedAt` through the DAL into `lastModified`.

Independently verifiable in that order; 3 depends on nothing in 1 and 2 but is worth landing after them, since
a rich result pointing at a page with a duplicate title wastes the strongest signal on the weakest page.

## Open questions

- **The review-count floor for declaring an average (D5).** A floor of one is technically valid and
  reputationally reckless; the number has to be chosen deliberately before PR 3.
- **Whether Core Web Vitals (R12) needs work at all.** `@vercel/speed-insights` is already collecting field
  data in `src/app/layout.tsx` and nobody has read it. Measure after PR 1–3 rather than assuming; if the
  numbers are bad the cause is most likely the uncached storefront reads already on the watch list, which is
  not this feature's to fix.
- **Whether the storefront projection needs its own product-level declaration**, or whether R14 means a
  storefront product page simply canonicalises to `/product/<slug>` and declares nothing. Settle with
  [org-storefront/trd.md](../org-storefront/trd.md) before Phase 9 ships, not after.
