# TRD — own-store/storefront-look

- **Status:** Accepted — 2026-11-13
- **Domain:** catalog (storefront), front end
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-11-13
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md) (signed off 2026-11-13), [prototype.html](prototype.html), [spike.md](spike.md), [ADR-0022](../../../adr/0022-design-decisions-go-through-tokens.md), [ADR-0064](../../../adr/0064-a-storefront-theme-is-a-token-set-and-a-section-composition-declared-in-code.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> **The prototype is the visual reference** (owner, 2026-11-13: "make sure you follow the prototype"). Where this
> document and the prototype disagree on how something looks, the prototype wins, except for picture shapes (Q12).

## Approach
Three changes, all inside the existing one-component-tree model of ADR-0064:
1. **Take proportions out of the theme scopes.** The `[data-theme]` blocks in `src/app/globals.css` stop setting
   `--text-headline`, `--text-title`, `--text-body`, `--text-tag`, `--text-price` (and their line heights),
   `--spacing-section`, `--spacing-gutter`, `--spacing-grid` and `--container-store`. Every theme then reads the
   platform's values from the `@theme` block. A theme keeps faces, tracking, radius, shadow, motion and pattern,
   and gains two style tokens — display weight and display case — so Darbar's caps and Daily's heavy weight stay
   tokens, not class lists (Q1, Q7).
2. **Reshape the four hero variants and the Darbar collection variant**, keeping their names and the composition
   order (R8). Text never sits on a photo; the photo scrim goes from the hero and the themed card (Q3, Q8).
3. **The product page title and price read the theme's display face at platform size** (Q2).

No new section, no new variant name, no data model change, no new route.

## Prior art
None — no new model. The text-below-image hero follows Shopify Dawn's `image-banner` defaults
(`image_overlay_opacity: 0`, `show_text_below: true`), cited in the spike.

## Technical decisions
- **D1 — Theme scopes lose every size and spacing token** (Q1). The platform's `@theme` values (headline 22→32px,
  title 18→22px, body 15→16px, price 16px, section/gutter/grid clamps, `--container-store: 90rem`) are the only
  ones. Two new role tokens per theme: `--font-display-weight` (Edge 600, Darbar 400, Bloom 600, Daily 800) and
  `--display-case` (`uppercase` for Darbar, `none` elsewhere) with `--tracking-headline` as today. A
  `font-display` call site adds the weight and case utilities those tokens drive.
- **D2 — Daily keeps three phone columns** (Q6, owner): `THEMES.daily.phoneColumns` stays 3; card text sizes are the
  platform's, only the image is smaller.
