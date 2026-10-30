# UX — own-store/bulk-sheet

- **Status:** Signed off
- **Verified:** 2026-10-30
- **Prototype:** `product-listing-prototype.html` (shared with product-form; owner to publish as a private artifact and link here)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

## Journeys
Each starts one step before the screen, as the owner asked.
1. **Shop: list many products (R1–R3, R8).** Products tab → "Add many at once" → Get the sheet:
   ticks Abayas and Attar → "Download sheet" → opens it in Excel: Instructions tab, then Abaya
   and Attar tabs, dropdowns in every list column → fills 40 rows → back in the app, "Upload sheet
   and photos" → picks the file and the photo folder → "Check the sheet" → "All 40 rows look good ·
   32 new, 8 updates" → "Create 32 · update 8" → "40 products on sale" → "View products".
2. **Shop: goes wrong — mistakes in the sheet (R6, R7).** "Check the sheet" → "6 problems in 4
   rows · nothing created yet" → list grouped by row → "Download your sheet with problems marked"
   → opens it: Problems column first, red cells with notes → fixes → uploads the same file → clean.
3. **Shop: goes wrong — old sheet (R4).** Uploads a sheet from 12 Oct → amber banner "This sheet
   is from 12 Oct. Our lists changed since — new rows may miss new choices." → "Continue with this
   sheet" or "Download a fresh sheet". If a column no longer reads: red "This sheet is too old to
   read: the 'Colour' column has changed." → "Download a fresh sheet".
4. **Shop: comes back next week (R4).** "Add many at once" → Get the sheet shows "Last downloaded
   12 Oct · Our lists change, so download a fresh sheet each time" → ticks prefilled → "Download sheet".
5. **Admin: upload for a shop (R9).** Shop emails its spreadsheet → Admin › Shops › shop → "Add
   many for this shop" → banner "Uploading for Noor Attar House — the shop will see this" →
   reason → same four steps → "Created 40 for Noor Attar House" → each product shows the team notice.

## Screens
| Screen | Route | Reached from | Change | Serves |
|---|---|---|---|---|
| Get the sheet | `/org/[orgId]/products/bulk` step 1 | Products "Add many at once", home setup list | New: category ticks by type, fresh-sheet nudge | R1, R4 |
| Upload | same route, step 3 | "I've filled it" | Restyled: file, photos, version banner | R4 |
| Check and create | same route, step 4 | "Check the sheet" | Problems grouped by row, download marked file, create/update counts | R6–R8 |
| Admin bulk for shop | `/admin/orgs/[orgId]/products/bulk` | Admin shop page "Add many for this shop" | New route over the same wizard, banner and reason | R9 |
| The workbook | downloaded `.xlsx` | "Download sheet" | Instructions, a tab per type, dropdowns, version | R1–R4 |
| The returned workbook | downloaded `.xlsx` | "Download your sheet with problems marked" | Problems column, red cells, notes | R6 |

Step 2, "Fill it", is a short screen ("Fill the sheet on your laptop or phone, then come back")
with "I've filled it"; it needs no matrix of its own beyond the Get the sheet rows.

## State matrix — Get the sheet
| State | What the person sees | Copy | One action |
|---|---|---|---|
| First use | Categories grouped by type, none ticked | "Which things do you sell? Tick them — your sheet gets one tab for each kind." | "Download sheet" |
| Empty | Shop has no pickup address | "Add where your stock is kept first — the sheet needs a stock column for it." | "Add location" (inline) |
| Loading | Category list skeleton | — | — |
| Partial | Some ticked | "2 tabs: Abaya, Attar" | "Download sheet" |
| Success | File downloads; toast | "Sheet downloaded. Open it, fill it, then come back here." | "I've filled it" |
| Retryable error | Download fails | "Couldn't make your sheet. Try again." | "Try again" |
| Terminal error | n/a — every choice makes a valid sheet; none ticked makes one "Other" tab | — | — |
| Refused | "Download sheet" with nothing ticked | "Tick at least one thing you sell, so the sheet has the right columns." | Tick a category |
| Stale | Downloaded before | "Last downloaded 12 Oct. Our lists change, so download a fresh sheet each time." | "Download sheet" |
| Long content | Long category paths wrap | — | — |
| Many items | 60+ categories: search, groups collapsed beyond the shop's own | "Search categories" | — |
| Slow | Over 3 s: spinner on the button | "Making your sheet…" | — |
| Phone / tablet / desktop | Phone: list then sticky button. `md:` two columns of groups. `lg:` plus a preview of the tabs | — | — |

