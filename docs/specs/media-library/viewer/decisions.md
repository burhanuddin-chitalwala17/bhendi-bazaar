# Decisions — viewer

- **Verified:** 2026-11-25

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones (ADR-0062).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Other documents cite Q ids.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What does "View full image" open — an in-app viewer or the file in a new tab? | An in-app full-screen viewer that slides through the library | Owner | 2026-11-24 | Owner: a scrollable viewer, next images visible like a slider | implemented (unit 3) |
| Q2 | How is the viewer reached? | Two ways: a full-screen control on each grid tile, and a button in the side sheet | Owner | 2026-11-24 | Owner asked for both | implemented (unit 3) |
| Q3 | Does the viewer show only photos, or videos and YouTube links too? | Everything the grid shows: photos, hosted videos, YouTube links | Owner | 2026-11-24 | Owner chose "everything" | implemented (unit 3) |
| Q4 | Which items does the viewer slide through? | The grid's items, in grid order, under the filters in force; more load at the end | Claude · reversible | 2026-11-24 | What the seller just looked at is what they expect to flick through | implemented (unit 3) |
| Q5 | What is downloaded — the original or a resized copy? | The original stored file, named `<shop code>-<asset id>.<ext>` | Claude · reversible | 2026-11-24 | A seller sends it on; a resized copy loses detail they will want back | implemented (unit 1) |
| Q6 | Should the product page's lightbox and other pickers get this viewer too? | No — Library only | Claude · reversible | 2026-11-24 | One outcome; buyers already have the product lightbox | parked |
| Q7 | Where on a tile does the full-screen control sit, given the corners carry badges? | Top-left; a video's Processing/Failed badge moves below it | Claude · reversible | 2026-11-24 | Use count stays top-right where sellers look for it; state badges are rare | implemented (unit 3) |
| Q8 | Download on a YouTube link? | Offered, and on tap says it lives on YouTube with "Open on YouTube" | Claude · reversible | 2026-11-24 | ADR-0053: nothing disabled, the reason is one tap away | implemented (unit 2) |
| Q9 | Does a photo zoom in the viewer? | Yes, pinch and wheel, as the product lightbox does | Claude · reversible | 2026-11-24 | Checking sharpness is why a seller opens it full screen | implemented (unit 3) |
| Q10 | Can a retired item be viewed and downloaded? | Viewed, yes. Downloaded while its file is kept (thirty days); after that the download says the file is gone | Claude · reversible | 2026-11-24 | Retired is a record kept (ADR-0032), but its bytes are deleted after thirty days | implemented (unit 2) |
| Q11 | Where does closing the viewer return to? | Where it was opened from; the grid is scrolled to the item last shown | Claude · reversible | 2026-11-24 | The seller swiped to it, so it is what they want next | implemented (unit 3) |

## Parked (Later)
- Q6 — the viewer on surfaces other than the Library; BACKLOG Phase 11.
