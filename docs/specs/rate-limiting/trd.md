# TRD — rate-limiting

- **Status:** ✅ Implemented — 2026-10-29, units 1–3
- **Domain:** cross-domain
- **Phase:** 4 — Enforcement
- **Verified:** 2026-10-29
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0063](../../adr/0063-every-public-route-is-classified-for-rate-limiting-in-one-registry.md), [CHANGELOG PR-55](../../CHANGELOG.md), [TESTING.md](../../TESTING.md), [error-tracking](../error-tracking/)

> Technical approach and decisions. No code — references to existing code only.

## Approach

Three failure modes that PR-55 treated identically get separated, and the seam that PR-81 left in `src/lib/rate-limit/index.ts` is where they separate.

**Unconfigured** is a configuration error, and configuration errors belong at build and boot. **Unreachable** is a transient runtime fault and must stay fail-open, because a vendor incident must not become a store outage. **Not applicable** — local development — is neither a fault nor a silent gap: it gets a real limiter that happens to be in-process.

That third case is what makes the first tractable. Once local development has a working limiter of its own, requiring the shared one in every deployed environment costs a developer nothing, so "production might be unlimited" stops being a state the system can reach.

The fourth gap is coverage. Limits used to be added handler by handler, with numbers typed at each call site, so an endpoint nobody thought about had none. One registry classifies every public route, and a scanning test fails any route it does not name (ADR-0063).

## Prior art

Rails' `rack-attack` declares every throttle in one initializer; Django REST Framework sets throttle classes per view with a project default; API gateways (Kong, AWS usage plans) attach a plan per route. We follow the declared-in-one-place shape, but default-deny: a default limit hides the routes nobody thought about, while a scan that refuses an unnamed route makes someone decide. Sliding-window counters in Redis keyed by caller are the field's standard store; `@upstash/ratelimit` is that.

## Technical decisions

- D1 — **The backend is chosen by an application-named environment, not by a vendor variable and not by whether keys happen to be present.** `APP_ENV` (`server/shared/app-env.ts`) says `local`, `preview` or `production`; the deployed values make the shared Upstash limiter at `src/lib/rate-limit/upstash.ts` mandatory. Selecting on key presence was the PR-55 design; selecting on `VERCEL_ENV` would let a host change reclassify production as local ([ADR-0037](../../adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md) D2).
- D1a — **Local uses the in-process limiter** at `src/lib/rate-limit/memory.ts`, which reaches no network (spec R4).
- D1b — **Exercising the shared store from CI through a local Upstash-compatible proxy** is parked (Q13). The adapter is unit-tested against a stubbed client instead.
- D2 — **Configuration is checked at build and at boot, not per request.** `next.config.ts` and `src/instrumentation.ts` both call the seam's configuration assertion: deployed with a missing value throws, so the build fails and the deploy does not go live (A3); local passes, and the in-process limiter warns once on first use (A2). The boot check also runs `validateEnv()` (`src/lib/env.ts`), which reports the rest of its list without refusing (Q11).
- D3 — **Runtime unreachability keeps failing open, loudly.** Fail-closed would turn an Upstash incident into downtime for every signup and checkout (spec R5). The error is logged per occurrence; the alert arrives with [error-tracking](../error-tracking/) (Q14).
- D4 — **The caller's address comes from a configured trusted-proxy header** (`RATE_LIMIT_CLIENT_IP_HEADER`, Q12), required when deployed. `x-forwarded-for` is supplied by the caller, so reading it is decoration (spec R7, A5). A deployed request without the configured header is reported, not silently bucketed.
- D5 — **The two parked implementations converge on one interface.** `RateLimiter` in the seam is the contract; the bespoke helpers and the older address readers in `memory.ts` and `upstash.ts` are deleted.
- D6 — **429 travels in the shared envelope.** The refusal is a `DomainError` with status 429 that `toErrorResponse` answers, adding `Retry-After` and `X-RateLimit-*`, so `useServerForm` shows the "try again in N minutes" message inline (ADR-0013).
- D7 — **The memory limiter is bounded**: it sweeps expired windows and then evicts the oldest once it holds its maximum number of callers.
- D8 — **The store's configuration is named for what it holds**: `RATE_LIMIT_STORE_URL` and `RATE_LIMIT_STORE_TOKEN`, with the Upstash integration's `KV_REST_API_*` names read as a fallback for one release (Q17).
- D9 — **One registry classifies every public route.** `src/lib/rate-limit/registry.ts` maps each `"<METHOD> /api/<path>"` (Q16) to a policy or to an exemption with its reason. Policies are a closed set declared once, with their budgets, in `src/lib/rate-limit/policies.ts`; a handler names its route, never a number. "Public" means outside `/api/admin` and `/api/org`, which their portal guards cover (Q15).
- D10 — **A scanning gate holds it.** `tests/unit/rate-limit-registry.test.ts` derives every public route and method from `src/app/api/**/route.ts` and fails a route with no entry, an entry with no route, and a limited route whose handler (or the file the entry names) does not call the limiter with its own key. It asserts it scanned, and is mutation-tested before it is trusted ([ADR-0056](../../adr/0056-a-gate-against-existing-debt-is-a-ratchet.md)).
- D11 — **One helper is the only way a handler is limited.** `limitRequest` takes the request, the route's registry key and the account if any, and returns the 429 response or nothing. Sign-in is limited inside the credentials provider through the same check, because next-auth's client parses its own response shape (Q3).

