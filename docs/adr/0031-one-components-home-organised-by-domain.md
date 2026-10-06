# ADR-0031: One components home, organised by domain, with controls through the primitives

- **Date:** 2026-09-19
- **Status:** Accepted (D4 hooks home refined by [ADR-0057](0057-shared-hooks-live-in-one-core-folder-and-every-other-hook-travels-with-its-component.md))

## Context

Components lived in four places — `src/components` (111), `src/admin` (21), `src/containers` (8) and `src/org` (5) — plus a fifth, `src/components/admin`, holding a single file. Three of those were vestigial: nothing distinguished what belonged in `src/admin` from what belonged in `src/components`, and `src/containers` held one feature.

The split was by *audience*, which is the axis [ADR-0012](0012-modules-are-vertical-slices-by-domain.md) already rejected for `server/`. It also cost real coverage: `tests/unit/form-error-display.test.ts` scanned `src/components`, `src/admin` and `src/app` but not `src/org`, so an entire portal's forms were never checked. Folding `src/org` in immediately surfaced a field bound with no way to show its error.

Underneath sat a larger problem. Sixteen primitives existed in `src/components/ui` and were widely bypassed: **64 raw `<button>` across 32 files, 14 raw `<select>`, and 9 raw text inputs**, each re-implementing padding, border, focus ring and disabled state by hand — usually with a Tailwind literal like `rounded-lg` where the token is `rounded-field` ([ADR-0022](0022-design-decisions-go-through-tokens.md)). A raw `<input>` also misses `Input`'s 16px mobile base, which is the only thing stopping iOS zooming the page on focus ([ADR-0015](0015-mobile-first-design.md)), so a bypass was a defect on a phone rather than a matter of taste.

## Decision

1. **One home: `src/components`.** `src/admin`, `src/org`, `src/containers` and `src/components/admin` are dissolved.
2. **Placement is by domain, never by audience** — `product/`, `order/`, `org/`, `checkout/`, `shipping/`, `promotions/`, the same axis [ADR-0012](0012-modules-are-vertical-slices-by-domain.md) sets for `server/`. Admin and storefront share a product card; they do not share a folder. Console-only surfaces sit under their domain (`product/console/`), not under an `admin/` tree.
3. **Three folders are not domains and stay as they are:** `ui/` (primitives), `shared/` (cross-domain composites) and `layout/` (chrome).
4. **A component's non-component siblings travel with it** — its hooks, types and API client. A feature folder is the unit that moves.
5. **Every interactive control goes through the primitive.** No raw `<button>`, `<select>` or text `<input>` outside `src/components/ui`. `type="file"` and `type="hidden"` are the permanent exceptions: a styled field cannot be a file picker, and a hidden field renders nothing.
6. **Appearance comes from a variant, not a className.** A converted control keeps only its layout and positioning classes; padding, colour, radius and focus are the variant's job.
7. **`tests/unit/ui-primitives.test.ts` enforces 1, 5 and the dissolution.** A convention did not hold this before and would not hold it again.

## Alternatives considered

- **Leave the four homes and write a convention down.** Rejected: the convention already existed implicitly and produced five homes and 87 bypasses. The `src/org` coverage gap shows the cost is not only tidiness — a whole directory silently escaped a test that was meant to be global.
- **Organise by audience** — `components/storefront`, `components/admin`, `components/org` — which matches how `src/app` groups routes. Genuinely tempting, and rejected because the same component serves several audiences: a product card, a price display and a status badge are not storefront things or admin things. Audience grouping forces either duplication or an arbitrary owner, and [ADR-0012](0012-modules-are-vertical-slices-by-domain.md) already refused it one layer down.
- **Convert the bypasses but keep the folders.** Half the value for most of the churn, and it would have left the coverage gap that found the form defect.
- **Lint rules instead of a test** (`react/forbid-elements`). A reasonable choice and close. Rejected because lint is not run in CI here while the test suite is, and because the home-dissolution check has no lint equivalent.

## Consequences

- ✅ One place to look, and a component's folder says what it is about rather than who calls it.
- ✅ Every control now gets the focus-visible ring, disabled handling and token-driven shape it should always have had; the iOS zoom hazard is closed everywhere at once.
- ✅ Tests that scan `src/components` now genuinely cover the front end. The first run after the move found a real defect.
- ✅ Roughly 90 hand-rolled class strings collapsed into variants, so a redesign is a change to `button.tsx`, not a hunt.
- ⚠️ Every import path into the moved files changed — 46 files rewritten. Anything unmerged elsewhere will conflict, and `git log` on a moved file needs `--follow`.
- ⚠️ The conversion preserved layout classes but not pixel-perfect appearance: a variant's padding is not always what the hand-rolled class was. Typecheck and 681 tests pass, but the console screens deserve a visual pass.
- ⚠️ `console/` subfolders inside a domain are a shape that can drift back toward audience grouping if applied loosely. It means "the operator surface for this domain", nothing more.
