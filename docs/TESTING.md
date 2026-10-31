# TESTING.md — test strategy

- **Verified:** 2026-10-31
- **Covers:** `tests/*/`, `e2e/`, `.github/workflows/ci.yml`, `vitest.config.ts`, `playwright.config.ts`

## Stack

Vitest 4 · happy-dom · `@testing-library/react` · `@vitest/coverage-v8` — all in `devDependencies`.

Harness configuration lives in `vitest.config.ts`. It aliases both `@` → `./src` and `@server` → `./server`, mirroring `tsconfig.json` — they must stay in step or an import typechecks and fails at runtime. `fileParallelism` is off, because the database-backed files below share one local database and would race each other.

## Coverage philosophy

**Not a blanket percentage.** A global threshold gets satisfied by testing whatever is cheapest, which is never the code that matters. Targets are per-layer and follow the seven Project Invariants in [../CLAUDE.md](../CLAUDE.md) — the reasoning being that an Invariant without a test is a preference, not an invariant.

| Component | Target | Why |
|---|---|---|
| **Pricing and total computation** | **100%, every branch** | [ADR-0002](adr/0002-server-holds-pricing-authority.md). A gap here is money. Must cover: a client-supplied price is ignored; a recomputed total that differs is rejected. `order-transaction.test.ts` covers the creation path end to end — it had none until 2026-09-21, which is why batching its writes could not be done safely before |
| **Payment state transitions** | **100%** | [ADR-0005](adr/0005-payment-state-server-only.md). Must cover: an unauthenticated state change is refused; `paymentStatus` in a create body is ignored; a signature mismatch rejects; a replayed confirmation is idempotent |
| **Stock reservation under concurrency** | **100%** | [ADR-0007](adr/0007-conditional-stock-decrement.md). Must cover: N concurrent orders against one unit yield exactly one success |
| **Ownership / authorization** | **100%** | Every route taking a resource id: owner passes, non-owner refused, anonymous refused, and the guest-order case asserted explicitly rather than left implicit |
| Zod schemas | High | [Invariant 4](../CLAUDE.md). Rejection cases matter more than acceptance |
| **Error envelope** | **High** | [ADR-0013](adr/0013-one-error-envelope-and-useserverform.md). The key names are not compiler-checked, so tests are the only thing pinning them. Must cover: the key the server actually sends, detail preservation, a non-JSON body, and that an unplaceable detail is returned rather than dropped |
| Money formatting and paise conversion | High | [ADR-0004](adr/0004-money-as-integer-paise.md). Boundary values and rounding |
| Repositories | High on write paths | Conditional writes, and `select` projections that must exclude credential fields |
| Cart sync and merge | High | Guest→signed-in merge, conflicting quantities, missing products, price refresh |
| **Bidding phase and bid arithmetic** | **100%, every branch** | [ADR-0023](adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md). Nothing stores these answers, so the function *is* the state machine. Must cover: each phase boundary against a passed-in clock, the admissible bid range with and without a current high, and that an expired event with no bids stops suspending while one with bids does not |
| **Bidding writes under concurrency** | **100%** | [ADR-0007](adr/0007-conditional-stock-decrement.md), [ADR-0023](adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md). Must cover: two bids at one amount yield one winner, a bid at the closing instant is refused, two events opened on one product yield one event, and the purchase gate holds inside the order transaction |
| Shipping rate calculation | Moderate | Weight resolution and fallback behaviour |
| React components | Smoke | Renders, key interaction fires. Not snapshot-heavy |
| Route handler glue | Smoke | Covered through integration tests instead |
| `src/app/**` pages | None | Layout and composition; verified manually |

## What not to test

- **A form's own error handling.** There should not be any to test — `useServerForm` owns it. Test the hook once; test that a form uses it.
- **External services.** Trust Razorpay, Resend, and Shiprocket to work; test *our* request construction and response parsing. Never call a live API from a test — record the quirks in [INTEGRATIONS.md](INTEGRATIONS.md) instead.
- **Prisma internals.** Test our queries' behaviour, not the ORM's.
- **Next.js routing.** Framework behaviour.
- **Generated types.** Nothing to assert.

## Layout

Mirror the source path: `server/checkout/order.service.ts` → `tests/unit/order-pricing.test.ts`.

```
tests/
├── setup.ts            # referenced by vitest.config.ts
├── unit/               # 168 files: pure logic, plus every source-scanning guard
├── integration/        # 32 files: crosses module boundaries, needs a disposable database
└── helpers/            # test-db.ts — the one predicate deciding whether a database is disposable
```

`critical/`, `e2e/`, `edge-cases/`, `hooks/`, `services/`, `store/` and `utils/` also exist and are

The Invariants' executable form is the guard table below, and a failure in any of those blocks regardless of anything else.

