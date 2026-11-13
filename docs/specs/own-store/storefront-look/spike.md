# Spike — storefront look: proportions, banners, and a font a shop can choose

- **Status:** Findings ready for the owner (research only; no code, no decision)
- **Verified:** 2026-11-13
- **Asked by:** the owner, via bb-master's brief, 2026-11-13: "what is this huge bold text"; the store hero "feels empty"

> A `/bb-brainstorm` spike. Its recommendations became [storefront-look](spec.md) and [storefront-font](../storefront-font/spec.md);
> this file is deleted once their TRDs exist (a spike is not a standing record).

## The question, made precise
1. Why do titles, shop names and prices render at display size inside a themed store, and what is the smallest
   change that holds every template to the platform's type scale?
2. Why do full-image banners look grey, and how is text kept readable without a shade?
3. What should the top of a store show so it is never bare, on a phone first?
4. Can a shop pick its own font without breaking ADR-0064 ("the shop stores keys, never values")?

## What already exists (read from the code)
- **Sizes are overridden per theme.** `src/app/globals.css` gives each `[data-theme]` its own `--text-headline`,
  `--text-title`, `--text-body`, `--spacing-section`, `--spacing-gutter` and `--container-store`. Bloom's headline
  is `clamp(2.5rem … 4.5rem)` (40→72px), Edge's `clamp(2.5rem … 6rem)` (40→96px); the platform's is 22→32px.
  Edge's section padding reaches 9rem and its gutter 5.25rem.
