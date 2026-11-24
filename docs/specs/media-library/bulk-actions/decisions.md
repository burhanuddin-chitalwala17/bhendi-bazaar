# Decisions — bulk-actions

- **Verified:** 2026-11-24

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones (ADR-0062).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Other documents cite Q ids.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Many selected items download as one zip or as separate files? | One zip | Owner | 2026-11-24 | Owner chose zip; separate downloads are blocked or nagged on phones | decided |
| Q2 | Does multi-select do more than download? | Download, Retire and Tag | Owner | 2026-11-24 | Owner chose bulk retire and tag too | decided |
| Q3 | Are hosted videos included in the zip? | Yes, the original file; YouTube links are left out and counted | Claude · reversible | 2026-11-24 | Owner chose "everything" for the viewer; a link has no file | decided |
| Q4 | Largest zip the seller may build at once? | 500 MB total; beyond that the bar says so and suggests fewer | Owner | 2026-11-24 | A phone browser builds the zip in memory; a cap is a product limit the owner sets | decided |
| Q5 | Bulk retire: what happens to items still in use? | Skipped, counted, and the Usage filter named | Claude · reversible | 2026-11-24 | Same rule as one item (media-library R7); ADR-0053 says why, not a dead end | decided |
| Q6 | Bulk tag with a mixed selection — add or toggle? | Two explicit actions per tag: "Add tag" and "Remove tag" | Claude · reversible | 2026-11-24 | A toggle on a mixed set has no single meaning | decided |
| Q7 | How does selection mode start? | A "Select" button above the grid; on desktop also a tick on tile hover | Claude · reversible | 2026-11-24 | Long-press is undiscoverable and clashes with the browser's image menu | decided |
| Q8 | Can "Select all" reach items not yet loaded? | No — it selects what is loaded, and says so | Claude · reversible | 2026-11-24 | Selecting what the seller has not seen invites retiring the wrong thing | parked |
| Q9 | Bulk crop or improve? | Not in this feature | Claude · reversible | 2026-11-24 | Each needs per-picture judgement; not asked for | parked |
| Q10 | Is there a cap on how many items one Retire or Tag request carries? | 100 per request, the same as the grid can load in a sitting | Claude · reversible | 2026-11-24 | Bounds a write; a seller never notices | decided |
| Q11 | What is the zip called? | `<shop code>-library-<date>.zip`; files inside named as a single download names them | Claude · reversible | 2026-11-24 | Says whose and when; files match what single download gives | decided |
| Q12 | What happens to a selection when a filter changes? | Selection mode ends and the selection clears | Claude · reversible | 2026-11-24 | A tick on a tile no longer shown is one the seller cannot see they made | decided |
| Q13 | Some files fail to fetch while zipping? | The zip holds what arrived; the toast offers to retry only the failed ones as a second zip | Claude · reversible | 2026-11-24 | Never makes the seller redo the twelve that worked | decided |
| Q14 | May the browser read files from the R2 bucket (add `GET` to its CORS policy) so the zip is built on the phone? | Yes — the owner adds `GET` beside `PUT` in the bucket's CORS policy before bulk-actions U3 ships | Owner | 2026-11-24 | The files are already public; this only lets our own pages read their bytes (trd D5) | decided |

## Parked (Later)
- Q8 — selecting beyond what is loaded; BACKLOG Phase 11.
- Q9 — bulk crop or improve; BACKLOG Phase 11.
