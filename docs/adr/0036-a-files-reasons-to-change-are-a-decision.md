# ADR-0036: A file's reasons to change are a decision, not a drift

- **Date:** 2026-09-23
- **Status:** Accepted

## Context

A full-tree measurement on 2026-09-23 found `server/checkout/order.service.ts` at **825 lines
and 26 commits in three months** — the largest file in the repo and the most-changed — with
`createOrderWithShipments` about 400 of those lines on its own.

**No individual change to it was wrong.** Promotions needed a discount written at order time.
Bidding needed a suspension check inside the transaction. The ledger needed a hook on
confirmation. Each went where the order was already being written, which was the obviously
correct place for that one change. The file is the sum of a hundred locally-correct decisions,
and review does not catch that, because at review time every diff is small and sensible.

The first attempt at a gate measured *length*, and was discarded before it shipped. Length is
the symptom, not the cause.

The cause is measurable and sharper. That file **reaches into six other domains**: bidding,
cart, catalog, notifications, promotions, shipping. Six unrelated feature areas each have a
standing reason to edit it. A 200-line file with the same six would be exactly as bad, and
ADR-0036 would have said nothing about it.

The moment of drift is also precise, which a length gate obscures: **it is the import.** When a
feature adds `import … from "@server/bidding/…"` to a checkout file, that file has acquired a
new reason to change, in one line that looks harmless in review. Length crosses a threshold
much later, long after the decision that mattered.

Two measurements decided the shape:

- **Reach distribution.** 445 files reach no other domain, 168 reach one, 12 reach two, and
  five reach more. Two is where the codebase already lives, so the threshold is the tree's
  rather than an opinion.
- **Change coupling.** `order.service.ts`, `order.types.ts`, `order.repository.ts`,
  `order.schemas.ts` and `useCheckoutPayment.ts` change together in 71–100% of commits touching
  any of them. That is what reach costs: one concept, five files that must agree.

## Decision

1. **A file may reach into at most two other domains freely.** Its own domain is not a reason
   to change, and `shared` is the kernel ([ADR-0033](0033-a-domain-is-reached-through-its-public-surface.md) D4).
2. **Beyond two, the file is recorded with its exact domain set and the reason.** The reason is
   the deliverable — it is the thought, made durable.
3. **The recorded set is pinned, not just its size.** A file that already reaches six may not
   quietly reach seven: already being coupled is not licence to couple further.
4. **A record that has shrunk is narrowed.** The ratchet tightens as the debt is paid.
5. **This applies to every file at any size.** There is no threshold to be under.
6. **`tests/unit/file-cohesion.test.ts` enforces it.**

## Alternatives considered

- **A line-count budget** — a recorded ceiling per file, raised only with a written reason.
  Built first, then discarded: it measures a symptom. A 200-line file that acquires five
  unrelated dependencies passes it, and a long file of small cohesive functions fails it.
  Keeping it *alongside* this gate would be worse than either alone — two gates for one idea,
  and the weaker one absorbs the attention, because a line count is easier to satisfy than a
  dependency.
- **Cyclomatic complexity, or a maintainability index.** Better proxies for "is this function
  hard", worse for "does this file have too many masters", which is the question here.
- **Cap function length instead** (88 functions exceed 90 lines). Still worth doing for
  `server/`, and still not this: `createOrderWithShipments` is long *because* it serves six
  domains. Fix the reach and the length follows; fix the length alone and the reach hides in
  six small functions in the same file.
- **Require a justification comment on every diff.** Closest to the literal request, and
  unenforceable: nothing can tell a real reason from "added product filter". A gate that fires
  only when coupling actually increases asks for the thought at the one moment it is needed.
- **A lint rule.** Lint is `continue-on-error: true` in CI here, so it advises rather than
  enforces — the same reason [ADR-0033](0033-a-domain-is-reached-through-its-public-surface.md)
  and [ADR-0034](0034-render-on-the-server-by-default.md) are tests.

## Consequences

- ✅ The gate fires on the line that adds the coupling, at any file size, which is the moment
  the decision is actually being made.
- ✅ The record doubles as a decoupling backlog, with the argument for each entry written down.
- ✅ Five recorded files, so the gate starts nearly clean rather than as a wall of debt.
- ⚠️ Import reach is not the only coupling. A file can take on a new responsibility using only
  what it already imports, and this will not see it. It catches the common case, not every case.
- ⚠️ A barrel of re-exported types (`src/domain/admin.ts`) trips it while holding no logic. It
  is recorded rather than exempted, because the reach is still telling the truth about how many
  places it must follow.
