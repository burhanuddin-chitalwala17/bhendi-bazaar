# ADR-0026: A product leaves sale by archiving, not deletion

- **Date:** 2026-09-16
- **Status:** Accepted

## Context

A catalogue row outlives its own usefulness. A line is discontinued, a season ends, an org loses the right to sell something, or a listing turns out to be a mistake after its first sale. In every one of those cases the org wants the product gone from the storefront, and in none of them does it want the record of what was already sold to change.

Deletion cannot serve that. An order line records what was bought and the price it was bought at, so the foreign keys out of it refuse to cascade ([ADR-0020](0020-money-bearing-records-never-cascade.md)) and a product that has ever been ordered is permanent at the database level. That refusal is right, and it leaves the store with no way to express the thing orgs actually ask for — because nothing on `Product` describes a lifecycle at all: no status, and flags that are display badges. The only available lever was setting stock to zero, which keeps the product listed, browsable and indexed, and makes a deliberate withdrawal look like a shop that cannot restock.

The forces pulling against each other are permanence of the sales record, an org's freedom to curate its own shelf, and the fact that a product hidden from a listing is not thereby prevented from being bought.

## Decision

1. **A product leaves sale by acquiring an `archivedAt` timestamp, never by being deleted.** The row, its media, its reviews and its history stay exactly as they were.
2. **Deletion survives only for a product that no record depends on.** With no order line, promotion target or bidding event against it, a product is still hard-deleted and its cascading children go with it. Anywhere else, the one delete control archives instead and reports which of the two it did.
3. **Visibility has a single definition.** One exported `where` fragment is how every buyer-facing query asks whether a product is on sale. A read that must keep seeing archived products — order history, shipments, payouts, historical revenue — omits it deliberately, and a test over the call sites makes an accidental omission fail rather than ship.
4. **The enforcement point is inside the order transaction, not the read filter.** A purchase of an archived product is refused by an assertion that runs in the same transaction that writes the order, beside the one that refuses a product under bidding. Filtering a listing is presentation; removing a button is not a control.
5. **An order already created is not invalidated by a later archive.** The gate is at order creation, which precedes payment, so a withdrawal either refuses the order before the buyer is charged or arrives after the order stands. A buyer is never charged for an order the store then declines.
6. **Archiving is reversible and explicit.** Restore puts the product back at the same URL; the slug is never released while archived. Nothing else — an import, a promotion that still names it, a cancelled bidding event — puts a product back on sale as a side effect.

## Alternatives considered

- **Delete the product and let the order lines cascade.** The conventional answer, and the one the schema originally allowed for categories. It falsifies every order the product appeared on, and with it the payout and the ledger. [ADR-0020](0020-money-bearing-records-never-cascade.md) exists because this was tried.
- **Delete the order to free the product.** Technically available — `Order → OrderItem` does cascade, and an admin `deleteOrder` exists. Rejected twice over: it destroys the sales record to tidy a catalogue, and for any order that moved money it does not even work, since `OrderDiscount` and `OrgLedgerEntry` hold `Restrict` keys on `Order`.
- **No archive; tell orgs to set stock to zero.** Costs nothing to build and is what orgs were doing. The product stays listed, indexed and browsable, so the shop advertises what it will not sell — and out-of-stock already means something else, which is that the product is coming back.
- **A `ProductStatus` enum — `DRAFT` / `ACTIVE` / `ARCHIVED`.** The textbook model, and the option most would pick. It loses on honesty: nothing in this product drafts a listing, so `DRAFT` would be declared and never set, and a two-state enum is a boolean wearing ceremony. A nullable timestamp answers "is it" and "since when" in one column, and a third state can be introduced later by whatever feature actually needs one.
- **Derive archived status the way bidding suspension is derived.** [ADR-0023](0023-bidding-status-stores-only-what-the-clock-cannot-decide.md) stores nothing on `Product` when a bidding event opens, because a clock decides that. Nothing about a clock decides whether an org wants a product off sale, so there is nothing to derive it from. That ADR's rule is the reason this one stores a column, not an exception to it.
- **Filter at read time and skip the transaction gate.** Cheaper, and covers every case anyone would demonstrate. It leaves a cart filled before the withdrawal, a stale page, and a hand-made request all able to buy, which is the same hole the bidding gate was built to close.
- **A separate `ArchivedProduct` table.** Keeps the live table small and is a genuine option at a larger scale. Rejected here: every foreign key pointing at `Product` would have to be redirected on archive and back on restore, which is a great deal of machinery to avoid one nullable column, and it makes an order's product reference conditional on which table it lives in.

## Consequences

✅ An org can curate its shelf without anyone reasoning about foreign keys, and the refusal it used to hit is replaced by an operation that works.

✅ The sales record becomes genuinely immutable: there is now no supported path that removes a product an order depends on, so order history, payouts and the ledger cannot be hollowed out by catalogue tidying.

✅ Withdrawal is reversible, so it is a safe act. Mistakes cost a click, which is what makes it usable for seasonal stock rather than only for permanent retirement.

✅ One fragment plus one guard test means the next buyer-facing query is filtered by default, and a missed one fails a test rather than leaking a withdrawn product.

⚠️ Every buyer-facing read now carries a condition it did not carry before, and the correct behaviour differs per call site. The guard test reduces that to a decision each new query must make explicitly; it does not remove the decision.

⚠️ Archived rows accumulate in the hot table forever. At this catalogue's size the index carries it; at a much larger one the separate-table option returns, and this ADR would be superseded rather than amended.

⚠️ A withdrawn product holds its slug and its SKU indefinitely, so an org re-listing the same name or code collides with something it cannot see. The clash is reported in those terms, which is mitigation, not absence.

⚠️ "Not for sale" now has two meanings on the shelf — out of stock and withdrawn — and any figure about inventory has to say which it counts. Three analytics figures had to be pinned down for this reason.