### Database behaviour is tested against the local database, and only there

**This gap is half closed.** Every file in `integration/` runs against a real Postgres, guarded by the same bargain: it reads `DATABASE_URL`, and `describe.skipIf` skips the whole suite unless the host is loopback *and* the database is named `bhendi_bazaar_dev`. That is an allowlist, the shape [Invariant 7](../CLAUDE.md) already requires of the seed — a denylist of production hostnames fails open, and these files write rows.

The consequence to keep in mind: **they are green by absence anywhere else.** In CI, and on any machine whose `DATABASE_URL` points elsewhere, they report as skipped and the pipeline stays green having verified none of it. A CI run passing is therefore not evidence that a constraint holds; running the suite locally, against a seeded dev database, is. Some of them also expect the seed to have run (`bulk-upload`, `db-ops-budget`, `join-equivalence`) and fail loudly rather than silently if it has not.

`order-transaction.test.ts` is the exception and the pattern to copy: it **creates its own products and stock** instead of reading seeded fixtures. Its first draft did read them and broke immediately — only two unpromoted products existed at any one location, which is a fact about the seed, not about the code under test. Owning its fixtures also means it needs nothing but a migrated schema, which is what any of these would need to run in CI, since the seed guard refuses to run under `CI` by design ([Invariant 7](../CLAUDE.md)).

This matters because **the project deliberately pushes rules into the database**: Invariant 6's conditional decrement, bidding's partial unique index and `@@unique([eventId, amountPaise])` ([ADR-0023](adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)), `onDelete: Restrict` protecting order history ([ADR-0020](adr/0020-money-bearing-records-never-cascade.md)). `bidding-concurrency.test.ts` is the pattern to copy for a new one — contention expressed as concurrent transactions against one row, asserting the affected-row count is the verdict. A stub would happily prove a design that double-accepts in production.

**The CI half is now partly closed.** The test job runs a throwaway Postgres and applies
migrations, so `db-ops-budget.test.ts` runs on every push — it needs a schema and nothing in it,
because every budget is structural (`getHeroProducts` issues one LATERAL JOIN whether it returns
six rows or none). Its old guard conflated *do not run against a metered database* with *needs
the seed*, and that cost the project its only automatic defence against a query-count
regression. Verified against an empty schema: all eight budgets hold.

The rest stay local-only and genuinely do need the seed — orgs, categories, addresses, a carrier
row — which cannot run under CI by design ([Invariant 7](../CLAUDE.md)). Two ways forward, both
open: let each own its fixtures the way `order-transaction.test.ts` does, or ship the reference
rows as a data migration so CI has them after `migrate deploy`. Until then a PR whose behaviour
is a constraint says so in its CHANGELOG entry, and says whether the database-backed suite was
actually run.

### Guard suites: tests whose subject is the repository, not a function

A handful of suites assert a property of the codebase rather than the behaviour of one
module. They are cheap, they fail on the exact line that broke, and each exists because the
thing it guards had already gone wrong silently:

