# Spec — own-store/bulk-sheet

- **Summary:** A shop lists many products from one Excel sheet that explains itself, offers every platform value as a dropdown, says when it is out of date, and comes back with the shop's own mistakes marked in place
- **Status:** Accepted
- **Domain:** catalog (bulk), with listing (vocabulary) and shared (audit)
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-10-30
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [own-store](../spec.md) (Q10, Q11, Q17, Q24), [product-form](../product-form/) (sibling), [bulk-catalog-upload](../../bulk-catalog-upload/), [ADR-0021](../../../adr/0021-audit-trail-never-fails-the-action.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
Vertical 4 of own-store. The bulk template becomes a workbook a shopkeeper can fill without help:
an instructions tab, one tab per product type the shop ticked, a dropdown for every value the
platform defines, and a stamp saying when it was made. A sheet with mistakes comes back as the
shop's own file with each bad cell marked and a Problems column. The admin can upload for a shop.

## Why
A shop with a hundred items already keeps them in a spreadsheet. Today's template asks for
category slugs and type keys typed by hand, has no dropdown for category, type, kind, family or
brand, carries no version, and reports errors as a list on screen ("Row 14 · kind: …") that the
seller must match back to the file. Every typo is a round trip. The owner asked that the sheet
carry its own instructions, every platform value as a dropdown, and always recommend a fresh copy.

## Hazards this feature must close
- **Stale sheet.** A sheet downloaded before a type, value or category changed reads wrong or not
  at all; today nothing tells the seller it is old (own-store Q10).
- **Pasted values.** Pasting into a cell bypasses its dropdown; every value is still checked on upload.
- **Look-alike names.** Two categories can share a name under different parents ("Rings").
- **Renamed headings.** A seller who edits a heading must not break the sheet.
- **Example rows.** Example rows uploaded unchanged must never become products.
- **Lost formatting.** The returned file must keep everything the seller wrote, untouched, except
  the marks we add.
- **Phone spreadsheets.** Some phone apps ignore dropdowns; the sheet must still read and the
  instructions must still say what to type.
- **Help on record.** An admin upload for a shop must be traceable like a form edit (own-store Q17).

## Requirements
- **R1** — The download page asks which categories the shop sells, grouped by product type, and
  returns one file with an Instructions tab first and one tab per type (own-store Q11).
- **R2** — Every platform-defined value is a dropdown showing the words a person reads: category
  (as a path), kind, family, brand, every answer, yes/no. Lists live on a hidden tab.
- **R3** — Each tab marks required columns, carries one help line under each heading, and starts
  with one example row the upload ignores.
- **R4** — Every file carries its date and a version. The download page always recommends a fresh
  sheet. On upload, an older version that still reads is warned and accepted; one whose columns no
  longer read is refused with a link to a fresh sheet (own-store Q10).
- **R5** — Values are checked on upload whatever the dropdowns allowed; typed words match their
  listed value ignoring case and spacing.
- **R6** — A sheet with problems comes back as the shop's own file: a Problems column first on
  each tab, each bad cell filled red with a note, rows without problems left plain. Uploading that
  same file again works.
- **R7** — The screen shows the problems too, grouped by row, in plain words, with a count.
- **R8** — A row whose SKU matches a product updates it; its sale price is saved as the form saves
  it (own-store Q24). The check screen says how many rows create and how many update.
- **R9** — The platform admin can download for and upload for a shop, with a banner and a reason;
  each upload is recorded once with its counts, and every product it touched shows "Edited by
  Bhendi Bazaar team" (own-store Q17, product-form R12).
- **R10** — No button is disabled; an action that cannot run says why on tap.
- **R11** — The Video column takes a YouTube link only, as the sheet does today
  (`server/catalog/bulk/sheet-columns.ts`, `bulk-product.service.ts` writes a `YOUTUBE` row).
  A video file is added from the product form afterwards (product-form R14). The help row, the
  Instructions tab and the returned file all say so.

## Product acceptance
Judged on a phone (~360px) first; the sheet itself in Excel and Google Sheets.
- **A1** — A shop ticks Abayas and Attar; the file has Instructions, Abaya and Attar tabs; Abaya's
  Fabric column offers only fabrics; Attar's tab has no Fabric column.
- **A2** — Category, kind, family, brand and every answer column open a dropdown in Excel and in
  Google Sheets on a laptop.
- **A3** — A sheet from before a colour was added uploads with "This sheet is from 12 Oct" and
  "Download a fresh sheet"; one from before a column was renamed is refused saying which column.
- **A4** — A sheet with "Emrald" in Colour and no price on row 7 comes back with those two cells
  red, row 7's Problems cell reading "Price missing · Colour 'Emrald' isn't in the list — pick from
  the dropdown"; fixing them and uploading the same file creates the products.
- **A5** — The example row, left in, creates nothing.
- **A6** — An admin uploads 40 rows for a shop with a reason; one audit entry names 40, and each
  product reads "Edited by Bhendi Bazaar team".
- **A7** — A seller who ticks categories, fills ten rows and uploads gets them on sale in under
  fifteen minutes, timed with the owner's father.
- **A8** — A row whose Video cell holds "clip.mp4" comes back with that cell red and the Problems
  cell reading "Not a YouTube link: "clip.mp4" — add a video file from the product form after
  upload"; a youtu.be link in the same cell creates the product with the video.

## Scope
- **Outcome:** a shop fills a self-explaining sheet and gets its mistakes back in its own file.
- **In:**
  1. Download page with category ticks; Instructions tab; one tab per type; example row — R1, R3, A1, A5.
     The Video column's YouTube-only help, instruction and problem line — R11, A8.
  2. Dropdowns for every platform value on a hidden lists tab; label matching — R2, R5, A2.
  3. Version stamp; fresh-sheet nudge; old-sheet warning and refusal — R4, A3.
  4. Problems returned in the shop's file and on screen; create and update counts — R6–R8, A4, A7.
  5. Admin download and upload for a shop, recorded — R9, A6.
- **Later:** a sheet prefilled with the shop's current products (Q20) · photos by link instead of
  upload (Q21) · video files in the sheet (Q26) · Hindi instructions (Q22) · Google Sheets add-on (Q23) · scheduled re-uploads (Q24).

## Open questions
None — Q19 is decided.
