# Spec — category tree

- **Status:** ✅ Implemented (PR-42)
- **Domain:** catalog
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-10
- **Depends on:** —
- **References:** [trd.md](trd.md), [../spec.md](../spec.md), [../data-model.md](../data-model.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is
Categories nest to any depth, and the taxonomy belongs to the platform.

## Why it is separate
Adds a self-referencing parent and drops the two-level subcategory idea. The many-to-many originally drawn was product flags in disguise; `ProductFlag` already covers those.

## Requirements
- **R1** — A category may sit under another, to any depth, without a schema change per level.
- **R2** — A category page lists products in that category and in everything beneath it.
- **R3** — A category cannot become its own ancestor.
- **R4** — A category holding products or child categories cannot be deleted.
- **R5** — Only platform owners create or edit categories.

## Product acceptance
- A1 — Creating or editing a category offers a parent selector; the choices exclude the category itself and everything beneath it, and the server refuses a cycle regardless.
- A2 — A product filed under a subcategory appears on the parent category's page.
- A3 — Deleting a category with products or subcategories is refused with a message naming the count; the database refuses it even if the message is bypassed.

## Out of scope (this feature)
- Breadcrumbs, nested URLs, and which levels the home page strip shows — merchandising and chrome, not data model ([trd.md](trd.md) D4, D6).
- Org-facing category writes — the taxonomy stays platform-owned.