| Suite | Guards |
|---|---|
| `docs-integrity` | Documentation against the tree — broken and fabricated path references, directory references, `Verified:` dates against the last structural change to the code a doc declares it `Covers:`, pasted code, `ARCHITECTURE.md`'s counts, the domain table, and that every `process.env` variable is in `OPERATIONS.md` |
| `security-headers` | That `script-src` never gains `'unsafe-inline'`, that the nonce is carried, and that the gateway stays admitted on every channel its checkout uses |
| `constraint-shapes` | That a Prisma unique-violation is still readable after a version bump. 7.10 changed the reported shape and every friendly "that SKU is taken" message silently became a raw Prisma error |
| `sort-vocabularies` | That every `sortBy` key a listing declares can actually be served — a TypeScript union and a Postgres column are checked by no common compiler, so three offered sorts had been throwing for seven weeks |
| `file-cohesion` | Reasons to change — a file reaches at most two other domains, and gaining one fails the build at any file size, because the import *is* the moment a file takes on a new master ([ADR-0036](adr/0036-a-files-reasons-to-change-are-a-decision.md)) |
| `module-boundaries` | Domain decoupling and layering — no domain reaches past another's declared public surface, no component imports Prisma or a repository, no page reaches a repository instead of the DAL, `server/` never value-imports from `src/` ([ADR-0033](adr/0033-a-domain-is-reached-through-its-public-surface.md)) |
| `rendering-strategy` | Server-by-default — no `page.tsx` or `layout.tsx` is `"use client"`, and the client-component count ratchets down ([ADR-0034](adr/0034-render-on-the-server-by-default.md)) |
| `test-integrity` | The tests themselves — one definition of a throwaway database, the integration layer actually running in CI, no `.only`, no bare `.toThrow()`, no test without an assertion, and a declared, shrink-only list of suites allowed to skip |
| `conditional-stock` | Invariant 6 at the level of the write: a stock decrement names the floor it must clear and its `count === 0` is read. Deleting the condition passed all 1233 tests before this existed |
| `request-body-parsing` | Invariant 4: no handler casts `await request.json()`, every handler that reads a body validates it, and no body is spread into a Prisma `data`. It found two handlers validating nothing, one of them the unauthenticated carrier webhook |
| `jobs-config` | The worker's idle chatter: every pg-boss interval is named, none is under a minute, and the modelled daily total clears a declared ceiling. The database bills every poll, and the library's default is two seconds ([ADR-0038](adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md) D8) |
| `route-reachability` | That every route handler has a caller. A route's only caller is a string in another file, so nothing in the build notices when a page converts to a server component and leaves its handler routed, gated and answering to nobody — nine did, one of them a `PATCH` that could set `platformRole` |
| `design-tokens`, `ui-primitives`, `image-delivery` | [ADR-0022](adr/0022-design-decisions-go-through-tokens.md), [ADR-0031](adr/0031-one-components-home-organised-by-domain.md), [ADR-0026](adr/0026-images-are-delivered-through-the-optimizer.md) |
| `overlay-surfaces` | That an overlay's surface is chosen rather than inherited ([ADR-0040](adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md)): only the declared files reach for a sheet, each entry naming which of the four cases it answers, and an entry that stops being a sheet is removed |
| `channel-gate` | That a channel's size rule is applied only where the channel is known, so a marketplace's floor cannot quietly become every photograph's floor |
| `portal-guards`, `rate-limit-detached`, `seed-guard` | The edge gate reaches every portal path; no cache dependency creeps back into the request path; the seed's allowlist |
| `labelled-controls` | That every form label names its control: `FormField` renders a `<label for>` matching the control's `id` and points `aria-describedby` at the hint or error it shows, and no raw `<label>` outside `ui/` is left unassociated — `htmlFor`, or wrapping the control |
| `migration-drops` | That a column or table is never dropped without the file saying whose data goes: every migration with a `DROP COLUMN` or `DROP TABLE` carries a dated statement that the data was confirmed disposable, and the migrations that predate the rule are listed, shrink-only |

### The tests are audited the same way the code is

A guard is only worth what it catches, so each Invariant was **mutated in the source** to see
whether anything went red. Invariants 1, 2 and 7 were well covered — eight tests fire when the
charged price drifts from the catalogue, one when an expired order can be marked paid, two when
the seed stops refusing a deployed environment. Two were not covered at all:

- **Invariant 6** — deleting `quantity: { gte: n }` from the stock decrement, which is the whole
  of ADR-0007, left 1233 tests green. It now has both halves: `conditional-stock` on the shape of
  the write, and a concurrent-checkout test in `order-transaction` that orders the last unit
  twice at once and requires exactly one winner. A sequential version of that test passes with
  the condition deleted, which is why the two overlap.
- **Invariant 4** — replacing a handler's `schema.parse(await request.json())` with a cast
  changed nothing in the suite. `request-body-parsing` now refuses both the cast and the
  unvalidated body.

**Six integration suites had never run in CI.** They gated on `url.pathname ===
"/bhendi_bazaar_dev"` while CI runs `bhendi_bazaar_ci`, so they reported `↓ skipped` — most of the
integration tests then written, including the guard on Invariants 1, 3 and 6. Three cases in
`join-equivalence` went further and *passed* on the empty schema by comparing `[]` to `[]`. The
predicate now lives once in `tests/helpers/test-db.ts`, fixtures are built by `ensureFixtures`
rather than read out of the seed, and `test-integrity` fails if either regresses. The suite has
grown since — 32 files and 245 cases as of 2026-10-06 — so a fraction here would go stale the way
the last one did; what matters is that a suite skips only for a stated reason, which
`test-integrity` is what checks.

**Every filesystem-scanning guard states a floor.** Seven asserted an empty offender list without
proving the scan had found anything — a broken glob would have read as a pass, which had already
happened once to `module-boundaries`.

**A gate against existing debt is a ratchet, not a cliff.** `module-boundaries` and
`rendering-strategy` both landed on a tree that already violated them — thirteen cross-domain
repository imports, ten client pages. Failing on day one would have got them suppressed, which
is what happened to lint here. So each allowlists what exists *with the reason it survives*,
asserts the reason is longer than a shrug, and fails if an allowlist entry no longer matches a
real violation — the list can only shrink. The allowlist is the backlog, in the one place that
cannot go stale.

