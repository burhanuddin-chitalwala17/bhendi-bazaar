# TRD — product-archive

- **Status:** Implemented — PR-113
- **Domain:** catalog (enforcement point in checkout; figures in analytics)
- **Phase:** 6 — Catalogue richness
- **Verified:** 2026-09-16
- **References:** [spec.md](spec.md), [ADR-0029](../../adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md), [ADR-0023](../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md), [ADR-0020](../../adr/0020-money-bearing-records-never-cascade.md), [ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md), CHANGELOG PR-112

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

One nullable timestamp on `Product` says when it left sale, one exported `where` fragment is how every buyer-facing query asks about it, and one assertion inside the order transaction is what actually stops a purchase. The read filter is for tidiness; the assertion is the control.

This is the complement of [ADR-0023](../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md), not a departure from it. Bidding suspension is derived because a clock decides it. Nothing about a clock decides whether an org wants a product off sale, so that fact is stored — which is precisely what that ADR says a status column is for.

## Technical decisions

- **D1 — `archivedAt DateTime?` on `Product`, not a status enum.** A nullable timestamp answers both "is it archived" and "since when" in one column, and there is no third lifecycle state to model; a `ProductStatus` enum would invent `DRAFT` to look complete and nothing would set it (YAGNI). Indexed together with `orgId`, because the org portal's default list is "this org, not archived" and that is the one query this feature adds to a hot path.
- **D2 — Visibility is one exported fragment, `AVAILABLE`, in `server/catalog/product.visibility.ts`, kept free of Prisma.** The query it implies lives on `ProductsRepository` and the refusal in `server/catalog/product.sale-gate.ts` — the three-part split bidding already uses (pure rules, repository query, gate), so nothing but a repository reads the aggregate (Invariant 5). Every buyer-facing query spreads it rather than writing `archivedAt: null` itself, so the rule has one definition (the reasoning behind Invariant 5 and the `ProductFlag` drift). Reads that must *keep* seeing archived products — order history, shipments, payouts, historical revenue — simply do not spread it, and that omission is deliberate rather than forgotten because of D3.
- **D3 — A test enumerates the buyer-facing query sites and fails when one does not spread the fragment.** Roughly thirty `prisma.product` call sites exist across ten files; a rule remembered at thirty places is missed at one. `tests/unit/design-tokens.test.ts` and `tests/unit/vocabulary.test.ts` already hold conventions this way by scanning source, so the pattern is established rather than invented here.
- **D4 — Enforcement is `assertNotArchived(productIds, tx)` inside the order transaction**, placed beside the existing `assertNotUnderBidding` call in `server/checkout/order.service.ts:378`, which is the same problem with the same answer. Outside a transaction any check is stale before the row is written; inside it, a throw abandons the write, which is every caller's correct response.
- **D5 — The gate is at order creation only, and an existing order survives a later archiving.** An order is created `pending_payment` and paid afterwards, so a archiving that lands mid-checkout either precedes the transaction (refused, buyer not charged) or follows it (the order stands and can be paid). Refusing at payment instead would leave a buyer charged for an order the store then declined — the one outcome that must not happen, and the reason the gate sits where the stock guard does.
- **D6 — A cart keeps the line; `check-stock` reports it unavailable.** `src/app/api/products/check-stock/route.ts` already answers `available: false` per item and the cart already renders that state, so archiving reuses the unavailability path instead of adding one. Filtering the line out of the cart read was rejected: archiving is reversible and a removed line cannot come back, which would break R6.
- **D7 — The product page 404s through the existing `NotFoundError`.** `getProductBySlug` spreads `AVAILABLE`, so an archived slug resolves to nothing and the page behaves exactly as an unknown slug does. `slug` stays `@unique` across archived rows, so the address is reserved for the restore; no separate reservation mechanism is needed, and `slugCandidates` already resolves a new product's name collision by suffixing.
- **D8 — The SKU clash is where the reserved-row surprise actually lands.** `@@unique([orgId, sku])` means an org re-listing an archived product's SKU gets a duplicate error naming a product it cannot see. On that violation the create path checks whether the holder is archived and says so, rather than reporting a mysterious duplicate.
- **D9 — Two controls, because R1 and R8 are different requirements.** Archive and restore are explicit actions on `PATCH /api/org/[orgId]/products/[id]/archive`, usable on any product including one never sold. `DELETE` keeps its own meaning and **refuses** rather than degrading: never ordered, promoted or bid on → hard delete; otherwise → a `ConflictError` naming what holds it and pointing at Archive. It degraded to an archive until PR-115, which was defensible only while Archive had no control of its own — one button doing two jobs meant its label was wrong for whichever one it did. Delete now sits behind the row's overflow dialog, since it is the only irreversible action on the row.
- **D10 — A live bidding event refuses the archive, checked inside the write and behind the stock lock.** Asked through `lockedAmong` in `server/bidding/bidding-lock.ts` rather than a second reading of the event table, and passed into the archive transaction as a guard: opening an event takes the same stock lock archiving does, so a check made before the transaction is a read-then-write whose answer can go stale in the gap (Invariant 6). Cancelling the event is the org's own separate act, deliberately not chained to this one.
- **D11 — Archive and restore are audited with `recordAdminActionIn(tx, …)`** ([ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md)), inside the same transaction as the write, since the trail should not record a archiving that rolled back. Product create and update remain unaudited; that is a pre-existing gap, and widening it is not this feature's job.
- **D12 — Analytics excludes archived stock from current inventory, and keeps it in history.** `productStockRows` in `server/analytics/widgets.ts` and the inventory read in `server/analytics/dashboard.repository.ts` spread `AVAILABLE`: stock you cannot sell is not sellable inventory, and a low-stock alert on an archived product is noise. Revenue and order aggregates are untouched — they are about what happened, and forgetting a product existed would falsify them.
- **D13 — The promotion picker excludes archived products; existing target rows are left alone.** `listForPicker` spreads the fragment, `listByIds` does not, so an offer that already names an archived product still renders its own selection instead of silently dropping it. No price is resolved for it regardless, because every price path reads through a query that filters.

