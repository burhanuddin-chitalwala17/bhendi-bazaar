# Decisions — design-system

- **Verified:** 2026-11-04

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones (ADR-0062).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Other documents cite Q ids.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Which icon set replaces lucide? | Phosphor (MIT, six weights) behind one `Icon` seam, so the owner's own icons replace it name by name later | Owner | 2026-11-04 | Free; weights give the store a lighter voice than the portals; the seam keeps the choice cheap to reverse | decided |
| Q2 | Who draws the brand icons? | Claude drafts 6–10 SVGs on Phosphor's grid; the owner approves them on a preview page before any ships | Owner | 2026-11-04 | The owner has no icon experience; drafts on the same grid match the base set | decided |
| Q3 | New visual direction, or refine the brand? | Keep emerald, parchment, gold and the serif; refine how they are used | Owner | 2026-11-04 | Brand equity; the problem is usage, not the palette | decided |
| Q4 | Fix the audit's defects now or with the revamp? | Now, as fixes (CHANGELOG 2026-11-04, "Seven UI defects") | Owner | 2026-11-04 | They are bugs; design sign-off should not hold them | implemented |
| Q5 | Which form factors does the revamp design? | Phone first for shoppers; tablet (`md:`) and desktop (`lg:`) designed for every screen, not stretched | Owner | 2026-11-04 | Owner's instruction; ADR-0015, ADR-0050 | decided |
| Q6 | How does type behave on a phone? | Each role has its own phone size, smaller and tighter than desktop; floor 11px; values in foundations Q10 | Owner | 2026-11-04 | "Sophisticated, not enlarged" on small screens | decided |
| Q7 | Is render speed in scope? | Yes, as a rule every subfeature follows; the Cache Components migration is its own subfeature (Q8) | Owner | 2026-11-04 | Owner asked for fast mounting and painting | decided |
| Q8 | Turn on Cache Components / partial prerendering inside foundations? | No: subfeature 7. It removes route segment config and changes caching across every page | Claude · reversible | 2026-11-04 | A migration of its own, not a token change | decided |
| Q9 | Rename `ui/`, `shared/`, `layout/` to `design-system/` and `shared/components/`? | No. `ui/` is the design-system library, `shared/` the cross-domain components, `layout/` the chrome and page layouts; ADR-0065 names the tiers | Claude · reversible | 2026-11-04 | Same meaning as the owner's tiers; a rename rewrites ~400 imports for no behaviour | decided |
| Q10 | Phone type scale | Phone → desktop: display 28→48, headline 22→32, title 18→22, body 15→16, small 13→14, caption 12, label 11 (uppercase, 0.08em). Inputs keep 16px | Claude · reversible | 2026-11-04 | iOS body is 17pt and Material 14–16px; fashion apps run 13–15px on phones. 15px reads as refined without losing legibility; 16px inputs stop iOS zooming (ADR-0015) | decided |
| Q11 | Icon weight by surface | Store `light`, portal and admin `regular`, a selected state `fill` | Claude · reversible | 2026-11-04 | Lighter strokes match the serif; portals need legibility at 16px | decided |
| Q12 | Phone product grid: 3-up (ADR-0016) or 2-up (the code since b2c4ce46)? | 2-up stays; ADR-0016's grid clause is superseded in storefront-journey | Claude · reversible | 2026-11-04 | Myntra, Nykaa and Ajio show apparel 2-up; cloth cannot be judged at 105px | decided |

## Parked (Later)
- Q13 — An admin chart (revenue trend) needs a chart package or hand-drawn SVG; decided in admin-console's TRD.
- Q14 — Auth pages and `/sell` restyled; they follow in storefront-journey once the page grammar exists.
- Q15 — `shared/forms/product/` (~1,900 lines) moves to `product/`; layering clean-up done in page-grammar.
- Q16 — Keyboard shortcuts and a ⌘K palette for admin; admin-console, if its UX asks for them.
- Q17 — View Transitions between a product tile and its page; storefront-journey.
