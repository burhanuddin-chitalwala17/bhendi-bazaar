# Spec — error-tracking

- **Summary:** When something fails, somebody finds out — in minutes, with enough detail to act
- **Status:** Draft
- **Domain:** cross-domain
- **Phase:** 5 — Scale & operability
- **Verified:** 2026-09-21
- **References:** [trd.md](trd.md), [rate-limiting](../rate-limiting/), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md), [OPERATIONS.md](../../OPERATIONS.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

When something fails in the store, somebody finds out — within minutes, with enough detail to act, and without having been watching at the moment it happened.

## Why

The store records faults and notifies nobody. `toErrorResponse` logs every unhandled route error in full and returns a generic message; fifty-seven other sites call `console.error` directly. All of it goes to the platform's runtime log, which on the current hosting plan is short-lived and cannot be forwarded anywhere. A 500 on a paid order at three in the morning is gone before anyone could look for it.

That gap is structural rather than cosmetic, because the system is deliberately full of controls that record a failure and carry on by design. The payment reconciliation sweep exists precisely to recover orders whose gateway webhook was missed, and reports what it recovered to a log. The audit trail is specified never to fail the action it records ([ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md)). The rate limiter is specified to allow requests through when its backing service is unreachable ([rate-limiting](../rate-limiting/) R5). Each of those choices is right, and each of them is only safe if someone is told. A fail-open control with no alarm is a control whose failure reaches the operator through a customer complaint.

There is also a whole class of fault the store cannot currently see at all. Nothing renders an error boundary, so an exception thrown in a shopper's browser — on the checkout page as readily as anywhere else — produces a blank failure for them and no record whatsoever for us. There is no short log to go and read; there is none.

## Requirements

- R1 — A server-side fault is captured with its stack, the request that caused it, and the release it occurred in, and is retained long enough to investigate days later.
- R2 — Faults are grouped, so a recurring one is visible as "this, N times, since that deploy" rather than as N unrelated lines.
- R3 — A fault raises an alert that reaches a person who is not already looking. This includes the fail-open paths named above, which are not exceptions and would otherwise never qualify.
- R4 — A failure in the shopper's browser is both shown to them as something recoverable — an error page they can retry or navigate out of — and recorded for us.
- R5 — Nothing captured leaves the shopper's personal data exposed. Addresses, email addresses, phone numbers, order contents and amounts are scrubbed before anything is transmitted.
- R6 — Capturing a fault never causes one. If the capture service is unreachable or misconfigured, the request path is unaffected and the store behaves exactly as it does today.
- R7 — Local development is unaffected: no account, no key, no network call, and no noise in the terminal beyond what the developer already sees.
- R8 — The store carries no measurable extra weight on a phone for this. Observability is for operators, and buyers should not pay for it in page load.

## Product acceptance

- A1 — An unhandled fault on a checkout route produces an alert within minutes, naming the route, the release and the number of shoppers affected.
- A2 — The same fault occurring forty times appears as one grouped issue with a count, not forty notifications.
- A3 — An inspection of a captured fault shows no address, email, phone number or order amount anywhere in it.
- A4 — A component throwing during render shows the shopper a page offering a way onward, and the fault appears in the tracker.
- A5 — With the capture service unreachable, a normal order still completes.
- A6 — A fresh clone runs with no tracking configuration and captures nothing.

## Out of scope (this feature)

- Performance monitoring, tracing and session replay. This feature is about faults; each of those is a separate cost and a separate decision.
- Uptime and synthetic checks from outside the deployment.
- Business alerting — an unusual rate of failed payments is a product signal, not a fault, and belongs with analytics.
- Structured logging as a project-wide convention. Related, larger, and not required for any requirement here.
