# ADR-0064: A storefront theme is a token set and a section composition declared in code

- **Date:** 2026-10-30
- **Status:** Accepted (D1, D6 and the last consequence amended by [ADR-0074](0074-a-shop-chooses-its-storefronts-heading-face-from-a-closed-list.md))

## Context

[ADR-0030](0030-org-storefronts-are-scoped-projections-on-one-domain.md) D8 gave a shop one visual axis — an accent repointing `--primary` — so that no storefront could escape the design system. That kept every page safe and made every page the same: four shops as different as a jeweller and a kirana store render as the marketplace in four colours. [own-store/storefront-themes](../specs/own-store/storefront-themes/spec.md) asks for four complete looks, each with its own type, spacing, shape, motion, palette and section order, while keeping the guarantees D8 bought: one price path, one set of components, no colour the system does not own, and a page that stays readable over a seller's photographs.

The pressure is in both directions. The more a theme may vary, the more it looks like four applications; the less it may vary, the less a shop has a link worth sharing.

## Decision

1. **A theme is data declared in code, in two parts.** A *token set* — faces, type scale, spacing scale, section padding, container, radius, elevation, motion — expressed as a `data-theme` scope over the semantic tokens in `globals.css`; and a *composition* — which sections the landing page shows, in what order, and which variant of each. Both are declared once: a themes module in `server/catalog` for keys, compositions and section fields, and `globals.css` for the scopes. Adding a theme is a deploy.
2. **One set of section components serves every theme.** A section offers a small closed set of variants that compositions select; there is no component, route or price path belonging to one theme. Variants are named by what they do (a split hero, an editorial hero), never by the theme that first used them.
3. **A theme carries exactly three palettes, and a palette is a semantic scope.** A `data-palette` scope repoints the semantic colour tokens at primitives; every colour value stays in the primitive palette ([ADR-0049](0049-colour-is-a-primitive-palette-read-through-semantic-tokens.md)). There is no free colour ([own-store](../specs/own-store/decisions.md) Q15). Every palette is fixed light or dark by design and does not follow the device's dark mode.
4. **Every palette is contrast-tested in the suite** — text, muted text and button pairs at WCAG AA, computed from the primitives the scope resolves to. A palette that fails fails the build.
5. **The shop stores keys, never values.** A theme key, a palette key and its content. No size, colour, face or order crosses from the database into CSS or a `className`; keys select scopes and compositions.
6. **Faces are self-hosted at build time** through the framework's font loader, at most two families per theme, declared once and loaded only where a theme uses them. No page requests a font from a third party.
7. **A section declares the fields it shows.** The editor asks only the fields of the sections the chosen theme renders, at the section. Section order is the theme's, not the shop's.
8. **This supersedes ADR-0030 D8** (one visual axis, an accent). ADR-0030's other decisions stand: one domain, one cart, one checkout, one canonical product URL, publicity in the query.

## Alternatives considered

- **A theme per codebase, as Shopify ships them** (Dawn, Sense, Craft each a full set of templates). The conventional shape and the most freedom per theme. Rejected because four sets of product cards and offer badges is four places for a displayed price to drift from the charged one ([ADR-0018](0018-one-effective-price-function.md)), and four bug lists for one developer.
- **Themes as rows in the database**, editable by the platform admin without a deploy. Attractive for adding seasonal looks. Rejected: values arriving from a row reach the page as inline styles that no token gate or contrast test can see, which is the drift ADR-0022 exists to stop. A new theme is rare enough to be code.
- **Keep ADR-0030 D8 and widen the accent set.** Cheapest and safest. Rejected because colour alone cannot meet the spec's first acceptance line: themes must be told apart with their palettes swapped.
- **A free colour picker with computed contrast**, the Dukaan and Instamojo shape. Rejected by the owner (own-store Q15): a computed-legal palette can still be ugly, and the reference brand pages each use one accent with discipline.
- **A seller-arranged page builder.** Already rejected in ADR-0030; a theme's order is part of its design (storefront-themes Q25).

## Consequences

- ✅ One component tree, one price path, one bug list; a theme cannot show a price checkout refuses.
- ✅ Every colour, size and face a theme uses is visible to `tests/unit/design-tokens.test.ts` and the contrast test.
- ✅ A shop's choice is two keys, so switching and switching back are cheap and cannot corrupt content.
- ⚠️ `globals.css` roughly doubles, with four theme scopes and twelve palette scopes. A shared component that assumed the platform's radius or spacing may look wrong inside a theme, and only a rendered check finds that.
- ⚠️ A variant that only one theme selects is, in practice, theme-specific code. The rule is held by review, not by a test.
- ⚠️ Six new font families enter the build. Per page a theme stays within two, but the root layout still preloads the platform's own faces on themed pages.
- ⚠️ Themed pages ignore the buyer's dark mode, and shared components' `dark:` styles must be kept from reaching inside a themed scope.
- ⚠️ A shop wanting its own colour or font hears no. The answer is a fifth theme, which is code and a deploy.
