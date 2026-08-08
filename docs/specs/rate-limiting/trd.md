# TRD — rate-limiting

- **Status:** Draft
- **Domain:** cross-domain
- **Phase:** 4 — Enforcement
- **Verified:** 2026-08-09
- **References:** [spec.md](spec.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [CHANGELOG PR-55](../../CHANGELOG.md), [TESTING.md](../../TESTING.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach

Split the two failure modes PR-55 currently treats identically. **Unconfigured** is a configuration error, and configuration errors belong at boot: `validateEnv()` (`src/lib/env.ts`) already names `KV_REST_API_URL`/`KV_REST_API_TOKEN` as required but is called by nothing — wire it to run at startup, strict in production, warn-only elsewhere. **Unreachable** is a transient runtime fault: keep PR-55's fail-open-and-log, because an Upstash outage must not become a store outage. Once the boot gate exists, "silently unlimited in production" stops being a reachable state, and the runtime fail-open is only ever covering a genuine outage.

## Technical decisions

- D1 — **Configuration is checked at boot, not per request.** `validateEnv()` runs from Next's `instrumentation.ts` `register()` hook. In production (`VERCEL_ENV === "production"`) a missing required key throws — the deploy fails. In dev/preview it logs one warning listing what's missing and continues (R3; local dev has no KV keys by design).
- D2 — **Runtime unreachability keeps failing open, loudly** (`src/lib/rate-limit.ts` behaviour from PR-55, unchanged). Fail-closed here was considered and rejected: the limiter is a backstop against abuse, not an authorisation gate, and closing on outage converts a vendor incident into downtime for every signup and checkout (spec R4).
- D3 — **429 travels in the shared envelope.** The handlers currently build a bespoke `{ error }` JSON with rate-limit headers by hand (e.g. `src/app/api/auth/signup/route.ts`). Move the refusal through `toErrorResponse` so `useServerForm` renders it inline like any other refusal (ADR-0013), preserving the `Retry-After` / `X-RateLimit-*` headers and the `formatTimeRemaining` message.
- D4 — **The unconfigured fail-open path stays for non-production** — one-time warning, requests allowed — since D1 guarantees production can never reach it.

## Packages

None. `@upstash/ratelimit` and `@upstash/redis` are already in [DEPENDENCIES.md](../../DEPENDENCIES.md).

## Data model

None.

## API / contract changes

None to DTO shapes. The 429 body moves from a bespoke shape onto the existing error envelope already documented in [CONTRACTS.md](../../CONTRACTS.md) — clients using `readApiError` are unaffected; verify nothing parses the old bespoke body.

## Test plan

- Unit — `validateEnv`: throws in production with keys missing; warns and continues in dev; passes clean when all present.
- Unit — the fail-open wrapper: unconfigured → allowed with one-time warning; limiter throws → allowed and logged; configured → result passed through untouched.
- Route — a limited request returns 429 in the envelope shape with `Retry-After` set (guard test alongside the existing envelope suites per TESTING.md).

## Delivery (PRs)

One PR. The behaviour change is the boot gate: a production deploy without KV keys goes from silently unlimited to refused. The 429-envelope conversion rides along since it touches the same handlers (ADR-0013 makes conversion obligatory on touch anyway).

## Open questions

- Q1 — Should Preview enforce like production? Preview points at real infrastructure but sees no abuse traffic; current stance (warn-only) is the draft answer — close on acceptance.
- Q2 — `validateEnv`'s required list includes more than the KV keys; wiring it at boot enforces all of them at once. Confirm every listed key is genuinely present in prod before merging, or the deploy that adds the gate fails on an unrelated key.
