# TRD — own-store/storefront-font

- **Status:** Accepted — 2026-11-13
- **Domain:** catalog (storefront), front end
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-11-13
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](../storefront-look/ux.md) (signed off 2026-11-13), [prototype.html](../storefront-look/prototype.html), [storefront-look TRD](../storefront-look/trd.md), [ADR-0064](../../../adr/0064-a-storefront-theme-is-a-token-set-and-a-section-composition-declared-in-code.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> Builds after storefront-look unit 1, which introduces the display weight and case tokens this reads beside.

## Approach
A font is a third key on the look, beside theme and palette, handled exactly as they are: declared once in
`server/catalog/storefront-themes.ts`, stored as a key on `OrgProfile`, published and switched back with the look,
and turned into CSS by a `[data-font]` scope in `globals.css` that repoints `--font-display-face`. Every place that
names something already reads `font-display` (storefront-look D1, D7), so the choice reaches all of them without
touching a section component.

## Prior art
Shopify Dawn: a heading font picker and a body font picker over a curated library (`type_header_font`,
`type_body_font` in `config/settings_schema.json`). We follow the heading picker and not the body picker (Q2), and
not Dawn's heading-scale slider (sizes are fixed, R3).

## Technical decisions
- **D1 — The list is code** (Q1, Q4): `FONT` keys `space`, `jost`, `dmsans`, `mulish`, `poppins`, `cormorant`,
  `playfair`, `marcellus`, each with a label, a one-line kind ("Serif · carved caps") and its face variable.
  Each theme declares its suggested keys (prototype: Edge space/poppins/dmsans; Darbar jost/marcellus/cormorant/
  playfair; Bloom dmsans/poppins/playfair/cormorant; Daily mulish/poppins/dmsans). A theme's default is its own
  display face, so `null` means "template default".
- **D2 — Delivery** (Q10): `next/font/google` in `src/components/storefront/theme-fonts.ts`, same options as the
  existing six (`display: swap`, `preload: false`, metric fallbacks). Two new calls: Marcellus (weight 400) and
  Poppins (weights 500, 600). Playfair Display is the root layout's heading face and already loaded on every page.
  The font class goes on the themed shell beside the theme's classes; with `preload: false` the browser fetches a
  file only when a rendered element uses that face (A4, R7). CSP `font-src 'self'` is unchanged.
- **D3 — Storage** (Q7): `OrgProfile.fontKey String?` and `previousFontKey String?`. Parsed on read like
  `themeKey`: an unknown key reads as `null`. [MIGRATION], additive and nullable; no backfill.
- **D4 — Published with the look** (Q6): `StorefrontLookInput` gains `font: FontKey | null`; the Zod schema in
  `storefront.schema.ts` adds `font: z.enum(FONT_KEYS).nullable()`. `publish` writes it with theme and palette under
  the same `lookVersion` compare-and-set; `revert` restores `previousFontKey`. A publish that changes only the font is
  a publish (the `sameLook` check compares the font too). The audit entry records the font key.
- **D5 — Scope, not values** (ADR-0064 D5): `[data-font="marcellus"] { --font-display-face: var(--font-marcellus); }`
  per key. The shell sets `data-font` only when a font is chosen, so no attribute means the theme's own face.
  Weight and case stay the theme's tokens (storefront-look D1), so a font cannot change proportions (R3).
- **D6 — What it reaches** (Q2): every `font-display` use in `src/components/storefront/themed/` and the product
  page title. The shell's header name, section headings, card names, category names, banner titles and the hero
  name already use or will use `font-display` after storefront-look; prices, chips, buttons and body keep `font-sans`
  / `font-label`. A registry test lists the components allowed `font-display`, so a price cannot pick it up by drift.
- **D7 — Picker** (Q9; ux.md Look and Font sheet): a `FontRow` on the selected template card in `look-picker.tsx`
  opens a sheet (ADR-0040: bottom sheet on a phone, side panel from `md:`). Each option is the shop's name set in that
  face, truncated at 24 characters. The live preview iframe takes `font` as a query key beside `theme` and
  `palette` (`preview-href.ts`); the preview page parses it with the same reader.
- **D8 — ADR** (Q8): a new ADR, "A shop may choose its storefront's heading face from a closed list", amending
  ADR-0064 D1, D6 and its last consequence for headings; ADR-0064 D5 stands.

## Packages
None. Marcellus and Poppins are in the installed `next/font/google` data.

## UI approach
Screens, states and copy are in [ux.md](../storefront-look/ux.md); the look is the prototype's.
- **Per form factor:** phone — bottom sheet over the Look screen; `md:` and `lg:` — side panel beside the preview.
- **Rendering:** the picker is already a client component; the sheet is a client leaf inside it. The store stays
  server-rendered; `data-font` is written by the server shell.
- **Behaviour:** `orgStorefrontApiClient.publishLook` sends `font`; `useLookWrite` unchanged. The sheet's state is
  local (`useState`) in the picker, as the palette choice is today.
- **Surfaces:** existing `Sheet` primitive; no new token beyond the `[data-font]` scopes.

## Gates touched
- `one-repository`: `fontKey` written only through the existing org-profile repository command the look uses.
- `request-body-parsing`: the look schema gains `font`; still parsed, never cast.
- `overlay-surfaces`: the font sheet is a sheet in the picker, which is already in `MAY_USE_SHEET`.
- `migration-drops`: none; additive columns.
- A new unit test: every `FONT` key has a `[data-font]` scope and a loader class; every scope names a loaded face.

## Data model
[MIGRATION] `OrgProfile.fontKey String?`, `OrgProfile.previousFontKey String?`.

## API / contract changes
`PUT /api/org/{orgId}/storefront/look` body gains `font` (nullable); `StorefrontLookState.live` and `.previous` gain
`font`. Both are in CONTRACTS.md (the look section), which moves in the same PR; the CHANGELOG entry carries [CONTRACT].

## Test plan
- Unit: font key parsing (unknown → null), schema accepts null and each key and refuses others.
- Unit: publish with only a font change bumps the version and records the previous font; revert restores it;
  stale version refused (A1, A3).
- Unit: scope/loader registry test (D2, D5); `font-display` allowlist (D6), mutation-tested.
- Manual: publish Marcellus on the preview store, confirm headings change and the title/price sizes do not (A2);
  network panel shows only Marcellus and the theme's body face (A4).

## Delivery (PRs)
1. Registry, faces, scopes and the ADR — no behaviour change (nothing sets `data-font` yet).
2. Migration, schema, service, API — font publishes and reverts.
3. Picker sheet, preview query key, shell attribute — the shop sees and uses it. Behaviour change.

## Open questions
None.