- **The product page uses the platform heading face inside a theme.** `product-details.tsx` sets the title in
  `font-heading text-headline font-semibold` — Playfair Display, bold, at the theme's headline size — and the price
  through `PriceDisplay size="lg"`, which is also `text-headline`. In Bloom (Niqab Boutique's pink) that is a 72px
  bold serif title and a 72px price: screenshot 1 exactly.
- **The store hero.** Bloom's `split` hero is a square photo beside a column holding logo, name at `text-headline`
  (72px), line and CTA, padded by `py-section`. On desktop the column is mostly empty: screenshot 2.
- **The grey.** `hero.tsx` lays `bg-photo-scrim` — ink at 85% — over the *whole* photo in the `fullBleed` and
  `ribbon` variants. The marketplace `HomeHero` the unthemed store page uses has a gradient scrim to 85%.
  Card badges and "Sold out" use the same 85% ground (small labels, so not the problem the owner saw).
- **Royal = Darbar.** Its `editorial` collections draw three tiles each the full width: 4:5 on a phone (~450px tall
  each at 360px wide), 21:9 on desktop (~510px each). Three of them fill one-and-a-half screens on either device.
- **Fonts.** Seven families are already self-hosted: Space Grotesk, Jost, Cormorant Garamond, Mulish (themes), DM
  Sans, Playfair Display (root), plus two monos for labels. All theme faces load with `preload: false`, so a page
  downloads only the faces it renders. ADR-0064 D5/D6 and its last consequence say a shop wanting its own font
  "hears no"; the answer was a fifth theme.
- **Banners (Q14 of storefront-themes, decided, not built):** shop banners were meant to fill a carousel hero.
  Today a themed hero draws the shop's hero photos (up to three); an unthemed store draws `HomeHero` banners.

## What the field does
- **Shopify Dawn's image banner** ships `image_overlay_opacity` defaulting to **0**, and `show_text_below` /
  `stack_images_on_mobile` defaulting to **true**: on a phone the text sits *below* the picture, not on it.
  Source: `Shopify/dawn` `sections/image-banner.liquid`.
- **Dawn's typography** offers two font pickers (heading, body) from a curated library, plus a heading scale of
  100–150%. We would take the pickers and not the scale: the owner wants sizes fixed. Source: Dawn `settings_schema.json`.
- **Indian D2C phone stores** (Nykaa Fashion, Libas, FabIndia, Bewakoof) open on a vivid edge-to-edge campaign
  image with no shade, a circular or tile category rail immediately below it, then product rails. The shop name is
  in the header, never a display headline. Zara and H&M use the same order with a small solid label for text.
  (From the owner's references; I could not load their live mobile pages from here — see Open questions.)

## Options

### 1. Holding the type scale
| Option | Cost | Forecloses |
|---|---|---|
| **A. Themes stop overriding sizes and proportions** (headline, title, body, price, section, gutter, container). A theme keeps faces, tracking, case, weight, radius, shadow, motion, pattern, palette. | One CSS block per theme; product page reads `font-display`. | A theme can no longer be "the big-type one". |
| B. Keep overrides, cap each with `min()` at the platform maximum. | Same edit, more numbers. | Proportions still drift between themes under the cap. |
| C. A second, theme-only set of roles. | New tokens, every caller relearns. | Nothing, but it is the drift ADR-0022 exists to stop. |

**Recommendation: A.** It is what the owner asked ("differ in style, not proportions") and removes numbers rather than adding them.

### 2. Readable text without a shade
| Option | Cost |
|---|---|
| **A. Text below or beside the image on a phone; on desktop beside it, or in a small solid label card.** No scrim anywhere on a photo. | Hero variants change shape; the photo-scrim contrast check becomes a plain palette-pair check. |
| B. Keep text on the photo, scrim only behind the text block (a gradient strip). | Still dims a third of the photo; owner asked for none. |
| C. Seller-set overlay strength (Dawn's slider). | A setting most sellers would leave wrong; owner said remove. |

**Recommendation: A**, matching Dawn's defaults.

### 3. A top section that is never bare
Rule proposed: **on a 360×740 phone, the first screen shows the shop's identity, one vivid image, and the start of
either categories or products.** Each template keeps its own hero variant, reshaped to that rule:
- **Edge `fullBleed`:** vivid image edge to edge, identity bar on solid ground beneath; desktop adds two featured products beside the image.
- **Darbar `ribbon`:** image, then a small solid name card overlapping its lower edge, then the ribbon line.
- **Bloom `split`:** phone stacks image then identity; desktop puts identity *above* a 2×2 of featured products beside the image — the empty pink is filled with goods.
- **Daily `banner`:** a banner row (up to three) with a trust strip beneath.
- **All:** identity is compact (logo, name at headline size, one line, chips for rating · since · products) and a category rail follows at once.

### 4. A font a shop can choose
| Option | Cost | What it assumes |
|---|---|---|
| **A. One "heading font" key per shop, from a closed list of the six families already in the build.** Body stays the template's. | A column, a picker, an ADR superseding ADR-0064 D6's "hears no". No new package, no new download. | Six is enough variety. |
| B. Same, with new families (e.g. Poppins, Lora, Marcellus). | Each is a build-time face; more bytes in the CSS manifest (files still load only when used). | — |
| C. Heading *and* body pickers (Dawn). | Doubles the combinations to test; a decorative body face harms reading on a phone. | — |

Keys, never values (ADR-0064 D5) still hold: the shop stores `fontKey`; a `[data-font]` scope repoints
`--font-display-face`. An unknown key reads as the template's own face.

**Recommendation: A**, revisit B if sellers ask.

## Failure modes
- A font face slow or blocked: `display: swap` with metric-matched fallbacks; the page shows the fallback, never blank.
- A shop with no photos: the theme's drawn pattern, at the compact hero height — never a full-screen empty pattern.
- One product, or no categories: the hero's featured slots fall back to the pattern tile; the category rail is omitted (R10 of storefront-themes, unchanged).

## Open questions
- Which fonts go on the list, and whether the choice is headings only — owner's taste (storefront-font Q1, Q2).
- Daily's three phone columns break "same proportions" — owner's call (storefront-look Q6).
- Does the platform's own home banner lose its scrim too? Parked (storefront-look Q9).
- I could not load the reference stores' live mobile pages; the hero patterns above are from the owner's list and Dawn's source. A look at two of them on a phone would close it.
