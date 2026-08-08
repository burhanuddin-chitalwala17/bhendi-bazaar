# TRD — category tree

- **Status:** ✅ Implemented (PR-42)
- **Domain:** catalog
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-10
- **References:** [spec.md](spec.md), [../data-model.md](../data-model.md), [ADR-0007](../../../adr/0007-conditional-stock-decrement.md), [CONTRACTS.md](../../../CONTRACTS.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
One nullable `parentId` on `Category`, self-referencing. Depth becomes unbounded with no
schema change per level, and the two rules Postgres cannot express declaratively — no
cycles, and pages that show a whole subtree — live in one pure module so every branch is
a unit test. Decisions were taken in the data-model sessions (2026-08-08); this records
them against code.

## Technical decisions
- **D1 — Subtree reads are computed in application code**: load `(id, parentId)` for all categories, collect descendant ids, query `categoryId: { in: [...] }`. Chosen over a materialised path (duplicates what `parentId` says; moves rewrite descendants) and a recursive CTE (raw SQL — the codebase has none, a property worth keeping, per inventory-reservation D1). The category table is tens of rows and cacheable; revisit only with evidence.
- **D2 — Cycle prevention is an ancestor walk on the write path**, raised as a `DomainError` on the `parentId` field so it lands inline (ADR-0013). Self-parenting is the one-step case of the same rule. The database cannot forbid A→B→A declaratively; the walk runs against the same handful of rows D1 already loads.
- **D3 — Deletion is refused by the database, not only the service.** `Category.parentId` gets `onDelete: Restrict`, and `Product.categoryId` moves from **`Cascade` to `Restrict`** — the cascade flagged since the data-model review, where deleting a category would have deleted its products and only an application-level count stood in the way. The service keeps its friendlier pre-check messages; the constraint is the guarantee.
- **D4 — Slugs stay flat and unique.** `/category/ridas` keeps working; nesting URLs would 404 every existing link for hierarchy the breadcrumb can show instead (breadcrumbs themselves: not this PR). `order` now means order among siblings.
- **D5 — The taxonomy stays platform-owned** (programme decision 2026-08-08): category routes remain under `/api/admin`, and nothing org-facing gains a write.
- **D6 — The storefront's category strip is unchanged for now** — it lists all categories flat. Which levels the home page shows is a merchandising question, not a data-model one; the subtree behaviour this PR adds is on the category *page*.

## Packages
None.

## Data model
**[MIGRATION]** — additive column + two constraint changes: `Category.parentId` (nullable, self-FK, `Restrict`), and `Product_categoryId_fkey` recreated with `ON DELETE RESTRICT`. No data movement; every existing category becomes a root.

## API / contract changes
`categoryFormSchema` gains optional `parentId` (admin-only, single route — documented by its schema per CONTRACTS.md's own criteria). No storefront shape changes: the category page simply lists more products.

## Test plan
- The tree module at 100%: descendants (deep chains, siblings, empty), cycle detection (self, direct, transitive), unknown ids.
- Schema: `parentId` optional, nullable to clear.
- Deletion restricted with children/products is database behaviour — covered by the constraint's presence in the migration (pinned by test) per TESTING.md's recorded gap.

## Delivery (PRs)
One PR — the column is inert without the guards, and the guards are untestable without the column.

## Open questions
None; all decided 2026-08-08 and recorded in [../data-model.md](../data-model.md).
