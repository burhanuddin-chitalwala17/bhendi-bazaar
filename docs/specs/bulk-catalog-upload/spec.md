# Spec — bulk-catalog-upload

- **Status:** Implemented
- **Domain:** catalog
- **Phase:** 6 — Catalogue richness
- **Verified:** 2026-08-21
- **References:** [trd.md](trd.md), [sheet-parsing-options.md](sheet-parsing-options.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0017](../../adr/0017-video-is-embedded-not-hosted.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

An org owner sets up their catalogue by uploading one spreadsheet plus the product
photos from their machine, instead of creating products one form at a time. Admins
get the same for categories.

## Why

Onboarding an org today means one form per product — untenable for a shop with a
hundred items, and the practical blocker to re-onboarding the store onto a fresh
database. A shopkeeper already has their catalogue in a spreadsheet; the store
should accept it as it is.

## Requirements

- R1 — An org member uploads a spreadsheet of products and, in the same flow, the
image files those rows name. Nothing is created until both parts are present and valid.
- R2 — A row names its images by filename, or by folder-and-filename when a folder
was uploaded — two products may each own a `front.jpg`, and a reference that could
mean either is a row error naming the candidates, never a guess. The flow shows
which rows matched which files before anything is created.
- R3 — Import is all-or-nothing: one invalid row rejects the sheet, and the user
gets every problem at once — row number, field, and what to change, in plain language.
- R4 — A SKU identifies a product *within its organisation*. Two orgs may use the
same SKU; one org may not. Duplicates in the sheet and against the org's existing
products are row errors naming the conflicting product. (Uniqueness is
platform-wide today; this feature corrects the scope.)
- R5 — Stock is given per pickup location, one column per location, matched to the
org's locations by name. Locations are created first, on the org's locations page —
a location is an address a courier collects from, not a name a column header can
invent — and the sheet only references them: an unknown location name is a row
error, exactly as an unknown category is.
- R6 — Each row's category must already exist; unknown categories are row errors.
- R7 — A sample sheet is downloadable, generated for the org: its real location
columns, current category slugs, and example rows.
- R8 — Server-owned fields (slug, rating, review counts) are never read from the
sheet, matching every other write path.
- R9 — Admins bulk-create categories the same way: sheet plus hero images, parent
by slug, same all-or-nothing contract.
- R10 — Uploads have stated caps (rows per sheet, images per product, file sizes),
and the error for exceeding one says what the cap is.

- R11 — A row may carry a video as a YouTube URL, stored as an embedded reference
([ADR-0017](../../adr/0017-video-is-embedded-not-hosted.md)) — never uploaded. An
unrecognisable URL is a row error.
- R12 — A row may name which of its images is the cover; unnamed, the first image is
the cover — the same rule every existing surface applies.
- R13 — Once the catalogue is re-onboarded through this feature, a deliberate,
separately-triggered cleanup deletes old flat-layout product images from Blob — only
files no product references, so a live page can never lose its picture.
## Product acceptance

- A1 — An org owner with a 50-product sheet and a folder of photos gets from zero
to a live catalogue in one sitting, without a support conversation.
- A2 — A sheet with three different mistakes yields one report naming all three;
fixing them and re-uploading succeeds; nothing partial was created in between.
- A3 — On a phone (~360px), the flow still works end to end: the sheet and images
arrive via the native file picker, matching status is readable single-column,
and the confirm action is reachable ([ADR-0015](../../adr/0015-mobile-first-design.md)).
- A4 — The sample sheet opens in Excel, is understandable without documentation,
and re-uploads successfully with only its example values changed.

## Out of scope (this feature)

- Updating existing products via sheet (create-only; editing stays on the form).
- Product flags (HERO/FEATURED) as sheet columns — merchandising stays admin-curated.
- Creating pickup locations from the sheet (the locations page owns that — R5).
- Moving referenced old blobs into the new layout (R13 deletes the unreferenced;
anything still referenced keeps its URL and stays where it is).
