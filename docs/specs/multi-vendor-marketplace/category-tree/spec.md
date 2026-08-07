# Spec — category tree

- **Status:** Not drafted — scope agreed, requirements provisional, no TRD yet
- **Domain:** catalog
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-08
- **Depends on:** —
- **References:** [../spec.md](../spec.md), [../data-model.md](../data-model.md)

> Requirements and product approach only. A `trd.md` is written when this subfeature is picked up.

## What this feature is
Categories nest to any depth, and the taxonomy belongs to the platform.

## Why it is separate
Adds a self-referencing parent and drops the two-level subcategory idea. The many-to-many originally drawn was product flags in disguise; `ProductFlag` already covers those.

## Requirements (provisional)
- **R1** — A category may sit under another, to any depth, without a schema change per level.
- **R2** — A category page lists products in that category and in everything beneath it.
- **R3** — A category cannot become its own ancestor.
- **R4** — A category holding products or child categories cannot be deleted.
- **R5** — Only platform owners create or edit categories.
