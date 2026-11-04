# ADR-0065: The UI is built in tiers, and every icon goes through one seam

- **Date:** 2026-11-04
- **Status:** Proposed

## Context

The front end already has layers — palette, semantic tokens, the `@theme` bridge, `ui/` primitives,
`shared/` and `layout/` wrappers, domain composites ([src/components/CLAUDE.md](../../src/components/CLAUDE.md)) —
but some of them had no rule for what belongs in them. Icons are the clearest case: a library was
imported directly wherever one was wanted, so a single visual decision lived in hundreds of files,
drifted into near-duplicates, and could not be changed. Page-level patterns (a header, an action bar,
an empty state) had the same gap: with no named home, each screen built its own. The owner's
direction (design-system Q1, Q5, Q6) needs these tiers to be explicit, so new work cannot erode them.

## Decision

1. **The tiers, each reading only from the one above:**
   palette → semantic tokens → bridge (`globals.css`) → **primitives** (`src/components/ui/`, the design-system
   library) → **shared composites** (`src/components/shared/`, cross-domain and meaningful: a price, a
   status, a page header) → **domain composites** (`src/components/<domain>/`) → **layouts** (`src/components/layout/`:
   chrome and page frames) → pages (`src/app/**`).
2. **Placement tests.** A file is a primitive if it carries no project meaning and wraps one control or
   one drawing. It is shared if two or more domains use it, or it is a page pattern. A component used by
   one domain lives in that domain, even when it sits in `shared/` today. Domain code in `shared/` is a defect.
3. **Every icon goes through `ui/icon.tsx`**, by a name that states its meaning. Only `ui/icons/` imports an
   icon library or holds an SVG drawing. A brand drawing overrides a name without touching a call site.
4. **One meaning, one icon.** A second icon for an existing meaning is a review finding.
5. **Icons are decorative or named.** An Icon without a `label` is hidden from assistive technology; an
   icon-only control carries `aria-label`.
6. **Type, motion and depth are role tokens** like colour already is: a call site names a role
   (`text-body`, `duration-base`, `shadow-lifted`), never a size, a millisecond or a shadow value.
7. **Render rules every tier follows:** server components by default (ADR-0034); a slow part streams
   behind its own Suspense; the largest above-the-fold image is preloaded; a long grid uses
   `content-visibility`; nothing below the bridge sets a pixel value that would shift layout.
8. **Enforced by tests** (`icons.test.ts`, `design-tokens.test.ts`, `ui-primitives.test.ts`), each a
   ratchet while existing debt is cleared (ADR-0056).

## Alternatives considered

- **Swap lucide for a nicer library and keep importing it directly.** The obvious move, and the cheapest
  today. Rejected: it repeats the cause. The next change of taste, or the owner's own icons, would be
  another several-hundred-file edit, and near-duplicates would grow back.
- **An SVG sprite as the seam.** Zero JavaScript and one cached file. Rejected as the default: it paints
  empty until fetched and needs a build step to stay tree-shaken, while icons inside server components
  already ship no JavaScript. Kept as an option for the brand icons.
- **Rename the folders to `design-system/` and `shared/components/`.** Matches the vocabulary of the
  owner's brief. Rejected: the existing folders already mean exactly these tiers, and a rename rewrites
  roughly 400 imports for no change in behaviour (design-system Q9).
- **Atomic design (atoms, molecules, organisms).** Familiar, and rejected because its boundaries are by
  size, not by meaning; it does not answer whether a price badge belongs to a domain or to everyone,
  which is the question this codebase actually gets wrong.

## Consequences

- ✅ A change of icon set, or the owner's own drawings, is one file. Type, motion and depth move the same way.
- ✅ Every tier has a placement test, so "where does this go" has one answer and review can check it.
- ✅ Accessibility of icons is decided once, not per call site.
- ⚠️ A registry of names is a vocabulary to maintain; a missing meaning blocks a call site until it is added.
- ⚠️ Until the ratchets empty, two icon voices coexist on some screens.
- ⚠️ Moving domain code out of `shared/` touches imports in files that are otherwise unchanged.
