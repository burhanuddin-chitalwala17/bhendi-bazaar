# Spec — product-archive

- **Summary:** An org archives a product and restores it without destroying what it was part of
- **Status:** Implemented — PR-113
- **Domain:** catalog (enforcement point in checkout)
- **Phase:** 6 — Catalogue richness
- **Verified:** 2026-09-16
- **References:** [trd.md](trd.md), [ADR-0020](../../adr/0020-money-bearing-records-never-cascade.md), [ADR-0023](../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md), [ADR-0029](../../adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md), CHANGELOG PR-112

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

An org can take one of its products off sale and put it back, without destroying what the product has already been part of.

## Why

A product that has ever been ordered cannot be deleted and never will be: an order line records what was sold and for how much, and orphaning it would falsify the order, the payout and the ledger ([ADR-0020](../../adr/0020-money-bearing-records-never-cascade.md)). That refusal is correct. What is missing is the operation an org actually wants.

Today there is no way to express "this exists but is not for sale". Nothing on a product carries a lifecycle — there is no status, and its flags are display badges. So an org whose product has a single abandoned unpaid order against it cannot remove that product from the storefront at all. Zeroing the stock is the only lever, and it is the wrong one: the product stays listed, browsable and indexed, and reads as a shop that cannot keep anything in stock.

Discontinued lines, seasonal stock, a listing that turned out to be a mistake after its first sale, and a product an org no longer has the right to sell are all the same request, and it is not deletion.

## Requirements

- R1 — An org can archive any of its own products, whether or not it has ever been sold, promoted or put up for bidding.
- R2 — Archiving destroys nothing. Past orders, shipments, payouts, ledger entries and discount records continue to name the product and to show what was actually paid.
- R3 — An archived product appears nowhere a buyer browses: category and listing pages, search results and suggestions, the home hero and offer rails, similar-product rails, an org's storefront, and the sitemap.
- R4 — An archived product cannot be bought by any route, including a cart filled or a checkout begun before it was archived.
- R5 — A buyer who already holds it in a cart or a wishlist is shown it as unavailable. The line is not silently removed, because archiving is reversible and a vanished line cannot come back.
- R6 — Restoring puts the product back on the storefront as it was, under the same URL, and anything still sitting in a cart becomes buyable again.
- R7 — An org's product list excludes archived products by default and can show them on request, marked as archived. Its catalogue counts say which figure they are reporting.
- R8 — Archiving and deleting are separate acts, and each does only what its name says. Deleting removes a product no record depends on; for any other it is refused, and the refusal names what holds the product and says archiving is the way to take it off the storefront. The org never has to know why a product is undeletable, only what to do instead.
- R8a — Deleting is reachable but never adjacent to the everyday controls. It is the one irreversible act in the product list, and it is reached deliberately rather than by a tap next to a routine one.
- R9 — An archived product's own URL stops serving a buyable page. The slug stays reserved, so a restore returns the product to the same address and no other product can take it meanwhile.
- R10 — An archived product cannot be added as the target of a new promotion, and an existing promotion that still names it does not put it back on sale.
- R11 — A product with a live bidding event cannot be archived. The event is a standing commitment to the people bidding on it; it is cancelled or it runs out first.
- R12 — Archiving is an attributable act: who withdrew or restored a product, and when, is recorded for the same reasons every other org-facing mutation is.

## Hazards this feature must answer

Named here so the technical approach cannot quietly skip them.

- **A read filter is not an enforcement point.** Hiding a product from listings does not stop a cart that already holds it, a stale page, or a hand-made request from buying it. There must be a point inside the order transaction that refuses, for the reason [ADR-0023](../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md) gives for bidding suspension: a check performed before the transaction is stale by the time the row is written.
- **Archiving races a checkout in progress.** An org may archive a product in the same seconds a buyer is paying for it. One of the two must win unambiguously, and a buyer who has already been charged must not be left holding a refused order.
- **Every read path is a place to forget.** Roughly thirty product queries exist across the storefront, the portals, search, the sitemap, the cart, the wishlist and analytics. Some must exclude archived products, some must keep including them — order history and historical analytics are wrong if they forget a product ever existed. A rule that has to be remembered at thirty call sites will be missed at one, so something must make the omission visible.
- **Reserved slugs look like a bug later.** An archived product keeps its slug, so an org that archives "blue-kurta" and lists a new one by the same name gets a name clash with a product it cannot see. The message must explain that, not report a mysterious duplicate.
- **Stock figures change meaning.** An archived product's stock is still on a shelf somewhere but is not for sale. Inventory totals, low-stock alerts and out-of-stock counts must each state which of the two they mean.

## Product acceptance

- A1 — An org archives a product that has one paid order against it; it disappears from the storefront, and the order's own page still shows the item, its picture and the price paid.
- A2 — A buyer with that product in their cart sees it marked unavailable, cannot check out with it, and sees it buyable again after the org restores it.
- A3 — The product's storefront URL stops serving a buyable page while archived and serves the same page again after a restore.
- A4 — Searching the storefront for its name returns nothing while archived, in both the results page and the suggestion dropdown.
- A5 — An org deletes a product it has never sold and it is gone outright; deleting a sold one is refused, the refusal names the orders holding it, and archiving that same product succeeds. Judged on a phone first (~360px) per [ADR-0015](../../adr/0015-mobile-first-design.md): the archive control, the delete step behind it, and the archived/restore state are all reachable and legible at that width.
- A6 — Attempting to archive a product with a live bidding event is refused, and says why.
- A7 — An archived product cannot be picked as a promotion target, and a promotion that already named it neither lists nor prices it.

## Out of scope (this feature)

- Archiving a category, an org, or an org's whole catalogue at once.
- Scheduled or timed archiving — "off sale from Tuesday". Archiving is immediate.
- Recovering products deleted before this feature existed; there is nothing to recover them from.
- Variant-level archiving (a single size or colour off sale) — that needs variants to be first-class rows first.
- Bulk archiving from the catalogue upload ([bulk-catalog-upload](../bulk-catalog-upload/)). What an upload does when its SKU matches an archived product is recorded as an open question in [trd.md](trd.md).