## State matrix — Upload
| State | What the person sees | Copy | One action |
|---|---|---|---|
| First use | Two pickers: sheet, photos | "Your filled sheet (.xlsx or .csv)" · "Your photos — a folder keeps each product's photos apart" | "Check the sheet" |
| Empty | Sheet with no rows besides the example | "Your sheet has no products yet — the example row is skipped." | "Pick another file" |
| Loading | Reading the file | "Reading your sheet…" | — |
| Partial | Sheet picked, no photos | "Add the photos your sheet names." | "Add photos" |
| Success | Moves to Check and create | — | — |
| Retryable error | Upload fails | "Couldn't upload. Check your internet." | "Try again" |
| Terminal error | Not a spreadsheet, or unreadable | "This isn't a sheet we can read. Save it as .xlsx and try again." | "Pick another file" |
| Refused | Columns no longer read (own-store Q10) | "This sheet is too old to read: the '{column}' column has changed." | "Download a fresh sheet" |
| Stale | Older version that still reads | "This sheet is from {date}. Our lists changed since — new rows may miss new choices." | "Continue with this sheet" / "Download a fresh sheet" |
| Long content | Long file names truncate in the middle | — | — |
| Many items | 1,000+ photos: count only | "1,240 photos picked, in folders" | — |
| Slow | Large file over 3 s: progress | "Reading your sheet… 60%" | — |
| Phone / tablet / desktop | Phone: stacked pickers, sticky button; folder pick falls back to multi-select on phones | — | — |

## State matrix — Check and create
| State | What the person sees | Copy | One action |
|---|---|---|---|
| First use | Clean summary | "All 40 rows look good · 32 new, 8 updates" | "Create 32 · update 8" |
| Empty | n/a — Upload's Empty row stops here first | — | — |
| Loading | Checking rows | "Checking 40 rows…" | — |
| Partial | Some rows with problems (Q19) | "6 problems in 4 rows · nothing created yet" | "Download your sheet with problems marked" |
| Success | Done | "40 products on sale · 32 new, 8 updated" | "View products" |
| Retryable error | Create fails mid-way on network | "Couldn't finish. Nothing was changed — try again." | "Try again" |
| Terminal error | Over 300 rows | "Your sheet has 412 rows. Upload 300 or fewer at a time — split it into two sheets." | "Pick another file" |
| Refused | SKU held by an archived product | Row line: "Row 9 · SKU AB-12 belongs to an archived product. Restore it, or use another code." | "Download your sheet with problems marked" |
| Stale | n/a — the check is made on the file just uploaded | — | — |
| Long content | Problem lines wrap; names truncate | — | — |
| Many items | 100+ problems: grouped by row, 20 shown, "Show all"; filter by column | "Show all 140 problems" | — |
| Slow | Photo upload and create show progress; leaving warns | "Uploading photos 34/120… keep this page open" | — |
| Phone / tablet / desktop | Phone: list, sticky button. `md:` problems as a table with column names | — | — |

## State matrix — Admin bulk for shop
| State | What the person sees | Copy | One action |
|---|---|---|---|
| First use | Banner and reason above the wizard | "Uploading for {Shop}. The shop will see 'Edited by Bhendi Bazaar team'." | Type a reason |
| Empty | Shop has no locations | "{Shop} has no pickup address yet. Add one for them first." | "Add location" |
| Loading | As the shop's wizard | — | — |
| Partial | As the shop's wizard | — | — |
| Success | Counts and audit note | "Created 32 and updated 8 for {Shop}. Recorded in the activity log." | "View {Shop}'s products" |
| Retryable error | As the shop's wizard | — | — |
| Terminal error | Reason empty on create | "Say why — the shop will read it." | Type a reason |
| Refused | Shop deactivated | "{Shop} is deactivated. Reactivate it to add products." | "Open shop" |
| Stale | As the shop's wizard (Q18) | — | — |
| Long content | Long shop names wrap | — | — |
| Many items | As the shop's wizard | — | — |
| Slow | As the shop's wizard | — | — |
| Phone / tablet / desktop | Admin mostly desktop; same layout rules | — | — |

