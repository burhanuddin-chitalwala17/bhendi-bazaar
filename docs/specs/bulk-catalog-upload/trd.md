# TRD — bulk-catalog-upload

- **Status:** Implemented
- **Domain:** catalog
- **Phase:** 6 — Catalogue richness
- **Verified:** 2026-08-23
- **References:** [spec.md](spec.md), [sheet-parsing-options.md](sheet-parsing-options.md), [ADR-0002](../../adr/0002-server-holds-pricing-authority.md), [ADR-0015](../../adr/0015-mobile-first-design.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach

A three-step client wizard over a two-endpoint server: **validate** (dry-run) then
**create**. The sheet goes to the validate endpoint with the list of dropped image
*filenames*; the server parses, runs every row through the same Zod product schema
the single-product form uses, and returns the full error report or a clean bill.
Only after a clean validation does the client upload images to Blob (via the
existing org upload route) and call create with rows plus returned URLs. Ordering
matters: images are never uploaded for a sheet that will be rejected, so failed
attempts leave no orphaned blobs.

## Technical decisions

- D1 — **Parse and validate server-side only.** The sheet is untrusted input like
  any request body (CLAUDE.md Invariant 4); the client's matching preview is UX,
  never authority. Row errors carry `{ row, field, message }`.
- D2 — **exceljs for .xlsx; CSV accepted too.** The free npm SheetJS build is
  abandoned with unfixed CVEs; exceljs is maintained and ~6× lighter on memory,
  which matters inside a Vercel function (see sheet-parsing-options.md).
- D3 — **SKU becomes org-scoped:** `@@unique([orgId, sku])` replaces the global
  unique — a SKU is an org-internal identifier. `[MIGRATION]`. The single-product
  create/update paths (server/catalog/admin.product.repository.ts) also map the
  constraint violation to a DomainError naming the conflicting product, instead
  of today's raw P2002.
- D4 — **Blob paths gain structure:** `products/<org-code>/<identifier>/<original-name>-<ts>.<ext>`,
  identifier = sanitized product name. The existing upload util
  (server/catalog/image-upload.ts) already accepts an identifier; the forms just
  never sent one — that gap closes here (goodbye `unnamed-`). Existing flat blobs
  stay: their URLs are stored and valid.
- D5 — **All-or-nothing as one transaction of `createMany`s, not row-by-row.**
  Product ids are generated server-side before insert, so products, media rows and
  stock rows land as one `createMany` per table — 3–4 statements, sub-second.
  Per-row `create` was rejected: ~1,200 statements over a remote DB breaks Prisma's
  5s interactive-transaction default and flirts with function timeouts at 300 rows.
  A constraint race between validate and create (e.g. a SKU taken meanwhile) fails
  the whole transaction and maps to the same row-error shape. Caps: 300 rows/sheet,
  10 images/product, existing 5MB/image (MAX_IMAGE_BYTES).
- D6 — **Categories are the admin variant of the same core:** shared parse/validate
  module, category row schema; the existing cycle-refusal on the category write path
  is the guard, unchanged. A `parent` cell is normalised with `slugify` — idempotent
  on a slug — so it accepts the parent's name or its slug, and resolves against
  existing categories (by slug *and* by name, since a rename freezes the slug) or a
  row above it. One index serves validate and create, so they cannot disagree about
  which category a cell meant. A key reaching two different categories is refused,
  not resolved by precedence.
- D11 — **Images are identified by relative path, matched by trailing segments.**
  A folder upload carries `webkitRelativePath`; a reference matches a file when it
  is the whole path or a trailing run of whole segments, so the sheet need not know
  which folder the upload was rooted at. More than one match is an error, never a
  choice — silently picking one puts the wrong photograph on the wrong product.
  One pure matcher (server/catalog/bulk/image-match.ts) serves the wizard's preview
  and the server's validation, so the two cannot disagree. `webkitdirectory` is a
  desktop enhancement: the plain multi-file input remains, and is what a phone's
  photo picker uses (ADR-0015 — nothing is removed on mobile).
- D10 — **Bulk images go browser → Blob directly** via @vercel/blob client uploads:
  a route issues short-lived org-scoped upload tokens, the wizard uploads with a
  small concurrency-limited queue and a progress bar. Routing files through our own
  endpoint was rejected: Vercel caps request bodies at 4.5MB — one large photo per
  request — and every byte would transit a function twice for no benefit. The
  existing single-product form keeps its current route.
- D7 — **Sample sheet is generated, not stored** — built per request from the org's
  live locations and current category slugs, so it can never drift from the schema.

- D8 — **Video and cover ride the existing media model.** The `video` column is
parsed to a YOUTUBE `kind`+`ref` ProductMedia row (the parser the product form
already uses); the `cover` column names an image filename, marked `isThumbnail`,
defaulting to the first image — the seed and backfill's rule.
- D9 — **Old-blob cleanup is a separate, gated script** (scripts/, like
upload-images.ts): list Blob under the flat `products/` prefix, keep anything
referenced by any ProductMedia ref or Product.thumbnail, delete the rest. Dry-run
by default; deletion behind an explicit flag, same two-intent pattern as the seed
guard. Runs once per environment, after re-onboarding.
## Packages

- `exceljs` — read/write .xlsx server-side (parse uploads, generate sample sheets).
  Add to docs/DEPENDENCIES.md. No other additions; CSV parsing rides on exceljs.

## UI approach

Phone-first (~360px, single column): step 1 file input for the sheet (native
picker), step 2 multi-select input for images — on phone this is the photo picker;
folder drag-and-drop is the desktop enhancement, not the baseline — step 3 a
single-column match list (row → thumbnail/missing badge) with the confirm action
docked above the tab bar. Desktop widens the match list to a table. Wizard lives
in the org portal under products; admin variant under categories.

## Data model

- `Product`: `@@unique([orgId, sku])` replacing `sku @unique`. `[MIGRATION]`
  (constraint swap only; verify no cross-org SKU collisions exist first — a data
  check inside the migration).

## API / contract changes

New DTOs (validate report, create payload, sample-sheet endpoint) go in
docs/CONTRACTS.md — PR flagged `[CONTRACT]`.

## Test plan

- Unit: row schema (price rupees→paise, server-owned fields rejected), in-sheet SKU
  duplicate detection, location-name matching, error-report shape, filename matcher.
- Unit: video URL → YOUTUBE ref parsing (bad URL = row error), cover-filename
  resolution (named, defaulted, and missing-file cases), cleanup keep-list — a
  referenced blob is never in the delete set.
- Integration (local DB): org-scoped SKU — same SKU in two orgs succeeds, within one
  org refuses; all-or-nothing — one bad row creates zero products; ops budget rows
  for the bulk create (tests/integration/db-ops-budget.test.ts).
- Per docs/TESTING.md layer targets.

## Delivery (PRs)

1. **PR-A** — SKU scope migration + friendly duplicate errors on existing forms.
   Independently valuable; behaviour change is the error message. `[MIGRATION]`
2. **PR-B** — Blob folder structure + forms send the identifier (kills `unnamed-`).
3. **PR-C** — Parse/validate/create core + org product wizard + sample sheet. `[CONTRACT]`
4. **PR-D** — Admin category wizard on the shared core.
5. **PR-E** — Referenced-aware flat-blob cleanup script (dry-run default). Runs on demand, not on deploy.

## Open questions

None — caps confirmed (300 rows / 10 images / 5MB, 2026-08-21) and the flags column
was rejected: hero/featured placement is merchandising, curated in admin, not data entry.
