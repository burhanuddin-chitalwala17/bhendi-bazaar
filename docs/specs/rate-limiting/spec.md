# Spec — rate-limiting

- **Summary:** Sensitive endpoints are rate limited in every deployed environment; one that can't enforce is refused at deploy time
- **Status:** Draft
- **Domain:** cross-domain (guards identity, payments, checkout, cart, bidding handlers)
- **Phase:** 4 — Enforcement
- **Verified:** 2026-09-21
- **References:** [trd.md](trd.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [CHANGELOG PR-55](../../CHANGELOG.md), [OPERATIONS.md](../../OPERATIONS.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

Rate limiting on the store's sensitive endpoints is genuinely enforced in every deployed environment, and any environment where it is *not* enforced says so — loudly, at deploy time, not silently at request time.

## Why

PR-55 made the limiter fail open when its backing service is unconfigured or unreachable, to stop signup returning a raw 500 before it could even validate. PR-81 went further and detached it entirely, so that the pretence of protection was at least honest. Both were unblocks, not a posture: today a production deploy accepts unlimited attempts against account creation, password reset, payment creation and guest order lookup, and the only trace is a console warning nobody is watching. A backstop that can silently not exist is not a backstop.

Guest order lookup deserves naming separately. It answers questions about real orders to an unauthenticated caller, so without a limit it is an enumeration oracle over the order book — the highest-severity item here, and the one least visible from the outside.

## Requirements

- R1 — Abuse-prone endpoints are rate limited: account creation, sign-in, password reset and its email resend, email verification, payment creation, order creation, guest order lookup, cart writes, and bid placement. "The limiter happens to be disabled" is not a state a deployed environment can silently be in.
- R2 — A deployed environment that cannot enforce limits (configuration absent) is refused at deploy or boot time — the failure surfaces to the operator, not to a request path.
- R3 — Preview and production enforce identically. An environment that is a rehearsal for production must rehearse this too, or the rehearsal is not one.
- R4 — Local development needs no limiter configuration and reaches no external service. Limits still apply within the running process, so a developer can see a 429 without provisioning anything; the weaker guarantee is stated once in the log, not hidden.
- R5 — A transient outage of the limiter's backing service never takes the store down: requests proceed, the outage is visible in logs and raised as an alert.
- R6 — A rate-limited user gets a clear refusal saying when to retry, delivered the same way every other refusal is (inline on the form, not a raw error page).
- R7 — Limits key on the account where one exists and the caller's address otherwise, and the address cannot be chosen by the caller.

## Product acceptance

- A1 — Hammering signup from one address in production yields a friendly "try again in N minutes" on the form, not a success and not a raw error.
- A2 — A fresh clone with no keys runs signup locally, first request logging one warning that limits are per-process; the eleventh rapid attempt is still refused.
- A3 — A deploy to preview or production missing the limiter's configuration does not go live.
- A4 — With the backing service down in production, customers can still sign up and check out; the logs show why limits weren't applied, and an alert fires.
- A5 — Replaying guest order lookup with a rotated `x-forwarded-for` does not reset the caller's budget.

## Out of scope (this feature)

- Structured logging and error tracking — [error-tracking](../error-tracking/), Phase 5. R5's alert depends on it.
- Read caching — [read-caching](../read-caching/), Phase 5. Unrelated mechanism despite both being "the cache".
- Per-endpoint limits on the admin and org portal handlers, which sit behind an authenticated gate.
- Choice of provider — Upstash is already integrated and is not being revisited here.
