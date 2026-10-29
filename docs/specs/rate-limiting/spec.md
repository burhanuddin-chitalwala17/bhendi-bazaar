# Spec — rate-limiting

- **Summary:** Every public endpoint is classified for rate limiting in one registry, enforced in every deployed environment; a deploy that can't enforce is refused
- **Status:** ✅ Implemented — 2026-10-29, units 1–3
- **Domain:** cross-domain (guards identity, payments, checkout, cart, promotions, bidding handlers)
- **Phase:** 4 — Enforcement
- **Verified:** 2026-10-29
- **References:** [trd.md](trd.md), [decisions.md](decisions.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [CHANGELOG PR-55](../../CHANGELOG.md), [OPERATIONS.md](../../OPERATIONS.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

Rate limiting is done once, for the whole product: every public endpoint is either limited under a named policy or exempt with a reason, the limits are genuinely enforced in every deployed environment, and an environment that cannot enforce them says so at deploy time, not silently at request time.

## Why

PR-55 made the limiter fail open when its backing service is unconfigured or unreachable, to stop signup returning a raw 500 before it could even validate. PR-81 went further and detached it entirely, so that the pretence of protection was at least honest. Both were unblocks, not a posture: today a production deploy accepts unlimited attempts against account creation, password reset, payment creation, coupon codes and guest order lookup, and the only trace is a console warning nobody is watching. A backstop that can silently not exist is not a backstop.

Guest order lookup deserves naming separately. It answers questions about real orders to an unauthenticated caller, so without a limit it is an enumeration oracle over the order book — the highest-severity item here, and the one least visible from the outside. Coupon codes are the same shape: the checkout quote tells anyone whether a code exists (offers-hardening Q9).

The owner asked on 2026-10-29 that this be built once and generalised (Q1): the next module to add an endpoint must not be able to forget it.

## Requirements

- R1 — Abuse-prone endpoints are rate limited: account creation, sign-in, password reset and its email resend, password change, email verification, payment creation and confirmation (including the free-order confirmation and the abandon release), order creation, guest order lookup, the checkout coupon quote, the checkout previews that reach a carrier or the stock (parcel planning, shipping rates, stock check), the contact form, cart and wishlist writes, review writes, and bid placement. "The limiter happens to be disabled" is not a state a deployed environment can silently be in.
- R2 — A deployed environment that cannot enforce limits (configuration absent) is refused at deploy or boot time — the failure surfaces to the operator, not to a request path.
- R3 — Preview and production enforce identically. An environment that is a rehearsal for production must rehearse this too, or the rehearsal is not one.
- R4 — Local development needs no limiter configuration and reaches no external service. Limits still apply within the running process, so a developer can see a 429 without provisioning anything; the weaker guarantee is stated once in the log, not hidden.
- R5 — A transient outage of the limiter's backing service never takes the store down: requests proceed, the outage is visible in logs and raised as an alert.
- R6 — A rate-limited user gets a clear refusal saying when to retry, delivered the same way every other refusal is (inline on the form, not a raw error page).
- R7 — Limits key on the account where one exists and the caller's address otherwise, and the address cannot be chosen by the caller.
- R8 — Every public route handler is classified in one registry: limited under a named policy, or exempt with a reason. A route nobody classified fails the test suite, so a new module cannot ship an unlimited endpoint by forgetting.

## Product acceptance

- A1 — Hammering signup from one address in production yields a friendly "try again in N minutes" on the form, not a success and not a raw error.
- A2 — A fresh clone with no keys runs signup locally, first request logging one warning that limits are per-process; the eleventh rapid attempt is still refused.
- A3 — A deploy to preview or production missing the limiter's configuration does not go live.
- A4 — With the backing service down in production, customers can still sign up and check out; the logs show why limits weren't applied, and an alert fires.
- A5 — Replaying guest order lookup with a rotated `x-forwarded-for` does not reset the caller's budget.
- A6 — Adding a public route handler without classifying it fails a named test, which says which route and where to classify it.
- A7 — The 21st coupon quote from one address within the window gets the friendly refusal; quotes without a code are not counted.

## Scope

- **Outcome:** no public endpoint can be unlimited in a deployed environment without someone having written down why.
- **In:** R1–R8; A1–A7, with A4's alert arriving with error-tracking (Q14).
- **Later:** limits on the admin and org portal handlers, which sit behind an authenticated gate (Q15); the alert half of R5 (Q14, [error-tracking](../error-tracking/), Phase 5); exercising the shared store from CI through a local proxy (Q13); choice of provider — Upstash is already integrated and is not revisited.

## Open questions

None.
