# TESTING.md — test strategy

- **Verified:** 2026-09-21
- **Covers:** `tests/*/`, `.github/workflows/ci.yml`, `vitest.config.ts`

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
├── utils/              # shared fixtures, mock factories, auth helpers
├── unit/               # pure logic; no disk, no network
├── integration/        # crosses module boundaries
├── e2e/                # full flows
└── critical/           # tests that guard an Invariant — see targets above
```

`critical/` is deliberately separate: those tests are the executable form of [../CLAUDE.md](../CLAUDE.md)'s Invariants, and a failure there blocks regardless of anything else.

### Database behaviour is tested against the local database, and only there

**This gap is half closed.** Every file in `integration/` runs against a real Postgres, guarded by the same bargain: it reads `DATABASE_URL`, and `describe.skipIf` skips the whole suite unless the host is loopback *and* the database is named `bhendi_bazaar_dev`. That is an allowlist, the shape [Invariant 7](../CLAUDE.md) already requires of the seed — a denylist of production hostnames fails open, and these files write rows.

The consequence to keep in mind: **they are green by absence anywhere else.** In CI, and on any machine whose `DATABASE_URL` points elsewhere, they report as skipped and the pipeline stays green having verified none of it. A CI run passing is therefore not evidence that a constraint holds; running the suite locally, against a seeded dev database, is. Some of them also expect the seed to have run (`bulk-upload`, `db-ops-budget`, `join-equivalence`) and fail loudly rather than silently if it has not.

`order-transaction.test.ts` is the exception and the pattern to copy: it **creates its own products and stock** instead of reading seeded fixtures. Its first draft did read them and broke immediately — only two unpromoted products existed at any one location, which is a fact about the seed, not about the code under test. Owning its fixtures also means it needs nothing but a migrated schema, which is what any of these would need to run in CI, since the seed guard refuses to run under `CI` by design ([Invariant 7](../CLAUDE.md)).

This matters because **the project deliberately pushes rules into the database**: Invariant 6's conditional decrement, bidding's partial unique index and `@@unique([eventId, amountPaise])` ([ADR-0023](adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)), `onDelete: Restrict` protecting order history ([ADR-0020](adr/0020-money-bearing-records-never-cascade.md)). `bidding-concurrency.test.ts` is the pattern to copy for a new one — contention expressed as concurrent transactions against one row, asserting the affected-row count is the verdict. A stub would happily prove a design that double-accepts in production.

**What is still missing is CI, not the tests.** Closing the rest means a disposable Postgres in the pipeline — a container, or a schema-per-run — plus `prisma migrate deploy` in the test setup, at which point the `skipIf` guards can widen to include it. Until then a PR whose behaviour is a constraint says so in its CHANGELOG entry, and says whether the database-backed suite was actually run.

### Guard suites: tests whose subject is the repository, not a function

A handful of suites assert a property of the codebase rather than the behaviour of one
module. They are cheap, they fail on the exact line that broke, and each exists because the
thing it guards had already gone wrong silently:

| Suite | Guards |
|---|---|
| `docs-integrity` | Documentation against the tree — broken and fabricated path references, directory references, `Verified:` dates against the last structural change to the code a doc declares it `Covers:`, pasted code, `ARCHITECTURE.md`'s counts, the domain table, and that every `process.env` variable is in `OPERATIONS.md` |
| `security-headers` | That `script-src` never gains `'unsafe-inline'`, that the nonce is carried, and that the gateway stays admitted on every channel its checkout uses |
| `constraint-shapes` | That a Prisma unique-violation is still readable after a version bump. 7.10 changed the reported shape and every friendly "that SKU is taken" message silently became a raw Prisma error |
| `design-tokens`, `ui-primitives`, `image-delivery` | [ADR-0022](adr/0022-design-decisions-go-through-tokens.md), [ADR-0031](adr/0031-one-components-home-organised-by-domain.md), [ADR-0026](adr/0026-images-are-delivered-through-the-optimizer.md) |
| `portal-guards`, `rate-limit-detached`, `seed-guard` | The edge gate reaches every portal path; no cache dependency creeps back into the request path; the seed's allowlist |

A guard that has never been red is not yet a guard. `order-transaction` was mutation-tested
before being trusted — mapping its order-item ids positionally makes it fail.

### `critical/` is empty, and the Invariant tests are in `unit/`

The directory exists; the tests that guard Invariants live beside everything else — `payment-confirmation`, `order-pricing`, `payment-failed-restock`, `seed-guard`, `admin-audit-trail`, `design-tokens`. Recorded here rather than quietly tidied away, because the separation was the point: a failure in one of those blocks regardless of anything else, and nothing in the layout currently says so.

## Conventions

1. **Name the behaviour, not the function.** `rejects_client_supplied_price` beats `createOrder_3`.
2. **One concept per test.** Arrange / Act / Assert, with blank lines between.
3. **Shared fixtures in `tests/setup.ts` and `tests/utils/`**; one-off fixtures stay in the file that uses them.
4. **Every PR with logic changes adds at least one test.** No exception, including under Lite rigor.
5. **A bug fix starts with a failing test** that reproduces it. For anything touching an Invariant, that test is the deliverable — the fix is the easy part.

## Running

```bash
npm test              # watch mode
npm run test:run      # single run, CI-style
npm run test:ui       # Vitest UI
npx vitest run --coverage
```

## CI gates

**A quality step should block the pipeline.** A gate that cannot fail is worse than no gate, because it manufactures confidence: the suite was once removed as collateral in an unrelated change and the pipeline reported success for months.

**Adopted in stages**, because a gate that is noisy with no path to quiet gets suppressed, and suppression is the original failure. Where `.github/workflows/ci.yml` stands today:

1. **Typecheck blocks.** ✅ `npx tsc --noEmit`, no `continue-on-error`.
2. **Tests block.** ✅ `npm test -- --run`. That now includes `tests/unit/docs-integrity.test.ts`, which is why the job checks out with `fetch-depth: 0` — it compares a doc's `Verified:` date against the last commit that changed the shape of the code it covers, and a depth-1 clone cannot answer that.
3. **Lint does NOT block yet.** ⚠️ The step still carries `continue-on-error: true`. The remaining errors are all `no-explicit-any`: 81 as of 2026-09-20, **56** now that `src/app/api/**` is at zero — which was the priority, since that is where CLAUDE.md calls `any` a defect. What is left is in admin pages, hooks and the shipping provider layer. Clear those in scoped PRs, then delete the flag; the rule is only real once the flag is gone.

Warnings stay non-blocking throughout (109 `no-unused-vars`, 6 `exhaustive-deps`).

**The harness comes first** (see above) — recovery stalls on the first file otherwise.

**`prisma migrate deploy` belongs in the pipeline.** Without it, migrations are applied by hand and code can ship before its column exists.

**Recover the deleted suite rather than rewriting it.** `git show 6b34cbf` holds every line, including reusable fixtures and mock factories. Each file must pass against current code before being re-added: one asserting behaviour that has legitimately changed gets updated; one asserting behaviour that was wrong gets rewritten to assert the corrected invariant. Prioritise by the Invariants — the `critical/` tests first.
