# ADR-0055: An admin surface reads through projections and writes through the aggregate's one repository

- **Date:** 2026-10-05
- **Status:** Accepted

## Context

Two rules in the always-loaded [CLAUDE.md](../../CLAUDE.md) contradicted each other. Invariant 5 says two repositories writing the same table is a hard block ([ADR-0003](0003-one-repository-per-aggregate.md)). "There is no admin domain" says an admin listing is kept as `admin.*` files inside the owning domain. Five `admin.*.repository.ts` files existed and four of them *wrote*: on 2026-10-05 `ProductStock`, `User`, `OrgMember` and `Order` each had two writing repositories, and `ProductStock` had five writers across three domains once writes through a transaction client in services were counted.

The cost was concrete, not theoretical. The admin product save replaced every stock row from the form (`deleteMany` + `createMany`), racing checkout's conditional decrement: an edit during a checkout silently overwrote a reservation. The admin order status write was unconditional, any string, with no transition table beside the lifecycle writes that *were* conditional. This is ADR-0003's "the same row comes to have two shapes", live.

## Decision

1. **`admin.*` modules are read models.** They may query, join, count and project freely. They never write. Enforced as a ratchet ([ADR-0056](0056-a-gate-against-existing-debt-is-a-ratchet.md)): a write in a file whose name matches `admin.` fails the build unless the file is listed with its reason, and the list only shrinks. Two entries remain on 2026-10-05 — `admin.product.repository.ts` and `admin.category.repository.ts`, which hold the catalogue's entire write path while `product.repository`/`category.repository` have only ever read. Those are misnamed aggregate repositories, not second writers; the fix is the rename that the catalog restructuring carries.
2. **Every write is a named command on the aggregate's one repository.** `orderRepository.transition(id, to)` with a transition table; `profileRepository.setPlatformRole`; `stockRepository.adjust`. An admin service calls the command and records the audit entry.
3. **Stock has one writer.** `server/catalog/stock.repository.ts` is the only module that touches `ProductStock`, through commands that carry their own guard: `reserve` (conditional decrement, Invariant 6), `release`, `restockShipment`, `lockAll`/`takeOne`, `adjust` (compare-and-set against the quantity the editor saw; a mismatch is a 409), `setForImport` (an import states the truth and says so), `dropEmptyAt`. Checkout and shipping call them through `stockService`, passing their own transaction, the way `product.sale-gate` is already called.
4. **A service never writes through a transaction client.** It opens the transaction and hands `tx` to repository commands. `tx.order.create` in a service is a second writer wearing a different variable name.
5. **The gate reads every file.** `tests/unit/one-repository.test.ts` matches `prisma.`, `tx.`, `db.` and `client.` model operations across `src/` and `server/`; a write outside a `*.repository.ts`, or inside an `admin.*` one, fails. Its two-writer ratchet is meant to reach zero.

## Alternatives considered

- **Merge each `admin.*` repository into the aggregate's file**, ADR-0003 D2 read literally. Rejected: it produces thousand-line repositories and does nothing about the unguarded writes, which were the actual defect.
- **Allow caller-split repositories with a shared row shape** — what we had, made official. Rejected: a shared *type* does not make two write paths agree on *when* a write is legal; the transition table and the stock guard are behaviour, and behaviour lives in one place or in none.
- **A separate `inventory` domain** for stock. The textbook answer for a warehouse. Rejected for now: one table, tightly bound to product and location, with five callers; a module with named commands gives the same single writer without a thirteenth domain. If stock grows a ledger of movements, that is the moment to revisit.

## Consequences

- ✅ "Who can change this row, and under what condition" has one answer per table, readable in one file.
- ✅ The admin stock edit is now safe during a sale: it either applies to the quantities the editor saw or asks them to reload.
- ✅ The read/write split is CQRS-lite without the ceremony: no event bus, no projections to rebuild, just a naming rule and a scan.
- ⚠️ A new admin mutation needs a repository command, not a `prisma.x.update` in the admin file. That is one more function per feature, and the point.
- ⚠️ Until the two catalogue files are renamed, "admin never writes" is a rule with two named exceptions. Both are on the ratchet, so neither can gain company.
- ⚠️ Bulk import still sets absolute quantities. It says so in its comment; the race with a concurrent sale is the org's deliberate choice when it uploads a sheet.
