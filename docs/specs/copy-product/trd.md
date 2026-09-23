# TRD — copy-product

- **Status:** Implemented — PR-123
- **Domain:** catalog
- **Phase:** 6 — Catalogue richness
- **Verified:** 2026-09-23
- **References:** [spec.md](spec.md), [ADR-0012](../../adr/0012-modules-are-vertical-slices-by-domain.md), [ADR-0029](../../adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md), [ADR-0031](../../adr/0031-one-components-home-organised-by-domain.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Copy is a **read that seeds a form**, not a write. The new-product page accepts `?copyFrom=<productId>`, reads the source on the server, and passes its descriptive fields to the existing create form as defaults. Submitting goes through the unchanged create path, so validation, pricing and ownership are enforced exactly as for a blank product.

## Technical decisions
- D1 — **Server-read through a query param, no route handler.** Both entry points (row menu, header picker) navigate to `/org/<orgId>/products/new?copyFrom=<id>`. The page is a server component and already reads through the DAL (`src/app/(org)/org/[orgId]/products/new/page.tsx`). A client fetch would buy a round trip and a new endpoint to guard for data the server already has.
- D2 — **Ownership is checked in the service, reported as not-found.** `productsService.getCopySource` goes through the existing `ownedByOrg` (`server/catalog/admin.product.service.ts`), so another org's id cannot be distinguished from a missing one. The DAL turns not-found into `null` and the page renders a blank form. `copyFrom` is caller-controlled, and a stale link should not be an error page.
- D3 — **Picker lists the available shelf only, via one new repository read.** `listCopyOptions` selects `id`, `name`, `sku` for the org with `AVAILABLE` spread (ADR-0029), ordered by name. It is registered in the product-visibility census. The row menu can still copy an archived product, because the org can see it on its Archived shelf.
- D4 — **The copied shape is a type, not a convention.** `ProductCopySource` (`server/catalog/admin.product.types.ts`) is a `Pick` of `ProductFormInput`, so a field is copied only if it is named there (spec R2).
- D5 — **The form is keyed on the source, and draft persistence steps aside while copying.** Form defaults are read once, so `ProductForm` is keyed on the source id to remount when the pick changes. `useFormPersist` restores a localStorage draft on mount, which would overwrite the copied fields, so persistence and its clearing are disabled for a copy. A blank-form draft therefore survives an abandoned copy (A5).
- D6 — **A dropdown-menu primitive.** `src/components/ui/dropdown-menu.tsx` wraps Radix. Destructive styling is an item `variant`, not a className (ADR-0031). Items are `min-h-10` and content carries `max-h-overlay overflow-y-auto` (ADR-0015). The row's delete confirmation remains a `Dialog`, opened from a non-modal menu so the menu's pointer-events lock cannot outlive the hand-off.

## Packages
`@radix-ui/react-dropdown-menu`. Keyboard navigation, typeahead, focus return and collision-aware positioning are what a hand-rolled menu gets wrong. It belongs to the Radix family already behind `dialog`, `separator`, `slot` and `switch`. See [DEPENDENCIES.md](../../DEPENDENCIES.md).

## UI approach
Phone first. The product table's actions column is a single ⋯ icon button opening a right-aligned menu: View, Edit, Copy product, Archive/Restore, separator, Delete… (destructive). The platform's read-only list keeps its lone View link. On the new-product page, "Copy from product" sits in `PageHeader`'s actions slot and wraps below the title at 360px. Its menu lists the org's products (name, SKU), plus "Start blank instead" while copying. A copied form shows an info banner naming the source and what is left to fill.

## Data model
None.

## API / contract changes
None. No route handler or DTO in CONTRACTS.md changes. The create request is unchanged.

## Test plan
`tests/unit/product-copy.test.ts` covers the copied field set, not-found for another org's or an unknown id, the DAL's blank-form fallback, and picker scoping. `tests/unit/product-visibility.test.ts` census covers the new read.

## Delivery (PRs)
One PR (PR-123). It is behaviour-changing, and only on the org portal.

## Open questions
None.
