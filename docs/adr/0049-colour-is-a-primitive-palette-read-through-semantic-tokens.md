# ADR-0049: Colour is a primitive palette, read only through semantic tokens

- **Date:** 2026-10-02
- **Status:** Accepted

## Context

[ADR-0022](0022-design-decisions-go-through-tokens.md) made every design axis a semantic token, and that holds: there are no raw palette classes in `src/`. But the tokens were also where the colours were spelled out. `src/app/globals.css` held **52 distinct `oklch()` values across 152 declarations**:
- The warm charcoal ink appeared 7 times, and four other values 4–5 times each.
- The hero and scrim colours sat inline in `@theme`.

The repetition hid the near-duplicates:
- the ring and the dark-mode primary are the same emerald at two saturations;
- dark mode's destructive is 5° of hue away from light mode's.

Nothing showed these as choices rather than drift. Four themes now draw from one set of colours (light, dark, `.portal`, the storefront accents in ADR-0030 D8), so "which colours do we own" needs one answer.

## Decision

1. **Two tiers.** A primitive palette at the top of `globals.css` holds every colour value, named by family and lightness: `--emerald-550` is L 0.55. Where two share a family and lightness, the lower-chroma one is `-soft`. Every semantic token, in every theme block, is a `var()` to a primitive.
2. **Primitives are not Tailwind tokens.** They sit in `:root`, not `@theme`, so no `bg-emerald-550` utility exists. A component can only name what a colour is for.
3. **The extraction moved no colour.** Every declaration resolves to the value it had before, which was checked declaration by declaration. Merging the near-duplicates is a design decision and is left to make on purpose.
4. **Enforced by `tests/unit/design-tokens.test.ts`:**
   - no raw colour value outside the palette (except shadows and the print stylesheet);
   - no unused primitive;
   - no file in `src/` naming a primitive.

## Alternatives considered

- **One tier, as shadcn ships it.** Semantic tokens holding raw values is the default shape and works for one theme. Rejected because there are four, and the repetition was already hiding near-duplicates.
- **Expose the palette as Tailwind colours** (`bg-emerald-550`). This is the conventional design-system setup, and it would make primitives usable at the call site, which is exactly the bypass ADR-0022 closed. Rejected.
- **Generate tokens from a JSON source** (Style Dictionary). Worth it with several consumers, such as native apps or email templates. There is one consumer today, so it is a dependency with nothing to do.

## Consequences

- ✅ A theme or a shop accent picks from colours the system owns. A new near-duplicate shows up as a new palette line in review.
- ✅ The near-duplicates are now visible as `-soft` twins and can be merged deliberately.
- ⚠️ Two hops from class to value when reading the CSS.