## State matrix — The workbook and the returned workbook
| State | What the person sees | Copy | One action |
|---|---|---|---|
| First use | Instructions tab open | "1. Fill one tab for each kind of thing. 2. Use the ▼ lists — type only names, prices and numbers. …" | Open a type tab |
| Empty | A tab with only the example row | Example row first cell "EXAMPLE — this row is skipped" | — |
| Loading | n/a — a file | — | — |
| Partial | Returned file: some rows red, some plain | Problems cell: "Price missing · Colour 'Emrald' isn't in the list" | Fix the red cells |
| Success | Returned file re-uploaded clean | — | — |
| Retryable error | n/a — a file | — | — |
| Terminal error | Phone app ignores dropdowns | Help row: "Pick from the list. On a phone app without lists, copy a value from the Lists guide on Instructions." | — |
| Refused — video | A file name in the Video column | Returned cell red, note: "Not a YouTube link: "clip.mp4" — add a video file from the product form after upload" | Paste a YouTube link or clear it |
| Refused | Typed value outside a list in Excel | Excel's own stop: "Pick from the list in this column." | — |
| Stale | Stamp on Instructions | "Made 30 Oct 2026 · version 7. Download a fresh sheet each time — our lists change." | — |
| Long content | Help row wraps; columns sized to their heading | — | — |
| Many items | 300 rows; headings frozen; Problems column frozen | — | — |
| Slow | n/a — a file | — | — |
| Phone / tablet / desktop | Works in Excel and Google Sheets on a laptop; readable in phone apps | — | — |

## Copy deck
| Where | Copy |
|---|---|
| Entry | "Add many at once" · admin "Add many for this shop" |
| Steps | "Get the sheet" · "Fill it" · "Upload" · "Check and create" |
| Get the sheet | "Which things do you sell? Tick them — your sheet gets one tab for each kind." · "Download sheet" · "Last downloaded {date}. Our lists change, so download a fresh sheet each time." |
| After download | "Sheet downloaded. Open it, fill it, then come back here." · "I've filled it" |
| Upload | "Your filled sheet (.xlsx or .csv)" · "Your photos — a folder keeps each product's photos apart" · "Check the sheet" |
| Old sheet | "This sheet is from {date}. Our lists changed since — new rows may miss new choices." · "Continue with this sheet" · "Download a fresh sheet" |
| Too old | "This sheet is too old to read: the '{column}' column has changed." |
| Clean | "All {n} rows look good · {a} new, {b} updates" · "Create {a} · update {b}" |
| Problems | "{n} problems in {r} rows · nothing created yet" · "Download your sheet with problems marked" · "Fix the red cells and upload the same file again." |
| Problem lines | "Not a YouTube link: "{value}" — add a video file from the product form after upload" (Q25) · "Price missing" · "{Column} '{value}' isn't in the list — pick from the dropdown" · "Did you mean '{closest}'?" · "Photo '{name}' wasn't in the photos you picked" · "SKU {code} is used twice — rows {a} and {b}" |
| Done | "{n} products on sale · {a} new, {b} updated" · "View products" |
| Instructions tab | "How to fill this sheet" · five numbered steps · "Orange heading = must fill" · "Photos: write the folder and file, e.g. emerald-abaya/front.jpg" · "Video: a YouTube link only. Add a video file from the product form after upload." · "Made {date} · version {v}" |
| Video column | Heading "Video" · help row "YouTube link only. Add a video file from the product form after upload." (Q25) |
| Admin | "Uploading for {Shop}. The shop will see 'Edited by Bhendi Bazaar team'." · "Why are you uploading for this shop?" |

## Sign-off
Signed off by the owner, 2026-10-30, from the prototype file; the owner asked for video upload to be included (built in the "Photos and video" step) and approved the rest as drawn.
