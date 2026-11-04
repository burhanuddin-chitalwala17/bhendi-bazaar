# TRD — foundations

- **Status:** Draft
- **Domain:** cross-domain (front end)
- **Phase:** 13 — Design system
- **Verified:** 2026-11-04
- **References:** [spec.md](spec.md), [../decisions.md](../decisions.md), [ADR-0066](../../../adr/0066-the-ui-is-built-in-tiers-and-every-icon-goes-through-one-seam.md), the 2026-11-04 audit spike (four reports: storefront, seller portal, admin, icons and render speed)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Extend the existing token file and primitives; add nothing beside them. The type roles join the
storefront roles already in `src/app/globals.css` (`--text-headline`, `--text-title`), which themes
repoint, so a theme keeps working. The icon seam is a new primitive in `src/components/ui/` with a
registry of meanings; every lucide import is rewritten to a name.

## Prior art
- **Icon seam:** Shopify Polaris, GitHub Primer and Atlassian expose icons by name through one
  component; Apple's SF Symbols is the same idea at the OS level. Followed.
- **Fluid type with a rem floor:** already ours (ADR-0022) and Utopia's method. Followed.
- **Delivery:** per-icon components rather than an SVG sprite. A sprite is zero-JS but paints empty
  until fetched and needs a build step; components inside Server Components already cost no JS. The
  sprite is reconsidered for the brand icons only.

## Technical decisions
- D1 — `ui/icon.tsx` renders a name from `ui/icons/registry.ts`. The registry is the one file that
  imports `@phosphor-icons/react` (its `/ssr` entry for Server Components). A brand drawing in
  `ui/icons/brand/` overrides a name. Props: `name`, `size` (token step), `weight`, `label`. Without
  `label` it is `aria-hidden`.
- D2 — Weight comes from the surface: a `data-icon-weight` attribute on the store and portal shells,
  read by the Icon component; `weight` overrides it for a selected state (Q11).
- D3 — Meanings first: about 60 names cover the 101 lucide glyphs in use. Near-duplicates collapse
  (`CheckCircle`/`CheckCircle2` → `success`; `AlertCircle`/`AlertTriangle` → `warning`;
  `XCircle` → `error`). `Loader2` gets no name: R7 makes it `Button pending` or a skeleton.
- D4 — Type: seven role tokens in `@theme`, each a `clamp()` from the phone value to the desktop
  value (Q10), with paired line height and tracking. `text-3xs` and `text-4xs` are deleted.
- D5 — Motion: `--duration-fast|base|slow` (120/200/320ms), `--ease-standard|emphasised`;
  `prefers-reduced-motion` already zeroes durations, kept.
- D6 — Depth: `--shadow-raised|lifted|overlay` keep their names, but their colour is a palette ink
  through `color-mix`, not `rgb(0 0 0 / …)` (ADR-0049).
- D7 — The React Compiler is turned on in this change; it is a build flag, measured by A9.

## Packages
`@phosphor-icons/react` (MIT) added and listed in DEPENDENCIES.md; `lucide-react` removed in the last
unit. It is added to `experimental.optimizePackageImports`, which does not include it by default.
`babel-plugin-react-compiler` for D7.

## UI approach
No screen's layout changes; ux.md records the before and after for the four pages in A1, at
360px, tablet and desktop, for sign-off. Rendering: Icon is a server component; it is a client
component only inside a client leaf, which is where it already sits.

## Gates touched
- A new icons gate in `tests/unit/`: no import of an icon library outside `ui/icons/`; every Icon without
  `label` is decorative, and an icon-only `Button` has `aria-label`. A ratchet (ADR-0056) while units land.
- `design-tokens.test.ts`: `text-3xs` and `text-4xs` refused; `cn-tokens.test.ts` registers new tokens.
- `double-submit.test.tsx`: `Loader2` count falls to zero.

## Data model
None.

## API / contract changes
None.

## Test plan
The gates above, mutation-tested; a render test that an unlabelled Icon is `aria-hidden` and a labelled one
is named; A9 recorded before and after in the CHANGELOG.

## Delivery (PRs)
1. Tokens: type roles, motion, depth (no visible change until adopted).
2. Icon seam and registry, with the gate as a ratchet over current lucide imports.
3. Store adopts: icons and type (changes behaviour; visible).
4. Seller portal adopts.
5. Admin adopts; ratchet empties; lucide removed; React Compiler on; A9 measured.

## Open questions
None. UX sign-off pending.
