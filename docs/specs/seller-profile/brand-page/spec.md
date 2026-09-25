# Spec — brand-page

- **Summary:** The shop's about page is a brand landing page, drawn from what the platform knows and finished when the seller has written one line
- **Status:** ✅ Accepted — 2026-09-26
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-09-25
- **References:** [../spec.md](../spec.md) (seller-profile), [trd.md](trd.md), [storefront-pages](../../org-storefront/storefront-pages/spec.md) R3, [storefront-branding](../../org-storefront/storefront-branding/spec.md), [seller-identity](../../org-storefront/seller-identity/spec.md) R5, [ADR-0015](../../../adr/0015-mobile-first-design.md), [ADR-0016](../../../adr/0016-mobile-app-shell.md), [ADR-0018](../../../adr/0018-one-effective-price-function.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

The shop's about page becomes its brand page: a landing page that tells a stranger on a phone who this shop is, what it sells and why to trust it, in that order, and that looks finished when the seller has written one line. It is the page a seller shares on WhatsApp and Instagram, so it is built for the first two screens of a phone.

## Why

Today the page is a cover image, a name, a block of text and two policies. A survey of strong brand pages and of the shop pages Amazon, Etsy and eBay give their sellers agrees on the shape: a hero with a one-line promise, a short mission, an origin story with a real person in it, a few blocks on what and how, proof, then the goods and a way to buy. The marketplaces also agree on something the brand sites cannot do: most of the proof and most of the content is drawn by the platform from what it already knows, so a seller who writes nothing still has a page that sells. Our sellers will write one line. The page has to be good anyway.

## Requirements

- **R1** — The page is a fixed sequence of sections the platform orders, that the seller fills: hero (cover, mark, name, tagline, location, since when); a proof strip; the story, with an owner's name, role, photo and one line if given; what they sell, as category tiles; up to three blocks on how or why; the brands they carry, when more than one; what buyers say, as the shop's two or three most recent published reviews with rating, verified badge and product name; their newest goods; their delivery and returns terms; the ways to follow them; and one call to shop.
- **R2** — Every section is either drawn from what the platform already holds or omitted. A buyer never sees an empty placeholder, "has not written yet", or a section with nothing in it.
- **R3** — The first phone screen carries the cover, mark, name, tagline and proof strip, with the call to shop reachable without scrolling. Nothing from site chrome pushes them down.
- **R4** — Proof is derived, never typed. The rating and its count come from published reviews ([product-reviews](../../product-reviews/spec.md) R6a), orders fulfilled from real orders, since-when from the day the shop joined. A number a seller can type is not proof and is not shown as one. A statistic too small to be convincing is left out rather than shown small.
- **R5** — Real people are invited, never required: an owner's name, role, photo and a single quoted line. When absent, the story stands alone.
- **R6** — The goods on the page are the marketplace's own tiles: same price, same offers, same stock, same suspension when up for bidding ([storefront-pages](../../org-storefront/storefront-pages/spec.md) R4). Nothing is priced twice.
- **R7** — The seller may hide any optional section and may not reorder them. Their look derives from the shop's own mark and accent, as the storefront already does; there is no free-form theming.
- **R8** — Ways to follow are handles on known networks, shown as links only to those networks. A seller cannot place an arbitrary link.
- **R9** — Everything a seller supplies is text shown as text and images through the one image seam, sized to the slot; nothing can break layout or execute ([storefront-branding](../../org-storefront/storefront-branding/spec.md) R6, R7, R9a).
- **R10** — Only the public face appears ([seller-identity](../../org-storefront/seller-identity/spec.md) R5). A brand's name may show; its manufacturer does not.
- **R11** — The page describes itself to search and to link previews from the same public face, so a shared link renders the cover, the name and the tagline.

## Product acceptance

- **A1** — A shop with only a name and a category has a page with a hero, its category tiles, its goods or the honest "nothing listed yet" state, its terms and a call to shop. No placeholder sentence anywhere.
- **A2** — A seller adds one line, one cover photo and one paragraph. A stranger on a phone can say what the shop sells and give one reason to trust it within two screens.
- **A3** — The rating on the page equals the one the product pages derive; the orders figure equals the admin's own count for that shop.
- **A3a** — The reviews quoted on the page are published ones the product pages also show, newest first, and a withdrawn review disappears from the page the moment it is withdrawn.
- **A4** — With an owner photo and line present, the story shows a person; without them, the section closes up with no gap.
- **A5** — Pasting markup, a script or a very long unbroken string into any field changes nothing about layout and executes nothing.
- **A6** — On a ~360px screen the first screen holds cover, mark, name, tagline, proof strip and the call to shop.
- **A7** — No field of the private face appears in the page's payload, checked by the same allowlist test as the storefront.
- **A8** — A link to the page pasted into WhatsApp previews with cover, name and tagline.

## Out of scope (this feature)

- A contact channel of the shop's own — still [contact-us](../../contact-us/), platform-scoped.
- An embedded Instagram feed or posts — the social domain, later in this phase.
- Structured data for search engines beyond title, description and preview — [seo](../../seo/).
- Press, awards and certifications as uploaded badges. Unverifiable by the platform, so not proof; revisit when there is a way to verify.
- Video in the story. [ADR-0017](../../../adr/0017-video-is-embedded-not-hosted.md) makes it possible; it waits for a seller who has one.