- **D3 — Hero variants, per the prototype** (Q4, Q11):
  - `fullBleed` (Edge): phone — photo at the hero slot's phone shape, solid label chip on its lower edge, identity
    block on `bg-card` below. `md:` — photo in two of three columns, identity + two featured products in the third.
  - `ribbon` (Darbar): photo; a solid `bg-card` name card overlaps its foot (negative margin, not absolute, so the
    card's height is real); ribbon line below on `bg-feature`. Desktop: same, card centred at `max-w-xl`.
  - `split` (Bloom): phone — photo, then identity stacked with chips. `md:` — photo left; identity, then a
    "Bestsellers this week" 4-up row on the right.
  - `banner` (Daily): phone — rail of up to three banners (shop's offer banners, then hero photos), trust strip of
    derived facts, identity. `md:` — main banner with two offer tiles beside it.
  - **Identity block** is one shared piece: logo, name (`h1`, `text-headline`), line, chips (rating · since ·
    products, rating only above brand-page's floor), and "Shop all {n}".
  - **Featured products** are `page.bestSelling` minus sold-out, first N; a missing slot draws the theme pattern
    tile (R9). No new query.
- **D4 — Picture shapes are the slot's** (Q12). Hero photos keep `IMAGE_SLOT.STOREFRONT_HERO` (phone 4:5,
  desktop 16:9); Daily's offer banners keep `ORG_BANNER` (phone 4:5, desktop 5:2). The layout gives the photo its
  column and lets the slot's aspect set the height; the side column aligns to the top.
- **D5 — No photo scrim** (Q3). Remove `bg-photo-scrim` from `hero.tsx` and `themed-product-card.tsx`: the
  badge sits on `bg-deal` (Bloom, Daily) or `bg-card` (Edge, Darbar); "Sold out" on `bg-card`. The banner label is
  a `bg-card` chip. `--color-photo-scrim` and `--color-on-photo` stay in `globals.css` only while the marketplace
  `product-card.tsx`, `wishlist-grid.tsx` and `utils.ts` use them (Q9, parked).
- **D6 — Darbar collections** (Q5): `editorial` becomes a rail of arched tiles — 3:4, top radius full, 112px wide on
  a phone and 184px from `md:`, name in display caps beneath. Same rail mechanics as `rail` (Edge). Variant name
  kept, so the composition does not change.
- **D7 — Product page in a store** (Q2): `product-details.tsx` sets the title in `font-display` (which falls back to
  the platform heading face outside a theme, so the marketplace page is unchanged) with the theme's display weight.
  The price keeps `PriceDisplay size="lg"`, which adds Tailwind's built-in `in-data-theme:text-title`: inside a store it
  is title size, on the marketplace it stays headline. A CSS variant, not a prop, because the product page does not
  know which chrome its layout drew (storefront-themes Q33).
- **D8 — The unthemed store page** (`/store/{handle}` with no look) is out of scope: it keeps `HomeHero` and the
  platform scale. It never had the outsized sizes.

## Packages
None.

## UI approach
Screens, states and copy are in [ux.md](ux.md); the look is the prototype's.
- **Per form factor:** phone first as above; `md:` places identity beside the photo; `lg:` adds the featured row
  where D3 says. The fold rule (identity + picture + categories or products on 360×740) is checked by hand on the
  preview page at 360px for each theme.
- **Rendering:** all server components, as today (`ThemedSections` and its sections). No new client leaf.
- **Behaviour:** none new; no request or hook changes.
- **Surfaces:** existing primitives (`Button`, `ThemePhoto`, `ResponsiveImage`). New tokens: `--font-display-weight`,
  `--display-case` per theme.

## Gates touched
- `design-tokens`, `cn-tokens`: new utilities read tokens; no literal sizes.
- `storefront-themes-registry`: its check that themes set `--text-headline` and differ in size (lines ~72, ~86)
  is inverted — a theme scope **must not** set a size or spacing token. Mutation-tested: adding one back fails it.
- `storefront-palettes`: the "text over a photograph sits on the scrim" block is replaced by "no themed component
  uses the photo scrim" (source scan of `src/components/storefront/themed/`).
- `image-delivery`: unchanged, photos still through `ThemePhoto`/`ResponsiveImage` with declared `sizes`.

## Data model
None.

## API / contract changes
None.

## Test plan
- Unit: registry test (D1, inverted), palette/scrim scan (D5), a hero test per variant that the identity block and
  featured slots render, and pattern tiles fill missing featured slots (R9, A2).
- Unit: Darbar collections render as a rail, not three stacked tiles (A5).
- Component: product page title uses `font-display` and `text-headline`; price uses `text-title` inside a theme (A1).
- Manual, recorded in the acceptance report: each theme on the preview page at 360×740 and 1280×800 against the
  prototype (A2, A3, A4, A6).

## Delivery (PRs)
1. **Scale** — D1, D2, D7 and the registry test. Behaviour change: every themed size drops to the platform's.
2. **No shade** — D5 and the scan.
3. **Heroes** — D3, D4, shared identity block, featured slots.
4. **Darbar collections** — D6.
Each unit runs `/bb-review`; the owner walks the preview on a phone after unit 3.

## Open questions
None.
