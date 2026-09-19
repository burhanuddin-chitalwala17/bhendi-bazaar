# Spec — storefront-branding

- **Status:** Draft
- **Domain:** catalog
- **Phase:** 9 — Seller storefronts
- **Verified:** 2026-09-19
- **References:** [../spec.md](../spec.md) (programme), [../trd.md](../trd.md) D8/D9, [storefront-pages](../storefront-pages/), [home-banners](../../home-banners/), [image-delivery](../../image-delivery/), [ADR-0022](../../../adr/0022-design-decisions-go-through-tokens.md), [ADR-0017](../../../adr/0017-video-is-embedded-not-hosted.md), [ADR-0026](../../../adr/0026-images-are-delivered-through-the-optimizer.md), [ADR-0028](../../../adr/0028-images-live-in-cloudflare-r2.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

The organisation composes its own storefront from the seller portal: its mark, a hero, an introduction, its
policies, its links — and sees the result.

## Why

Without this, every storefront is the same page with a different name on it, and the offer to a small
business is hollow. What makes a shop theirs is the picture at the top and the paragraph explaining who
they are.

It also has to be self-serve. A platform that edits storefronts on request does not scale past a handful of
sellers, and the seller who most needs an online shop is the one least able to wait for one.

## Requirements

- **R1** — An organisation edits its own storefront from its portal, with no platform involvement and no deploy.
- **R2** — It can set a mark, a hero image, a tagline and an introduction. Not a phone number, WhatsApp or inbox of its own: [contact-us](../../contact-us/) is platform-scoped for now, and R2c already bars pointing a buyer off the platform.
- **R2a** — It can publish its own banners on its storefront — a picture, words, and somewhere to go — and run more than one.
- **R2b** — It controls the order its banners appear in, and can take one down without deleting it, so a campaign can run again next season.
- **R2c** — A banner can only point somewhere inside that organisation's own storefront — its goods, a category it sells in, its about page. It is a shop's own signage, not advertising space pointed off the platform or at another shop.
- **R2d** — An organisation's banners appear on its storefront only. They never reach the platform's home page, which stays platform-owned.
- **R3** — Each shop states its own delivery and returns terms, and they are reachable from its storefront before a buyer pays. Where a shop says nothing, the platform's own terms stand in rather than a blank.
- **R3a** — Wherever those terms are shown, it is unambiguous that they are the shop's, not the platform's. Delivery and returns are the shop's to set; payment, fraud and platform compliance are the platform's, and a shop cannot write terms that disclaim them.
- **R3b** — A buyer whose basket holds goods from more than one shop can see each shop's terms, and is not shown one shop's policy as though it covered the whole order.
- **R4** — The editor shows what the result will look like before it is public.
- **R5** — A storefront looks finished before any of this is filled in, and improves as it is.
- **R6** — Nothing an organisation supplies can break the page's layout, typography or spacing, on any screen.
- **R7** — Nothing an organisation supplies can execute, redirect a visitor somewhere the platform would not send them, or misrepresent whose shop it is.
- **R8** — An organisation can only edit its own storefront, checked against a current membership on the request.
- **R9** — Images are held to a stated shape and size, and an organisation is told the requirement before it uploads, not after.
- **R9a** — A storefront's images go through the platform's one image seam — stored in the object store the rest of the catalogue uses and served through the optimizer at the size the screen asks for, under the same stored ceiling ([ADR-0026](../../../adr/0026-images-are-delivered-through-the-optimizer.md), [ADR-0028](../../../adr/0028-images-live-in-cloudflare-r2.md)). A hero is the largest thing on the page and the first thing a phone downloads; a storefront that bypasses the optimizer spends the transfer allowance the whole catalogue shares.
- **R9b** — No storefront surface introduces a raw `<img>`. `tests/unit/image-delivery.test.ts` holds an allowlist of the few that exist, and a new one fails it rather than shipping.
- **R10** — The platform can take a storefront's presentation down without deleting the organisation or its goods.
- **R11** — The editor works on a phone. A seller running a shop from a phone must be able to run their storefront from one.

## Product acceptance

- **A1** — An owner uploads a logo and a banner, writes two paragraphs, saves, and sees the storefront change.
- **A1a** — An owner runs three banners, reorders them, takes the middle one down, and the storefront shows the remaining two in the order given.
- **A1b** — A banner pointing at another organisation's goods, or off the platform, is refused.
- **A1f** — A storefront hero on a phone downloads a phone-sized image, not a desktop-sized one.
- **A1c** — Nothing an organisation publishes appears anywhere on the platform's own home page.
- **A1d** — A buyer reading a shop's returns policy can tell it is that shop's and not the platform's.
- **A1e** — A shop cannot publish terms that purport to remove the platform's own payment or fraud protections.
- **A2** — A brand-new organisation that has filled in nothing still has a presentable storefront.
- **A3** — Pasting markup, a script, or a very long unbroken string into the introduction changes nothing about the layout and executes nothing.
- **A4** — A member of one organisation cannot edit another's storefront by changing a URL.
- **A5** — An image of the wrong shape is refused with the requirement stated, before it is uploaded.
- **A6** — The whole editor is usable on a ~360px screen.

## Out of scope (this feature)

- Arranging sections, choosing layouts, or anything resembling a page builder ([../trd.md](../trd.md) D8).
- Free-form colour, fonts or spacing. One accent, from the declared palette; every other axis stays as [ADR-0022](../../../adr/0022-design-decisions-go-through-tokens.md) sets it.
- Uploaded video. A video is an embedded reference ([ADR-0017](../../../adr/0017-video-is-embedded-not-hosted.md)) if it appears at all.
- Scheduling a banner to run between two dates. Orgs put one up and take it down; time-boxed campaigns are what [promotions](../../promotions/) is for.
- Custom pages beyond the landing and about pages.
- Review or approval of what an organisation publishes. R10 gives a way to take something down; who watches for it is not specified here.
