# TESTING.md — test strategy

- **Verified:** 2026-08-03

## Stack

Vitest 4 · happy-dom · `@testing-library/react` · `@vitest/coverage-v8` — all in `devDependencies`.

Harness configuration lives in `vitest.config.ts`. Note it aliases `@` → `./src` but not the `@server/*` alias that `tsconfig.json` defines, so a test importing `server/` by alias will not resolve until that is added.

## Coverage philosophy

**Not a blanket percentage.** A global threshold gets satisfied by testing whatever is cheapest, which is never the code that matters. Targets are per-layer and follow the seven Project Invariants in [../CLAUDE.md](../CLAUDE.md) — the reasoning being that an Invariant without a test is a preference, not an invariant.

| Component | Target | Why |
|---|---|---|
| **Pricing and total computation** | **100%, every branch** | [ADR-0002](adr/0002-server-holds-pricing-authority.md). A gap here is money. Must cover: a client-supplied price is ignored; a recomputed total that differs is rejected |
| **Payment state transitions** | **100%** | [ADR-0005](adr/0005-payment-state-server-only.md). Must cover: an unauthenticated state change is refused; `paymentStatus` in a create body is ignored; a signature mismatch rejects; a replayed confirmation is idempotent |
| **Stock reservation under concurrency** | **100%** | [ADR-0007](adr/0007-conditional-stock-decrement.md). Must cover: N concurrent orders against one unit yield exactly one success |
| **Ownership / authorization** | **100%** | Every route taking a resource id: owner passes, non-owner refused, anonymous refused, and the guest-order case asserted explicitly rather than left implicit |
| Zod schemas | High | [Invariant 4](../CLAUDE.md). Rejection cases matter more than acceptance |
| Money formatting and paise conversion | High | [ADR-0004](adr/0004-money-as-integer-paise.md). Boundary values and rounding |
| Repositories | High on write paths | Conditional writes, and `select` projections that must exclude credential fields |
| Cart sync and merge | High | Guest→signed-in merge, conflicting quantities, missing products, price refresh |
| Shipping rate calculation | Moderate | Weight resolution and fallback behaviour |
| React components | Smoke | Renders, key interaction fires. Not snapshot-heavy |
| Route handler glue | Smoke | Covered through integration tests instead |
| `src/app/**` pages | None | Layout and composition; verified manually |

## What not to test

- **External services.** Trust Razorpay, Resend, and Shiprocket to work; test *our* request construction and response parsing. Never call a live API from a test — record the quirks in [INTEGRATIONS.md](INTEGRATIONS.md) instead.
- **Prisma internals.** Test our queries' behaviour, not the ORM's.
- **Next.js routing.** Framework behaviour.
- **Generated types.** Nothing to assert.

## Layout

Mirror the source path: `server/checkout/order.service.ts` → `tests/services/orderService.test.ts`.

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

**Every quality step blocks the pipeline.** `continue-on-error` on a lint, typecheck, or test step is forbidden — a gate that cannot fail is worse than no gate, because it manufactures confidence. This is not a preference: the suite was once removed as collateral in an unrelated change and the pipeline reported success for months.

**Adopt it in stages**, because a gate that is noisy with no path to quiet gets suppressed, and suppression is the original failure:

1. **Typecheck blocks immediately** — it already passes clean.
2. **Tests block as soon as a suite exists.**
3. **Lint blocks on `error` severity only.** Warnings stay non-blocking. Clear the `no-explicit-any` errors in scoped PRs, trust-boundary code first — route handlers, auth, payment. Turning on all of it at once would make `main` red on day one and invite exactly the suppression this rule exists to prevent.

**The harness comes first** (see above) — recovery stalls on the first file otherwise.

**`prisma migrate deploy` belongs in the pipeline.** Without it, migrations are applied by hand and code can ship before its column exists.

**Recover the deleted suite rather than rewriting it.** `git show 6b34cbf` holds every line, including reusable fixtures and mock factories. Each file must pass against current code before being re-added: one asserting behaviour that has legitimately changed gets updated; one asserting behaviour that was wrong gets rewritten to assert the corrected invariant. Prioritise by the Invariants — the `critical/` tests first.
