# Spec — own-store/storefront-themes

- **Summary:** A shop picks one of four themes and one of its three palettes on its phone, sees its own landing page and shop redrawn live, and publishes a store that looks like its own brand — offers, deals and earned proof included
- **Status:** Accepted
- **Domain:** catalog (storefront), with promotions (read only)
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-10-30
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [own-store](../spec.md) (Q15, Q22, Q23), [org-storefront](../../org-storefront/), [brand-page](../../seller-profile/brand-page/), [ADR-0016](../../../adr/0016-mobile-app-shell.md), [ADR-0018](../../../adr/0018-one-effective-price-function.md), [ADR-0022](../../../adr/0022-design-decisions-go-through-tokens.md), [ADR-0026](../../../adr/0026-images-are-delivered-through-the-optimizer.md), [ADR-0027](../../../adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md), [ADR-0030](../../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md), [ADR-0049](../../../adr/0049-colour-is-a-primitive-palette-read-through-semantic-tokens.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md (written after UX sign-off).

## What this feature is
Vertical 7 of own-store. Today every storefront is the marketplace in a different accent: the
marketplace navbar, one hero, one grid, and an "About this shop" page. This feature gives a shop
four complete looks to choose from — each its own type, spacing, palette, shapes, motion and
section order — and turns the storefront into two things a shop can hand out: a **landing page**
that sells the shop, and a **shop** that sells the goods.

## Why
A jeweller, a phone-accessories shop, a cosmetics counter and a kirana store do not want the
same page. Shops share their link on WhatsApp and print it on pamphlets; a link that opens on a
page that looks like someone else's marketplace is not worth sharing. The owner asked that it
look like the brand pages people already love, not a generated web app, and not like Bhendi Bazaar.

## Hazards this feature must close
- **Forked components.** Four themes as four sets of components would quadruple every bug and
  let a theme drift from the price rules. A theme must be tokens plus a section order (R2).
- **A deal checkout will not honour.** An offer badge computed by the page rather than by the
  one resolver can promise a price the cart refuses (ADR-0018). Deals render only from it (R7).
- **Typed proof.** A theme with a "trusted by 10,000" slot invites a typed number. Proof slots
  read only derived figures and close up under their floors (brand-page R4) (R8).
- **Unreadable palettes.** Twelve palettes over seller photos can fail contrast (R12).
- **Trapped buyer.** Replacing the marketplace chrome must not cut the way to the cart, the
  account or the wider marketplace (org-storefront R11, own-store Q22) (R5).
- **Live page changed without consent.** Moving existing shops onto a theme changes a page they
  already share (Q19).
- **A finished look that only works with photos.** Most shops will upload one picture or none;
  every theme must look finished with a logo and a name alone (R10).

## Requirements
- **R1** — Four themes: *fancy & futuristic*, *royal & traditional*, *young & beautiful*,
  *affordable & everyday* (proposed short names Edge, Darbar, Bloom, Daily — Q18). Each has a distinct type pairing, type scale, spacing
  scale, radius, elevation, motion, hero style, product card style and section order, derived
  from the reference brand pages measured in `brand-pages-reference.md` (Theme cards below).
- **R2** — A theme is a token set and a section composition over **one** set of sections; each
  section offers a small number of variants a theme selects. No component exists for one theme.
- **R3** — Each theme ships three palettes made for it; there is no free colour (own-store Q15).
- **R4** — The owner picks a theme and palette on a phone, sees **their own** page — their name,
  goods, offers — redrawn live before publishing, and can switch back at any time (Q4).
- **R5** — The storefront carries the theme's own header, footer and phone tab bar; the header
  and footer still carry the platform's mark and contacts; the cart is the marketplace's cart and
  checkout is the platform's (own-store Q22). The marketplace is one tap away (Q6).
- **R6** — The landing page sells the shop; the shop page lists and filters the goods. A button
  anywhere that leads to the landing page reads "Visit {Shop name}", or "Visit shop" when the name
  is long (own-store Q23). Nothing says "About us" (Q3).
- **R7** — The shop's offers get a home: a deals section on the landing page and a Deals filter on
  the shop page, showing its running automatic offers, sale prices, end times and any code it
  chose to publish (Q20), every figure from the one price resolver. A shop with no offer shows no
  deals section.
- **R8** — "Why buy from us" is built from what the platform knows — dispatch time, returns window,
  rating, orders fulfilled, since when — under the brand-page floors, plus up to three claims the
  shop picks from its category's fixed list, each with an optional one-line detail, styled apart
  from the facts; omitted when empty (Q21). Buyers reach the shop through "Contact us", never its phone (Q22). A figure under its floor is left out, never shown small.
- **R9** — The editor asks only what the chosen theme's sections show, at the point they show it:
  tapping a section in the preview opens that section's fields (Q9, Q10). The old accent field,
  free-text policies and "hide sections" list are replaced (Q11, Q22).
- **R10** — Every theme looks finished with a name and a logo alone: where a photo is missing it
  draws the theme's own pattern, never an empty box or placeholder text (brand-page R2).
- **R11** — Every image passes through the optimizer at the size its slot declares (ADR-0026,
  ADR-0027); a theme's hero declares its own aspect.
- **R12** — Every palette passes WCAG AA for text and controls in its light form; motion stops
  under reduced-motion; nothing a theme does hides a control or disables a button (ADR-0053).
- **R13** — Changing theme never changes a price, a product, a URL or the cart.

## Product acceptance
Judged on a ~360px phone first.
- **A1** — The four themes, side by side with the same shop's data, are told apart at a glance by
  type, spacing and layout — not colour alone (swap palettes; they still differ).
- **A2** — An owner goes from "Your shop's look" to a published new theme in under two minutes on
  a phone, without typing anything.
- **A3** — Every price and offer badge on a themed page equals what the cart then charges.
- **A4** — A shop with only a name, a logo and one product has a finished page in each theme.
- **A5** — From any themed page a buyer reaches cart, account and the marketplace in one tap, and
  the cart holds goods from other shops.
- **A6** — A shop with a running offer shows it in the deals section and as a badge on each
  product it covers; when it ends, both disappear on the next load.
- **A7** — No proof figure on any theme can be typed by the shop.
- **A8** — Every palette passes the contrast check in the test suite.
- **A9** — Switching theme or palette changes the page on the next load and nothing else.

## Theme cards
Derived from the measured spec cards in `prototypes/brand-pages-reference.md` (2026-10-30; real
CSS of the named sites, inferred values marked there). Faces are free Google equivalents. Sizes
are px, phone → desktop. Every theme still carries deals, products and derived proof (R7, R8).

| Token | Edge — fancy & futuristic | Darbar — royal & traditional | Bloom — young & beautiful | Daily — affordable & everyday |
|---|---|---|---|---|
| Lineage | nothing.tech, ultrahuman, teenage.engineering | sabyasachi, rawmango, goodearth, caratlane | glossier, sugarcosmetics, thesouledstore | dmart.in, flipkart, decathlon |
| Faces | Space Grotesk 400 display, Inter 400 body, Geist Mono caps labels; never bold | Jost 500/600 tracked caps, Cormorant Garamond italic sub-heads, Jost 400 body | DM Sans 400–500, DM Mono badges | Mulish 400/600/800; no display face |
| Type scale | hero 40→96 lh 1.0 ls −0.03em · section 28→40 ls −1px · body 16/1.4 · label 12 mono ls 0.1em · price 16 mono | h1 28→36 ls 0.28em caps · h2 24→32 · body 16/24 · caption 12 caps ls 2px · drop cap ~90 | hero 40→72 · h1 28→32 · h2 18→20 · body 14/1.4 · badge 11 caps ls 0.18em · price 14 | hero 20→29 · section 16→22 bold · body 14/1.5 · tag 10 bold · price 16 bold, MRP 12 struck |
| Spacing scale | 4 8 12 16 24 32 48 80 144 | 10 20 30 40 60 96 | 4 8 12 16 20 30 40 60 80 | 4 8 10 12 16 24 40 |
| Section padding | 64 → 144 (huge air, dense inside) | 40 → 96 (slow) | 30–40 → 56–80 | 16–24 → 40 (dense) |
| Container · gutter | 1424 · clamp(16, 5vw, 84) | 1200, images full-bleed · 20 → 40 | 1260 · 20 / 32 / 48 | 1152–1280 · 12 → 24 |
| Grid | 2 col gap 12 → 4 col gap 24 | 2 col gap 4 → 4 col gap 8 (tiles almost touch) | 2 col gap 12 → 4 col gap 24, square images | 3 col gap 8 → 5 col gap 10 |
| Radius | cards 24, buttons pill | 0 everywhere | 0 on cards and buttons, 999 chips | cards 12–16, chips 4–8, Add pill |
| Line / shadow | no shadow; 1px at 12% ink | no shadow; 1px underlines | hairlines, no shadow | 0 1px 4px at 12% black or 1px grey |
| Button | pill 44 high, 14px | caps text link underlined, or 0-radius outline 48 high | 40 high, radius 0, ink fill; secondary underlined | 36–40, filled action colour, "ADD" |
| Accent rule | one electric colour on ≤1 dot or badge per screen | ivory page, ink text, one jewel tone on menu and footer fills only | soft tint surfaces, one loud pop on promo badges only | one action colour on every Add and offer chip, yellow for deals |
| Palettes (Q15) | Carbon (black, red), Graphite (charcoal, yellow), Signal (white, electric blue) | Emerald (ivory, bottle green), Navy (ivory, midnight), Kumkum (paper, magenta, ochre) | Blush (pink, cobalt pop), Peach (peach, red pop), Lilac (lilac, green pop) | Fresh (green, yellow), Bazaar (blue, yellow), Cobalt (cobalt, gold) |
| Hero | full-bleed product on black, white headline, mono spec line | caps title over full-bleed photo, festive ribbon | split photo + short line, promo bar above | search, then short offer banner, not full-screen |
| Card | flat grey tile, mono spec line, no shadow | tall tile, centred caps name, tracked price | square image, shade dots, rating chip | dense tile, % off chip, big price, ADD |
| Section order | hero → collections rail → deals as campaign → bestsellers → story → why buy (spec list) → reviews → visit → footer | hero → editorial collections ×3 (photo, caps title, one link) → deals → bestsellers → story with drop cap → why buy → reviews → visit → footer | promo bar → hero → category circles → bestsellers rail → deals → two-column story → reviews highlight → marquee → visit → footer | search → category icon grid → deals banners → rails by category → why buy strip → story → visit → footer |
| Avoid | viewport-only type; a second accent | a home page with no products; gold gradients | rails of near-identical collections; 12px prices | six weights in one card; banners pushing goods below the fold |

## Scope
- **Outcome:** A shop picks a theme and palette on its phone and publishes a landing page and shop
  that look like its own brand and show its offers.
- **In:** themes as tokens and compositions (R1–R3, A1, A8); themed chrome (R5, A5); landing and
  shop pages (R6, R13, A9); deals home (R7, A3, A6); "Why buy from us" (R8, A7); picker with live
  preview (R4, A2); point-of-need editor fields (R9–R11, A4); existing shops moved (Q19).
- **Later:** seasonal skins (Q24), section reordering (Q25), more themes (Q26), own fonts or
  colours (never — own-store Q15), custom domains (own-store Later), Instagram feed (Q27), video
  hero (Q28), per-theme analytics (Q29), regional languages (own-store Later).

## Open questions
Q18, Q19, Q20 — see [decisions.md](decisions.md).
