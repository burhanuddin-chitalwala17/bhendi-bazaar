# ADR-0074: A shop chooses its storefront's heading face from a closed list, and a theme never sets proportion

- **Date:** 2026-11-13
- **Status:** Accepted. Amends [ADR-0064](0064-a-storefront-theme-is-a-token-set-and-a-section-composition-declared-in-code.md) D1 (what a token set holds), D6 (two families per theme) and its last consequence (a shop's own font)

## Context

ADR-0064 let each theme carry its own type scale and spacing, and told a shop that wanted its own font "no — the answer is a fifth theme". Both choices failed in use. Themes carried headlines up to 96px, so a product title filled half a phone and a theme switch moved every size on the page. Shops also asked for a typeface that carries their brand, which is a stronger signal than any palette, and a new theme is too heavy a way to change a face. The owner asked for both changes on 2026-11-13 (storefront-look (`planning-archive-2026-11-25:docs/specs/own-store/storefront-look/spec.md`), storefront-font (`planning-archive-2026-11-25:docs/specs/own-store/storefront-font/spec.md`)).

## Decision

1. **A theme never sets a size, spacing or width.** Its `[data-theme]` scope holds faces, display weight and case, tracking, radius, elevation, motion and pattern. The platform's type scale, section rhythm, gutter, grid gap and container hold in every theme. Themes differ in style, not proportion.
2. **A shop may choose one heading face from a closed list declared in code** (`FONT` in `server/catalog/storefront-themes.ts`). The face applies to text that names something: the shop name, section, page, banner and category titles, and product names. Prices, body, buttons, chips, labels and navigation keep the theme's faces.
3. **Keys, never values, still hold.** The shop stores a font key. A `[data-font]` scope repoints `--font-display-face` at the face's own variable, never at a role a theme repoints. An unknown key reads as the template's default.
4. **The font is part of the look.** It is published, versioned and switched back with the theme and palette.
5. **Faces are self-hosted through the framework's font loader** with `preload: false`, as ADR-0064 D6 requires, so a page downloads only the faces it renders. A chosen heading face sits outside D6's two-family limit, so a store renders at most three: the theme's two and the chosen one. A face that ships one weight does not have a bold faked for it. A new face on the list is a code change.

## Alternatives considered

- **Cap each theme's sizes with `min()` at the platform maximum.** Smaller diff, but proportions still drift under the cap, and the owner asked for no drift at all.
- **A fifth theme per face** (ADR-0064's answer). It multiplies themes by faces, and a face is a smaller decision than a look.
- **Heading and body pickers, as Shopify Dawn ships them.** This doubles the combinations to test, and a decorative body face harms reading on a phone. Most shops change only headings.
- **Any Google font by name.** It reopens the free-value hole ADR-0064 D5 closed: an absurd face, a third-party request, and a family the build never saw.
- **A heading-scale slider (Dawn's 100–150%).** Rejected by decision 1: sizes are the platform's.

## Consequences

- ✅ A theme switch moves no size on any page, and `tests/unit/storefront-themes-registry.test.ts` fails if a theme scope sets one.
- ✅ A shop gets a brand face without a new theme, and cannot pick one that breaks the page or calls a third party.
- ⚠️ Themes are less distinct. Edge's oversized display type is gone, and its character now rests on face, tracking and shape.
- ⚠️ Three more families enter the build (Marcellus, Poppins, a standalone DM Sans). Per page, a store still loads only its theme's faces and its chosen face.
- ⚠️ Eight faces across four themes and twelve palettes is a large matrix. Only sizes and contrast are tested; the look of each pairing is checked by eye.
