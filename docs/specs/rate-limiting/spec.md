# Spec — rate-limiting

- **Status:** Draft
- **Domain:** cross-domain (guards identity, payments, checkout, cart handlers)
- **Phase:** 4 — Enforcement
- **Verified:** 2026-08-09
- **References:** [trd.md](trd.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [CHANGELOG PR-55](../../CHANGELOG.md), [OPERATIONS.md](../../OPERATIONS.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

Rate limiting on the store's sensitive endpoints is genuinely enforced in production, and any environment where it is *not* enforced says so — loudly, at deploy time, not silently at request time.

## Why

PR-55 made the limiter fail open when its backing service is unconfigured or unreachable, to stop signup returning a raw 500 before it could even validate. That was an unblock, not a posture: as it stands, a production deploy with missing keys would ship a store whose signup, password-reset, and payment endpoints accept unlimited attempts, and the only trace would be one console warning nobody is watching. A backstop that can silently not exist is not a backstop.

## Requirements

- R1 — Production traffic on abuse-prone endpoints (account creation, password reset, payment creation, order creation) is rate limited, and "the limiter happens to be disabled" is not a state production can silently be in.
- R2 — A production deploy that cannot enforce limits (configuration absent) is refused or flagged at deploy/boot time — the failure surfaces to the operator, not to a request path.
- R3 — Local development needs no limiter configuration; nothing 500s or nags beyond a single clear warning that limiting is off.
- R4 — A transient outage of the limiter's backing service never takes the store down: requests proceed, the outage is visible in logs.
- R5 — A rate-limited user gets a clear refusal saying when to retry, delivered the same way every other refusal is (inline on the form, not a raw error page).

## Product acceptance

- A1 — Hammering signup from one address in production yields a friendly "try again in N minutes" on the form, not a success and not a raw error.
- A2 — A fresh clone with no keys runs signup locally, first request logging one warning that limiting is disabled.
- A3 — A production deploy missing the limiter's configuration does not go live silently.
- A4 — With the limiter's backing service down in production, customers can still sign up and check out; the logs show why limits weren't applied.

## Out of scope (this feature)

- Structured logging, alerting, and error tracking — Phase 5 ([BACKLOG](../../BACKLOG.md)).
- Per-account (vs per-address) limits, and limits on admin/org portal endpoints.
- Choice of rate-limit provider — Upstash is already integrated and is not being revisited here.