## Packages

None.

## UI approach

Base (~360px) first, per [ADR-0015](../../adr/0015-mobile-first-design.md). In the org product list each row's overflow menu gains **Archive**; an archived row renders at reduced emphasis with a token-styled *Archived* badge beside its name and offers **Restore** in place of Archive. The list's existing filter bar gains a status control — *Available* (default) / *Archived* / *All* — as another single-column select at base, joining the row of filters at `sm:` and up. Archive acts directly — it is reversible, so a confirmation would be ceremony. Delete sits behind the row's overflow (`…`) button, which opens a `Dialog` explaining that deletion is permanent, only possible for a product nothing refers to, and that Archive is the reversible alternative; that dialog *is* the confirmation, which is why no `confirm()` remains on the path. A dialog rather than a dropdown because `Dialog` is already a dependency, carries focus handling and Escape, and reads better than a floating menu at 360px. No hover-only affordance, no control below `size-9`, and the badge takes its colour and shape from tokens, not literals ([ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md)).

## Data model

`[MIGRATION]` — one column and one index on `Product`: `archivedAt DateTime?` and `@@index([orgId, archivedAt])`. Nullable with no default, so every existing row is on sale and the migration needs no backfill. No other table changes; nothing is dropped.

## API / contract changes

`[CONTRACT]` — `DELETE /api/org/[orgId]/products/[id]` gains a response body (`{ outcome }`) where it returned `{ success: true }`, and `PATCH …/[id]/archive` is new. The product DTO in [CONTRACTS.md](../../CONTRACTS.md) gains `archivedAt` on the org-facing shape only; the buyer-facing shape does not carry it, since a buyer never receives an archived product. CONTRACTS.md moves in the same PR.

## Test plan

Per [TESTING.md](../../TESTING.md). Unit: the `AVAILABLE` fragment's shape; the delete-versus-archive branch on each blocker combination; the archive refusal for a live bidding event; the SKU-clash message; `describeDeleteBlockers` as extended. The D3 guard test, enumerating buyer-facing product query sites. Integration, against the local database: archive a product with a paid order and assert the order detail still renders it; assert `getProductBySlug`, search, hero, offers, similar and the sitemap all stop returning it; assert `check-stock` reports it unavailable; assert an order transaction naming it is refused while one naming an on-sale product succeeds; assert restore returns it to all of the above.

## Delivery (PRs)

1. **Data and invisibility.** Column, migration, the `AVAILABLE` fragment, every buyer-facing read filtered, `assertNotArchived` in the order transaction, `check-stock`, sitemap, and the D3 guard test. **No behaviour change in production** — nothing can be archived yet, so every row is on sale and every query returns what it returned before.
2. **The controls.** Archive and restore service, route and audit; `DELETE` degrades; the org list's status filter, badge and Restore; the SKU-clash message; the bidding refusal. This is the PR that changes behaviour.
3. **Figures.** Analytics inventory and the org catalogue counts exclude archived stock and say which figure they report.

## Open questions

Both closed by assumption at implementation (PR-113); reopen with a spec change rather than a code change.

- **Q1 — What does a bulk catalogue upload do when its SKU matches an archived product?** Restoring and updating it silently would put a product back on the storefront as a side effect of an import, which R6 says is an explicit act. Refusing the row is safer and is the assumed default until [bulk-catalog-upload](../bulk-catalog-upload/) decides.
- **Q2 — Should an archived product's URL answer 410 rather than 404?** 410 tells a crawler to retire the URL, which is wrong for something an org may restore tomorrow. 404 is assumed. This touches the standing soft-404 item in [BACKLOG.md](../../BACKLOG.md), which should be resolved first so both answers come from one place.