A guard that has never been red is not yet a guard. `order-transaction` was mutation-tested
before being trusted — mapping its order-item ids positionally makes it fail. So was
`route-reachability`: misspelling the one `fetch` that reaches `/api/admin/settlements` makes it
report that route and nothing else.

### `critical/` is empty, and the Invariant tests are in `unit/`

The directory exists; the tests that guard Invariants live beside everything else — `payment-confirmation`, `order-pricing`, `payment-failed-restock`, `seed-guard`, `admin-audit-trail`, `design-tokens`. Recorded here rather than quietly tidied away, because the separation was the point: a failure in one of those blocks regardless of anything else, and nothing in the layout currently says so.

## Conventions

1. **Name the behaviour, not the function.** `rejects_client_supplied_price` beats `createOrder_3`.
2. **One concept per test.** Arrange / Act / Assert, with blank lines between.
3. **Shared fixtures live in `tests/setup.ts`**; one-off fixtures stay in the file that uses them. A second shared-fixture directory was named here for a long time and never created — git cannot track an empty directory, so it passed on the machine that happened to have the stray folder and failed CI on every fresh checkout. Name a directory here only once it holds a file.
4. **Every PR with logic changes adds at least one test.** No exception, including under Lite rigor.
5. **A bug fix starts with a failing test** that reproduces it. For anything touching an Invariant, that test is the deliverable — the fix is the easy part.

## Running

```bash
npm test              # watch mode
npm run test:run      # single run, CI-style
npm run test:ui       # Vitest UI
npx vitest run --coverage
npm run build && npx playwright test   # browser journeys (needs the local throwaway DB)
```

**Browser journeys (`e2e/`).** Playwright, phone and desktop, against `next start` on a production
build. `e2e/seed-fixtures.ts` builds one product in the fixture category on the throwaway database
and refuses any other. Files are `*.e2e.ts`, never `*.spec.ts`, so Vitest does not collect them.
A journey asserts what a person sees, never a timing: wait for the confirmation the UI shows.

## CI gates

**A quality step should block the pipeline.** A gate that cannot fail is worse than no gate, because it manufactures confidence: the suite was once removed as collateral in an unrelated change and the pipeline reported success for months.

**Adopted in stages**, because a gate that is noisy with no path to quiet gets suppressed, and suppression is the original failure. Where `.github/workflows/ci.yml` stands today:

1. **Typecheck blocks.** ✅ `npx tsc --noEmit`, no `continue-on-error`.
2. **Tests block.** ✅ `npm test -- --run`. That now includes `tests/unit/docs-integrity.test.ts`, which is why the job checks out with `fetch-depth: 0` — it compares a doc's `Verified:` date against the last commit that changed the shape of the code it covers, and a depth-1 clone cannot answer that.
3. **Lint blocks where the tree is already clean, and advises elsewhere.** `npm run lint:boundary`
   runs ESLint over `src/app/api`, `server/checkout`, `server/payments` and `src/lib` with
   `--quiet`, and **is a blocking CI step**. Those trees are at zero errors, and `any` is a defect
   at a trust boundary — a rule that holds only until someone adds one line is not a rule. The
   scope grows as trees are cleared and never shrinks. The repo-wide `npm run lint` stays
   advisory.
4. **Repo-wide lint does NOT block yet.** ⚠️ The step still carries `continue-on-error: true`. Almost all the errors are `no-explicit-any`: 81 as of 2026-09-20, **37** on 2026-09-28 (35 of them that rule) now that `src/app/api/**` is at zero — which was the priority, since that is where CLAUDE.md calls `any` a defect. What is left is in admin pages, hooks and the shipping provider layer. Clear those in scoped PRs, then delete the flag; the rule is only real once the flag is gone.

5. **Dependencies block.** ✅ `node scripts/audit-prod.mjs`: a high or critical advisory in a production dependency fails the test job unless `audit-allowlist.json` names it with a reason and an expiry. A registry outage is retried once and reported as an outage, not a finding.
6. **Browser journeys block the deploy.** ✅ The `e2e` job builds, starts and runs `npx playwright test` on every event, and `deploy` needs it. A failed run uploads its report and traces.

Warnings stay non-blocking throughout (101 in total on 2026-09-28: 93 `no-unused-vars`, 5 `exhaustive-deps`).

**The harness comes first** (see above) — recovery stalls on the first file otherwise.

**`prisma migrate deploy` belongs in the pipeline.** Without it, migrations are applied by hand and code can ship before its column exists.

**Recover the deleted suite rather than rewriting it.** `git show 6b34cbf` holds every line, including reusable fixtures and mock factories. Each file must pass against current code before being re-added: one asserting behaviour that has legitimately changed gets updated; one asserting behaviour that was wrong gets rewritten to assert the corrected invariant. Prioritise by the Invariants — the `critical/` tests first.