## Packages

None. `@upstash/ratelimit` and `@upstash/redis` are already in [DEPENDENCIES.md](../../DEPENDENCIES.md).

## Gates touched

- New gate `rate-limit-registry` (D10); `rate-limit-detached` is retired with the detachment it asserted.
- New routes: none. New `CLAUDE.md`: none.

## Data model

None.

## API / contract changes

None to DTO shapes. The 429 body moves from a bespoke `{ error, retryAfter }` onto the envelope in [CONTRACTS.md](../../CONTRACTS.md); nothing in the client read `retryAfter`.

## Test plan

- Unit — backend selection: `local` yields the in-process limiter and never constructs a Redis client; `preview` and `production` the shared one; no vendor variable changes the answer. Mutation: selector pointed at key presence.
- Unit — configuration assertion: throws when deployed with a value missing; passes locally with nothing, and deployed with everything. Mutation: preview left unasserted.
- Unit — the address seam: the configured header is honoured, a forged `x-forwarded-for` ignored (A5), a deployed request without it reported. Mutation: `x-forwarded-for` read first.
- Unit — the memory limiter: refuses past its budget, reopens after its window, stays bounded (D7). Mutation: bound removed.
- Unit — fail-open: a throwing store allows and logs (A4). Mutation: rethrow.
- Unit — the registry gate (A6). Mutations: an entry removed, a limiter call removed or given another key, an unclassified route added.
- Route — signup and order lookup refuse in the envelope with `Retry-After` (A1, A2); the coupon quote refuses the 21st code and does not count a codeless quote (A7). Mutation: codeless quotes counted.

## Delivery (PRs)

Three units.

1. **The boot gate and the seam** — configuration assertion at build and boot, environment-driven selection, the address header, the bounded memory limiter, the envelope refusal, the two parked files converged. Behaviour change: a deployed environment without configuration is refused.
2. **The registry, the gate and the helper** — policies, registry and `limitRequest`; every existing call site moved onto it and its 429 onto the envelope.
3. **The unlimited routes** — every public route spec R1 names that had no limit (sign-in, reset, resend, change-password, verify-email, payment confirmation, coupon quote, checkout previews, bids, review and account writes).

## Open questions

None. Preview enforces exactly as production does (spec R3); the remaining choices are logged in [decisions.md](decisions.md).
