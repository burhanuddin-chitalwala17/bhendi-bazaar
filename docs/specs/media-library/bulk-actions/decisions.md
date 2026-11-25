# Decisions — bulk-actions

- **Verified:** 2026-11-25

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones (ADR-0062).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Other documents cite Q ids.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Many selected items download as one zip or as separate files? | One zip | Owner | 2026-11-24 | Owner chose zip; separate downloads are blocked or nagged on phones | implemented (unit 3) |
| Q2 | Does multi-select do more than download? | Download, Retire and Tag | Owner | 2026-11-24 | Owner chose bulk retire and tag too | implemented (unit 3) |
| Q3 | Are hosted videos included in the zip? | Yes, the original file; YouTube links are left out and counted | Claude · reversible | 2026-11-24 | Owner chose "everything" for the viewer; a link has no file | implemented (unit 1) |
| Q4 | Largest zip the seller may build at once? | 500 MB total; beyond that the bar says so and suggests fewer | Owner | 2026-11-24 | A phone browser builds the zip in memory; a cap is a product limit the owner sets | implemented (unit 1) |
| Q5 | Bulk retire: what happens to items still in use? | Skipped, counted, and the Usage filter named | Claude · reversible | 2026-11-24 | Same rule as one item (media-library R7); ADR-0053 says why, not a dead end | implemented (unit 1) |
| Q6 | Bulk tag with a mixed selection — add or toggle? | Two explicit actions per tag: "Add tag" and "Remove tag" | Claude · reversible | 2026-11-24 | A toggle on a mixed set has no single meaning | implemented (unit 3) |
| Q7 | How does selection mode start? | A "Select" button above the grid; on desktop also a tick on tile hover | Claude · reversible | 2026-11-24 | Long-press is undiscoverable and clashes with the browser's image menu | implemented (unit 3) |
| Q8 | Can "Select all" reach items not yet loaded? | No — it selects what is loaded, and says so | Claude · reversible | 2026-11-24 | Selecting what the seller has not seen invites retiring the wrong thing | parked |
| Q9 | Bulk crop or improve? | Not in this feature | Claude · reversible | 2026-11-24 | Each needs per-picture judgement; not asked for | parked |
| Q10 | Is there a cap on how many items one Retire or Tag request carries? | 100 per request, the same as the grid can load in a sitting | Claude · reversible | 2026-11-24 | Bounds a write; a seller never notices | implemented (unit 1) |
| Q11 | What is the zip called? | `<shop code>-library-<date>.zip`; files inside named as a single download names them | Claude · reversible | 2026-11-24 | Says whose and when; files match what single download gives | implemented (unit 2) |
| Q12 | What happens to a selection when a filter changes? | Selection mode ends and the selection clears | Claude · reversible | 2026-11-24 | A tick on a tile no longer shown is one the seller cannot see they made | implemented (unit 3) |
| Q13 | Some files fail to fetch while zipping? | The zip holds what arrived; the toast offers to retry only the failed ones as a second zip | Claude · reversible | 2026-11-24 | Never makes the seller redo the twelve that worked | implemented (unit 3) |
| Q14 | May the browser read files from the R2 bucket (add `GET` to its CORS policy) so the zip is built on the phone? | Yes — the owner adds `GET` beside `PUT` in the bucket's CORS policy before bulk-actions U3 ships | Owner | 2026-11-24 | The files are already public; this only lets our own pages read their bytes (trd D5). Owner confirmed the policy allows `GET`, 2026-11-25 | implemented (unit 3) |
| Q15 | Does a file stream into the zip as it arrives, or is it read whole first? | Read whole, then added; peak memory is the zip plus one file, not one chunk | Claude · reversible | 2026-11-25 | A fetch that fails halfway would otherwise leave a valid-looking zip with a truncated file in it; skipped and reported is what Q13 promises. Stored entries reuse the chunks, so the cost is one file, briefly (trd D6 amended) | implemented (unit 2) |
| Q16 | What do the zip outcomes U2 surfaced without copy say (limit hit mid-download, removed, no longer ours, nothing to zip)? | The four lines in ux.md's copy deck, as drafted | Owner | 2026-11-25 | Copy is taste; U2 found these states once real sizes and per-item reasons existed | implemented (unit 3) |
| Q17 | Which surfaces do the retire confirm and the tag picker use, where ux.md says "centred dialog at every size" and "side panel from md"? | As trd UI approach says: retire is `FormDialog` (bottom sheet on a phone, centred dialog from md); tag is `ResponsivePicker` (bottom sheet on a phone, a popover on the bar's Tag button from md). The picker's subtitle sits in its body, since the popover shows no description | Claude · reversible | 2026-11-25 | ADR-0040 picks an overlay by what it holds, and the accepted TRD named both; a centred dialog at 360px puts its button under the thumb's reach least well | implemented (unit 3) |
| Q18 | Where does the `lg` hover tick sit (Q7), when the ⤢ holds the top-left until the mode starts? | Top-right, over the use count, which hides while the tile is hovered; in the mode the tick takes the top-left and the ⤢ is hidden | Claude · reversible | 2026-11-25 | The ⤢ must stay reachable on hover; the use count is the one badge that can step aside for a moment | implemented (unit 3) |
| Q19 | What does the bar say when a later batch of a >100 Retire or Tag fails after earlier ones landed? | The outcome toast for what landed, then "Couldn't reach the server." — the first sentence of the approved unreachable line, since "Nothing was changed" would be false. What did not change stays ticked | Claude · proposed — owner to confirm (copy is the owner's, as Q16) | 2026-11-25 | R6: never leave the shop unsure which items changed; no new words, only fewer. Built so the phone walk can judge it | implemented (unit 3) |

## Parked (Later)
- Q8 — selecting beyond what is loaded; BACKLOG Phase 11.
- Q9 — bulk crop or improve; BACKLOG Phase 11.
