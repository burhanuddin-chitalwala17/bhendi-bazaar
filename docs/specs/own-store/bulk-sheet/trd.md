# TRD — own-store/bulk-sheet

- **Status:** Accepted — 2026-10-30 (UX signed off 2026-10-30; Q19 decided by the owner) · U1, U2, U3 built 2026-11-01
- **Domain:** catalog (bulk), with listing (vocabulary) and shared (audit)
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-11-01
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), [own-store](../decisions.md) (Q10, Q11, Q17, Q24), [product-form](../product-form/trd.md), [bulk-catalog-upload](../../bulk-catalog-upload/trd.md), [ADR-0003](../../../adr/0003-one-repository-per-aggregate.md), [ADR-0013](../../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0021](../../../adr/0021-audit-trail-never-fails-the-action.md), [ADR-0029](../../../adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md), [ADR-0046](../../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md), [ADR-0048](../../../adr/0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md), [ADR-0052](../../../adr/0052-a-product-type-is-a-row-that-selects-from-facts-declared-in-code.md), [ADR-0055](../../../adr/0055-an-admin-surface-reads-through-projections-and-writes-through-the-aggregates-one-repository.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach
The validate-then-create pipeline of [bulk-catalog-upload](../../bulk-catalog-upload/trd.md) stays:
server-side parse, every row through the same checks, images uploaded only after a clean check,
one all-or-nothing transaction (D5 there; own-store Q19 here). What changes is the workbook at
both ends. The generator (`server/catalog/bulk/sample-sheet.ts`) writes an Instructions tab, a tab
per type and a stamped hidden Lists tab; a new reader reads every tab by a hidden key row; and a
new marker writes problems back into the seller's own file. The admin reaches the same pipeline
for a shop through admin routes.

## Prior art
- **Amazon category templates**: instructions tab first, a hidden valid-values tab feeding
  dropdowns, a template version that rejects outdated files, and a processing report that returns
  the seller's rows with an error column. Followed, except the error column goes first (Q11) and an
  outdated file is warned, not refused, while its columns still read (own-store Q10).
- **Flipkart and Meesho** publish one sheet per category; rejected for one file of tabs (Q3).
- **Machine keys under human headings** is the norm for round-tripped templates (Salesforce Data
  Loader field names, Shopify's fixed handles); followed with a hidden row (Q5).
- **Round-trip fidelity.** exceljs keeps values, styles, validations, notes and panes, and drops
  charts, pivots and embedded images, which a product sheet does not carry.

## Technical decisions
- **D1 — Download by ticked category (R1; Q2, Q3).** The sample route takes category ids instead
  of type keys; tabs are the distinct types of the ticked categories, named by the type's label,
  plus "Other" for a ticked category with no type. Each tab's category dropdown offers only its
  type's ticked categories. The page prefills ticks from `listCategoriesSoldBy`
  (`server/catalog/admin.product.service.ts`).
- **D2 — Tab layout (R3; Q4, Q5, Q9, Q11).** Row 1 headings (required ones orange), row 2 the
  hidden key row, row 3 the help line, row 4 the greyed example whose first data cell reads
  "EXAMPLE — this row is skipped". Column A is "Problems", empty on download, so the returned file
  never has to insert a column. Headings, keys and Problems are frozen. The Video help line and the
  Instructions step carry Q25's wording (R11).
- **D3 — Dropdowns show words (R2; Q6, Q7).** Every list (category paths "Women › Abayas", kinds,
  families, brands, each fact's answers, yes/no) is written down the hidden Lists tab and
  referenced by range, as today's veryHidden lookup tab already does. Family allows any value with
  a warning; the rest stop. Instructions carries a visible lists guide for phone apps that ignore
  validation.
- **D4 — Stamp and age (R4; Q10, Q18, Q27).** The Lists tab holds the made-on date and a
  fingerprint: SHA-256 over each tab's column keys and every list's values. The shown version is
  its first six characters (Q27). On upload: same fingerprint, silent; different but every key
  still known and every required column present, accepted with the old-sheet banner; a key no
  longer known or a required one missing, refused naming its heading. Identical for admin uploads.
- **D5 — Reading (R5; Q8, Q13, Q15, Q28).** A new reader beside `server/catalog/bulk/sheet.ts`
  reads every visible tab with a key row, skips the example and the Problems column, and keeps
  each cell's tab and address. A stamp-less .xlsx or a .csv is read by heading text, as today;
  an unstamped .xlsx is warned with its own creation date (Q28). The 300-row cap counts all tabs.
- **D6 — Matching words (R5; Q6, Q8).** Typed values match a label or key after case, spaces and
  punctuation are removed. A category matches a full path or a slug, never a bare name, so
  look-alike names cannot collide. A miss names the closest listed value by edit distance, a small
  pure function (no package). Matching lives in `server/catalog/bulk/bulk-vocabulary.ts`.
- **D7 — Problems in the file (R6; Q11, Q12, Q30).** A new marker route takes the same file
  again, re-runs the whole check (a client never supplies errors), and answers the seller's
  workbook with each problem cell filled red with a note and its row's Problems cell filled.
  Nothing else is written. A .csv comes back as an .xlsx of its own cells. Re-uploading it works,
  because Problems is ignored and the fills are formatting.
- **D8 — Problems on screen and counts (R7, R8).** The validate answer gains each problem's tab
  and heading, the create and update counts from `planProductRows`
  (`server/catalog/bulk/bulk-product.service.ts`), and the sheet's age. Lines are grouped by row,
  20 then "Show all", filterable by column.
- **D9 — All-or-nothing, unchanged (Q19).** Nothing is created while any problem stands; create
  re-validates in full and runs `importBulk` in one transaction. A sale price is written through
  `promotionService.setProductMarkdown` as today (own-store Q24).
- **D10 — Edits through the version (R8, R9).** `importBulk` in `server/catalog/product.repository.ts`
  sets product-form D6–D7's columns on every created or updated product: bumps `version`, sets
  the editor and time, and sets or clears `teamEditedAt`. An updating row is a whole-row replace,
  so a form open on it is refused on save and rebases (product-form D8).
- **D11 — Admin for a shop (R9; Q17, Q18).** Admin twins of sample, validate, marker and create
  under the admin org path, behind `requirePlatformAdmin` (`src/lib/admin-auth.ts`), scoped to the
  path's org, with uploads through product-form D12's org-scoped admin token. Create requires a
  one-line reason and refuses a blocked shop with ux.md's copy. After commit one
  `recordAdminAction` entry (`server/shared/audit/audit.service.ts`) holds the shop, reason, file
  name, counts and product ids; a failed record never fails the import (ADR-0021).
- **D12 — "Last downloaded" (R4; Q29).** Kept per shop in the device's storage, read safely; a
  missing value shows the first-use copy. A nudge needs no server state.

## Hazards
| Hazard | Answer |
|---|---|
| Stale sheet | Answered by D4 |
| Pasted values | Answered by D5, D6 |
| Look-alike names | Answered by D3, D6 |
| Renamed headings | Answered by D2, D4 |
| Example rows | Answered by D2, D5 |
| Lost formatting | Answered by D2, D7 |
| Phone spreadsheets | Answered by D3 |
| Help on record | Answered by D10, D11 |

## Packages
None. exceljs is already present ([DEPENDENCIES.md](../../../DEPENDENCIES.md)).

## UI approach
Screens, states and copy are [ux.md](ux.md)'s; the wizard is `src/components/bulk-upload/BulkProductWizard.tsx`, restepped.
- **Phone:** four steps (Q16); ticks in one column by type with search; action sticky above the
  tab bar; problems listed by row. **`md:`** two columns of ticks; problems as a table.
  **`lg:`** a preview of the tabs beside the ticks.
- **Rendering:** the bulk pages stay server components reading categories, types and locations
  through the data-access layer; the wizard is the client leaf.
- **Behaviour:** every call through `bulkImportApiClient.ts`, which gains the marker download and
  an admin-for-shop base; state in `useBulkImport.ts` (both in `src/components/bulk-upload/`).
- **Surfaces:** banners and inline lists only; no overlay, no new token.

## Gates touched
`route-reachability`/`portal-boundary` — one org route (marker) and four admin routes.
`rate-limit-registry` — untouched; all new routes are under `/api/org` or `/api/admin`.
`one-repository` — `importBulk` stays the only bulk writer. `file-cohesion` — the bulk files reach
listing and promotions as today, plus shared. `db-ops-budget` — create stays within its rows.

## Data model
None of its own. D10 uses product-form U4's columns.

## API / contract changes
[CONTRACT] U1: sample takes `categories` instead of `types`. U3: `RowError` gains `tab` and
`column`; validate answers `plan` and `sheet` (made-on, version, stale, refused column). U4: the
marker route. U5: the admin routes and create's `reason`. [CONTRACTS.md](../../../CONTRACTS.md)
moves in each.

## Test plan
Per [TESTING.md](../../../TESTING.md); each new guard is mutation-tested and recorded.
- **Unit:** tabs per ticked type, no Fabric on Attar (A1); every list column has a validation
  (A2); fingerprint same, lists changed and column renamed (A3); the example is skipped (A5);
  word matching and closest value; path versus look-alike names; Video help and A8's message.
- **Round trip:** an Excel and a Google Sheets file come back with only fills, notes and Problems
  changed, and re-upload clean once fixed (A4).
- **Integration (local DB):** one bad row creates nothing (Q19); an admin upload of 40 leaves one
  audit entry and 40 products with `teamEditedAt` (A6); a failing audit write still imports;
  an updated product's version moves.
- **Acceptance:** A7 timed with the owner's father and recorded.

## Delivery (PRs)
| Unit | Closes | Migrates | Contract |
|---|---|---|---|
| U1 Download page, Instructions, tab per type, example, Video help | R1, R3, R11, A1, A5, A8; D1, D2, D12 | no | yes |
| U2 Dropdowns on Lists, word matching | R2, R5, A2; D3, D5, D6 | no | no |
| U3 Stamp, fresh-sheet nudge, old-sheet warning and refusal, counts | R4, R7, R8, A3; D4, D8 | no | yes |
| U4 Problems in the shop's file | R6, A4, A7; D7, D9 | no | yes |
| U5 Admin download and upload for a shop, audited | R9, A6; D10, D11 | no | yes |

Every unit changes behaviour. U5 follows product-form U4 and U5.
U1 took D5's key-row read of the type tabs (example and Problems skipped) because A5 cannot hold
without it; U2 keeps the rest of D5 (cell addresses, the unstamped warning) and D3's Lists tab.
U1 hands U3: rows carry `tab` and are keyed by index, and create receives each row's `rowNumber`/`tab`;
U3 puts `tab` into every `RowError` and message (a duplicate SKU on two tabs now reads "rows 5 and 5").
U2 put the pure matching in `server/catalog/bulk/word-match.ts` (and the category path matcher in
`sheet-tabs.ts`) so it is unit-testable without the database; `bulk-vocabulary.ts` applies it. A
Brand column appears only for a shop with brands; a row's brand is written as `brandId` only when
the sheet has that column, so an update from an older sheet keeps the product's brand. The
reader keeps each cell's address and the file's creation date (`RawSheet.createdOn`); U3 shows the
unstamped warning from it, with the rest of the validate answer's `sheet`.
U3 judges in `server/catalog/bulk/sheet-stamp.ts` (pure) through `bulkSheetService.judgeUpload`, which
U5's admin validate calls unchanged (Q18); the stamp also carries the ticked ids, so today's sheet is
rebuilt for the same ticks. A sheet with no stamp date and no creation date is warned without a date.
The marker download and "Fix the red cells…" line stay with U4.

## Open questions
None. Q27–Q30 are Claude · reversible.
