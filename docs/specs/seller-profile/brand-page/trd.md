# TRD — brand-page

- **Status:** ✅ Accepted — 2026-09-26
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-09-25
- **References:** [spec.md](spec.md), [../trd.md](../trd.md) (seller-profile), [org-storefront trd](../../org-storefront/trd.md), [ADR-0013](../../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0022](../../../adr/0022-design-decisions-go-through-tokens.md), [ADR-0026](../../../adr/0026-images-are-delivered-through-the-optimizer.md), [ADR-0030](../../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md), [ADR-0033](../../../adr/0033-a-domain-is-reached-through-its-public-surface.md), [ADR-0034](../../../adr/0034-render-on-the-server-by-default.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

The page at `src/app/(store)/store/[handle]/about/page.tsx` stays a server component and becomes a sequence of section components, each fed one slice of a single page DTO and each returning nothing when its slice is empty. The DTO is assembled once in `server/catalog/storefront.service.ts` from the public profile ([../trd.md](../trd.md) D1, D3) plus derived facts read through other domains' public surfaces. The landing page's existing tiles are reused for categories and goods, so price, offers and bidding suspension come for free and are never re-implemented.

## Technical decisions

- **D1 — One `BrandPageDto`, built in the storefront service, public face only.** Its keys extend the storefront DTO allowlist test from [../trd.md](../trd.md) D3, so a private column cannot reach it by accident.
- **D2 — Derived proof is read through public surfaces, never repositories.** Rating and count from the reviews service's aggregate (already the one source per [product-reviews](../../product-reviews/spec.md) R6a), and the newest published reviews across the org's products from the same service under its published-only predicate, capped at three; orders fulfilled from a count the checkout domain exposes for an org, under its own visibility predicate so expired checkouts are never counted ([ADR-0033](../../../adr/0033-a-domain-is-reached-through-its-public-surface.md)); since-when from the org's join date. Each is one query per page view; if [read-caching](../../read-caching/) lands, these are its first candidates, and none carries a price.
- **D3 — Floors are declared once.** A rating shows only with at least a declared minimum of reviews, an orders figure only above a declared minimum; below the floor the stat is omitted, not shown small (spec R4). Constants live beside the DTO, not in the component.
- **D4 — Sections self-omit.** Each section component takes its slice and returns null on empty; the page never branches on "has the seller written this". This is what makes spec R2 a property rather than a review item.
- **D5 — Reuse the landing page's tiles.** Category tiles are the storefront's `CategoryLanes`; newest goods are a fixed-size slice through the same product grid components the landing page uses, so [ADR-0018](../../../adr/0018-one-effective-price-function.md) and the bidding lock context apply unchanged.
- **D6 — New public-face columns on `OrgProfile`.** Owner name, role, quote and photo; `pillars` as JSON of at most three `{title, text}`; `social` as JSON of handles keyed by network; `hiddenSections` as JSON of section keys. All nullable. Text is stored and rendered as text ([ADR-0030](../../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md) D9). The owner photo becomes a media asset reference when [media-library](../../media-library/) lands; until then it follows the hero's path.
- **D7 — Social links are built from an allowlist of networks.** A handle is validated to the network's handle shape and rendered as a URL the platform composes; the seller never supplies a URL. The banner `href` rule in the org-storefront TRD is the precedent for refusing arbitrary destinations.
- **D8 — Brands carried lists names only**, from the Brand aggregate ([../trd.md](../trd.md) D2), shown when the org has more than one active brand. Manufacturer and origin are private face and never join this query.
- **D9 — The editor grows in place.** The existing storefront editor gains owner, pillars, social and section toggles, validated by the same Zod schema through `useServerForm` ([ADR-0013](../../../adr/0013-one-error-envelope-and-useserverform.md)), with the live preview [storefront-branding](../../org-storefront/storefront-branding/spec.md) R4 already requires.
- **D10 — Metadata and link preview from the DTO.** `generateMetadata` already reads the storefront; it adds Open Graph image, title and description from cover, name and tagline. Structured data stays with [seo](../../seo/).

## Packages

None.

## UI approach

Phone first, single column. First screen: cover at the phone banner aspect with the mark overlapping its lower edge, name, tagline, a muted line for location and since-when, then the proof strip as up to three compact stats; the call to shop is docked at `bottom-tabbar` ([ADR-0016](../../../adr/0016-mobile-app-shell.md)). Then story with the owner photo as a small round portrait and the quote set larger than body; category tiles in the 3-up grid; pillars as stacked cards; brands as a wrapped row of chips; newest goods as a 3-up grid of six with a "see all" link; terms in a collapsed disclosure; social as an icon row. Desktop adds a wide 16:9 cover, a two-column story with the portrait beside the text, and a 4-up grid. Every colour, size and radius through tokens ([ADR-0022](../../../adr/0022-design-decisions-go-through-tokens.md)); every control through the primitives ([ADR-0031](../../../adr/0031-one-components-home-organised-by-domain.md)).

## Data model

[MIGRATION] `OrgProfile` gains `ownerName`, `ownerRole`, `ownerQuote`, `ownerPhotoUrl`, `pillars` JSON, `social` JSON, `hiddenSections` JSON. Depends on [../trd.md](../trd.md) D1 having created the table.

## API / contract changes

[CONTRACT] `BrandPageDto` added; the storefront settings input gains the D6 fields. [CONTRACTS.md](../../../CONTRACTS.md) moves in lockstep.

## Test plan

Per [TESTING.md](../../../TESTING.md): unit — allowlist extension (mutation-tested with a private column), each section returns null on an empty slice, floors omit rather than shrink, social handle validation refuses a URL, pillars capped at three; integration — the orders figure equals the checkout domain's own count for a seeded org, and expired checkouts are excluded; snapshot — the page with only a name and category contains no placeholder copy (spec A1); viewport — at 360px the first-screen elements are within the initial viewport.

## Delivery (PRs)

This is PR 4 of seller-profile, split in three: (a) DTO, sections and reuse of tiles, reading only what exists today — the page improves for every shop with no seller input; (b) migration and editor additions; (c) proof strip with the cross-domain counts.

## Open questions

None. Closed 2026-09-26 by the owner with the proposed defaults: "orders fulfilled" counts paid orders (D2); the landing page and the brand page share one cover image (D6); a rating shows from three reviews and an orders figure from ten, both declared constants (D3).
