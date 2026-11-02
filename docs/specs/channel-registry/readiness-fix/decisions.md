# Decisions — readiness-fix

- **Verified:** 2026-11-03

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Other documents cite Q ids.
> Binding here: channel-registry D10 and ADR-0053 (readiness advises, never gates); marketplace-integration
> Q42 (nothing filled from a guess) and Q43 (any answer can be changed later); marketplace-facts Q36.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What is this feature's one outcome? | The shop clears what keeps its products off Google, Meta and the marketplaces in one sitting, one missing fact at a time, instead of product by product | Owner | 2026-11-03 | Production check: 79 products miss one fact (colour); fixing them one product page at a time is not a job anyone will do | implemented |
| Q2 | Where does the shop start? | The "Ready to list elsewhere" card on Products: each line names its gap ("79 need a colour") with "Fix them" | Owner | 2026-11-03 | Owner asked where the panel is; it is the card already there | implemented |
| Q3 | Page or drawer? | A page of its own, one per channel and fact | Claude · reversible | 2026-11-03 | 79 rows with photos need the whole phone screen; a page keeps its place and can be returned to | implemented |
| Q4 | How is an answer saved? | The moment it is picked, one product at a time; the row moves to "Done" with "Undo". No Save button | Claude · reversible | 2026-11-03 | 79 picks with one Save at the end loses all of them to one lost connection; a pick is small and undoable (parent Q43) | implemented |
| Q5 | Several at once? | Tick rows, then "Set for {n} selected" with one pick. Only empty answers are written; a product answered meanwhile is left and named | Claude · reversible | 2026-11-03 | Many products share a colour; a bulk write must never overwrite (marketplace-facts D7) | implemented |
| Q6 | What helps the pick? | The product's main photo, large enough to judge; and where a marketplace listing said a colour we could not match, "Amazon says: Dark Green" beside the picker. Never pre-selected | Claude · reversible | 2026-11-03 | Parent Q42: nothing filled from a guess; Amazon's word is evidence, the owner decides | implemented |
| Q7 | Gaps the shop cannot fix (no category on that channel, like fragrance on Google)? | Their own line on the card: "3 have no Google category" with "Ask the admin", the existing ask (marketplace-facts Q13) | Claude · reversible | 2026-11-03 | A gap with no fix offered reads as a broken promise | implemented |
| Q8 | Which gaps get "Fix them"? | Any missing compulsory fact of a choice or a word; measurements and facts that need a typed number open the product instead | Claude · reversible | 2026-11-03 | A picker fits a list; a number needs the product's own form | implemented |

## Parked (Later)
- Q9 — A colour suggested from the photo by an image model, confirmed by the owner; after this page, if picks prove slow.
- Q10 — Products with no type ("LADIES MASALLA BAG" and others): fixed by the admin giving the category a type, which their products now adopt (CHANGELOG 2026-11-03).
