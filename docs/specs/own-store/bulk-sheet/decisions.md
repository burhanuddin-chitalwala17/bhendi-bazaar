# Decisions — own-store/bulk-sheet

- **Verified:** 2026-11-01

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones (ADR-0062).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Other documents cite Q ids. The
> parent's decisions bind here and are not repeated: own-store Q10 (stale sheet warned, refused
> only if columns no longer read; always recommend a fresh one), Q11 (tick categories, one tab per
> type in one file), Q17 (admin may bulk-upload for a shop, audited), Q24 (sale price saved — implemented).

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | How is the feature cut? | One outcome, five units (spec Scope In); the form is the sibling product-form | Claude · reversible | 2026-10-30 | Each unit ships alone and is testable on a real file | decided |
| Q2 | What does the download page ask? | Categories the shop sells, as ticks grouped by type, prefilled with the categories the shop already uses; nothing else | Claude · reversible | 2026-10-30 | Ask at the point of need; locations, brands and families come from the shop already | implemented |
| Q3 | What tabs does the file have, in what order? | Instructions · one tab per type ticked (named by the type: "Abaya") · "Other" when a ticked category has no type · hidden Lists | Claude · reversible | 2026-10-30 | own-store Q11; Instructions first is what opens | decided |
| Q4 | What does the Instructions tab say? | Five numbered steps (fill a tab per type, use the dropdowns, name photos, save as .xlsx, upload with photos), a colour key (orange heading = required), the photo-naming rule with an example, the made-on date and version, and "Download a fresh sheet each time — our lists change" | Claude · reversible | 2026-10-30 | Owner asked for instructions in the sheet itself; one screen, no essay | decided |
| Q5 | How are columns read if a heading is renamed? | By a hidden key row under the visible heading; the visible heading is only for people | Claude · reversible | 2026-10-30 | Hazard "renamed headings" | implemented |
| Q6 | What shows in a category cell? | The path, "Women › Abayas", from a dropdown of that type's categories; a slug is still accepted | Claude · reversible | 2026-10-30 | Hazard "look-alike names"; a slug is our word, not the shop's | decided |
| Q7 | Which columns get dropdowns? | Category, kind, family, brand, every answer, every yes/no fact. Family allows a new name (warning, not stop); all others stop on a typed value | Claude · reversible | 2026-10-30 | A new family is legitimately created from the sheet (variants R2); every other value is the platform's | decided |
| Q8 | How are typed words matched? | Against the label and the key, ignoring case, spaces and punctuation; anything else is a problem naming the closest listed value | Claude · reversible | 2026-10-30 | Hazard "pasted values"; never a silent guess (bulk-catalog-upload image rule) | decided |
| Q9 | What is the example row? | Row 4 of each tab, under the help line (TRD D2), greyed, its name cell "EXAMPLE — this row is skipped"; skipped on upload while that marker stays | Claude · reversible | 2026-11-01 | Hazard "example rows"; seeing a filled row teaches faster than a note. Was: row 3, first cell "EXAMPLE" — before the help line took row 3 | implemented |
| Q10 | What is the version? | A stamp on the hidden Lists tab and on Instructions: the made-on date and a fingerprint of the columns and lists. Same → silent; lists differ but columns read → warning, accepted; a column missing or renamed → refused naming it | Claude · reversible | 2026-10-30 | own-store Q10 made concrete | decided |
| Q11 | Where does the Problems column go? | Column A of each tab, so it is the first thing seen; rows with no problem are blank there | Claude · reversible | 2026-10-30 | On a phone spreadsheet the far right is never seen; Amazon's last-column report is missed by sellers | decided |
| Q12 | What is in the returned file? | The seller's own file, every cell and format as uploaded, plus Problems, a red fill and a note on each bad cell; the Problems column is ignored on the next upload | Claude · reversible | 2026-10-30 | Hazard "lost formatting"; fix and re-upload the same file | decided |
| Q13 | Is .csv still accepted? | Yes, one sheet: its type is read from each row's category; the download is always .xlsx | Claude · reversible | 2026-10-30 | CSV cannot carry tabs or dropdowns, but some sellers export one | decided |
| Q14 | How are photos given? | Unchanged: folder or files uploaded alongside, named in the row (bulk-catalog-upload R2) | Claude · reversible | 2026-10-30 | Works today; links are Q21 | decided |
| Q15 | How many rows per upload? | 300, as today, across all tabs; over that the check names the count and asks to split | Claude · reversible | 2026-10-30 | Existing limit; the error file makes splitting cheap | decided |
| Q16 | What does the wizard look like? | Four steps on a phone: Get the sheet · Fill it · Upload sheet and photos · Check and create | Claude · reversible | 2026-10-30 | Matches the product form's stepped shape | implemented |
| Q17 | How is an admin upload recorded? | One audit entry per upload: admin, shop, reason, file name, counts created and updated, product ids; each product carries the team notice | Claude · reversible | 2026-10-30 | own-store Q17; one entry, not three hundred | decided |
| Q18 | Is the version also checked for admin uploads? | Yes, identically | Claude · reversible | 2026-10-30 | One rule for every uploader | decided |
| Q19 | If some rows have problems, are the clean rows created? | **Recommend no**: nothing is created until the whole sheet is clean, as today; the returned file makes fixing quick | Owner | 2026-10-30 | Policy. Creating part leaves the seller unsure which rows went live, and re-uploading rows without SKUs creates duplicates. Amazon creates the clean rows | decided |
| Q25 | What does the Video column take? | A YouTube link only, as today (`sheet-columns.ts` "Optional: a YouTube link."; `bulk-product.service.ts` writes only `YOUTUBE`). Help row: "YouTube link only. Add a video file from the product form after upload." Instructions step 3 gains the same line. A non-link reads "Not a YouTube link: "{value}" — add a video file from the product form after upload" — the code's message plus where to go | Claude · reversible | 2026-10-30 | Video files go up one at a time, uncompressed, and are transcoded by the worker; a 300-row sheet is no place for 200 MB each. Saying where a file goes stops the seller guessing | implemented |
| Q27 | What is the shown version? | The first six characters of the fingerprint of columns and lists | Claude · reversible | 2026-10-30 | A counter would need stored state; a fingerprint changes exactly when the sheet would (TRD D4) | decided |
| Q28 | How is a sheet with no stamp read? | A .csv or an old .xlsx is read by heading text, as today; an unstamped .xlsx is warned with its file's creation date | Claude · reversible | 2026-10-30 | Sheets downloaded before this ships must still upload (own-store Q10) | decided |
| Q29 | Where is "Last downloaded" kept? | In the device's storage, per shop | Claude · reversible | 2026-10-30 | A nudge, not a record; no server state for it (TRD D12) | implemented |
| Q30 | What comes back for an uploaded .csv with problems? | An .xlsx of its own cells with Problems, fills and notes | Claude · reversible | 2026-10-30 | A .csv cannot carry a fill or a note; Q13 keeps .csv accepted | decided |

## Parked (Later)
- Q20 — Download a sheet prefilled with the shop's current products, to edit in bulk: a new export; SKU updates cover edits meanwhile. BACKLOG.
- Q21 — Photos given as links instead of uploaded: a new fetch path and its abuse cases. BACKLOG.
- Q26 — Video files named in the sheet and uploaded alongside the photos: needs the bulk upload to send videos to the worker and a per-row processing state. BACKLOG.
- Q22 — Instructions in Hindi and Gujarati: parent own-store Later (regional languages).
- Q23 — A Google Sheets add-on that checks while typing: an external dependency. BACKLOG.
- Q24 — Scheduled re-upload from a shared sheet: a new capability. BACKLOG.
