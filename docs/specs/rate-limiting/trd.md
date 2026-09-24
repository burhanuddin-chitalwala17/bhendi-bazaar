# TRD — rate-limiting

- **Status:** Draft
- **Domain:** cross-domain
- **Phase:** 4 — Enforcement
- **Verified:** 2026-09-21
- **References:** [spec.md](spec.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [CHANGELOG PR-55](../../CHANGELOG.md), [TESTING.md](../../TESTING.md), [error-tracking](../error-tracking/)

> Technical approach and decisions. No code — references to existing code only.

## Approach

Three failure modes that PR-55 treated identically get separated, and the seam that PR-81 left in `src/lib/rate-limit/index.ts` is where they separate.

**Unconfigured** is a configuration error, and configuration errors belong at boot. **Unreachable** is a transient runtime fault and must stay fail-open, because a vendor incident must not become a store outage. **Not applicable** — local development — is neither a fault nor a silent gap: it gets a real limiter that happens to be in-process.

That third case is what makes the first tractable. Once local development has a working limiter of its own, requiring the shared one in every deployed environment costs a developer nothing, so "production might be unlimited" stops being a state the system can reach.

## Technical decisions

- D1 — **The backend is chosen by environment, not by whether keys happen to be present.** Absent `VERCEL_ENV` means local; `preview` or `production` means the shared Upstash limiter at `src/lib/rate-limit/upstash.ts` is mandatory. Selecting on key *presence* was the PR-55 design and is what allowed a production deploy to quietly degrade to no limiting; presence becomes a boot assertion instead of a branch.
- D1a — **Local has two backends, and the default is the one needing no setup.** By default local development uses the in-process limiter parked at `src/lib/rate-limit/memory.ts`, which reaches no network, so a fresh clone runs with nothing provisioned (spec R4). A developer who wants the real thing points `KV_REST_API_URL` at a local Upstash-compatible HTTP proxy in front of a local Redis, and the code path becomes byte-for-byte the deployed one.
- D1b — **Continuous integration uses the proxy, not the in-process limiter.** This is where the fidelity argument actually bites: `memory.ts` is a *different implementation* of the same interface, so a defect in the Upstash path — a wrong key prefix, a window that does not slide as expected, a response shape misread — would never appear until production. Exercising the deployed path automatically, where nobody has to remember to, is the point; making a developer run a container before `npm run dev` is not. A local Redis alone cannot serve this: `@upstash/redis` is an HTTP client and speaks REST, not the Redis wire protocol, so the proxy is the load-bearing piece rather than the Redis behind it.
- D2 — **Configuration is checked at boot, not per request.** `validateEnv()` (`src/lib/env.ts`) runs from Next's `instrumentation.ts` `register()` hook. Deployed: a missing key throws and the deploy fails. Local: it logs one warning listing what is missing and continues.
- D3 — **Runtime unreachability keeps failing open, loudly.** Fail-closed was considered and rejected: the limiter is a backstop against abuse, not an authorisation gate, and closing on outage converts an Upstash incident into downtime for every signup and checkout (spec R5). What changes is that the log becomes an alert once [error-tracking](../error-tracking/) lands — a fail-open control nobody is notified about is the failure mode this spec exists to end.
- D4 — **The caller's address comes from `x-vercel-forwarded-for`, never `x-forwarded-for`.** The seam's `getClientIp` is already correct; `upstash.ts` and `memory.ts` each carry their own older copy reading the client-suppliable header, and both must be deleted in favour of the seam's (spec R7, A5). This is the difference between a per-IP limit and a decoration.
- D5 — **The two parked implementations converge on one interface.** `RateLimiter` in the seam is the contract; `memory.ts` loses its bespoke `withRateLimit`, `rateLimit` and `getRateLimitIdentifier` exports so there is exactly one of each in the tree (Invariant 5's reasoning applied to modules).
- D6 — **429 travels in the shared envelope.** Handlers currently hand-build a bespoke `{ error }` body with rate-limit headers (e.g. `src/app/api/auth/signup/route.ts`). Move the refusal through `toErrorResponse` so `useServerForm` renders it inline like any other refusal (ADR-0013), preserving `Retry-After` and `X-RateLimit-*` and the `formatTimeRemaining` message.
- D7 — **The memory limiter's unbounded growth is fixed before it is live.** Its current eviction only runs past ten thousand entries and only sweeps expired keys, which is adequate for a dev process but should not be the thing a reviewer discovers later. Bound it explicitly.

## Packages

None. `@upstash/ratelimit` and `@upstash/redis` are already in [DEPENDENCIES.md](../../DEPENDENCIES.md); this feature makes them reachable from the request path for the first time since PR-81.

## Data model

None.

## API / contract changes

None to DTO shapes. The 429 body moves from a bespoke shape onto the error envelope already documented in [CONTRACTS.md](../../CONTRACTS.md) — clients using `readApiError` are unaffected. Verify nothing parses the old bespoke body before merging.

## Test plan

- Unit — backend selection: absent `VERCEL_ENV` yields the in-process limiter and never constructs a Redis client; `preview` and `production` both yield the shared one.
- Integration — the deployed code path against the local proxy in CI: a window genuinely refuses the request after its budget, and the count is shared across two client instances rather than per-process (D1b).
- Unit — `validateEnv`: throws when deployed with keys missing; warns and continues locally; passes clean when all present.
- Unit — the fail-open wrapper: limiter throws → allowed and logged; configured → result passed through untouched.
- Unit — identity: a request carrying a forged `x-forwarded-for` resolves to the same identifier as one without it.
- Route — a limited request returns 429 in the envelope shape with `Retry-After` set, alongside the existing envelope suites per TESTING.md.

## Delivery (PRs)

Two PRs.

1. **The boot gate and the seam** — `instrumentation.ts`, environment-driven selection, the two parked files converged and their duplicate helpers deleted. Behaviour change: a deployed environment without keys is refused.
2. **The handlers** — coverage extended to the endpoints spec R1 names that never had a limit (`reset-password`, `resend-verification`, `verify-email`, `orders/lookup`, `bidding/[slug]/bids`), and every 429 moved onto the envelope. ADR-0013 makes the conversion obligatory on touch anyway.

Guest order lookup rides in PR 2 and is the reason PR 2 should not be deferred.

## Open questions

None. Both of the previous draft's questions are closed: preview enforces exactly as production does (spec R3), and `validateEnv`'s required list has since moved to the `R2_*` keys under [ADR-0028](../../adr/0028-images-live-in-cloudflare-r2.md), so the list must be re-checked against the Vercel environment before the boot gate merges — a deploy step, not an open decision.
