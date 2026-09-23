# TRD — error-tracking

- **Status:** Draft
- **Domain:** cross-domain
- **Phase:** 5 — Scale & operability
- **Verified:** 2026-09-21
- **References:** [spec.md](spec.md), [rate-limiting](../rate-limiting/), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [DEPENDENCIES.md](../../DEPENDENCIES.md), [OPERATIONS.md](../../OPERATIONS.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach

Sentry's free tier, wired **server-side only**, plus the error boundaries the app has never had.

Server-side only is the load-bearing part of that sentence. It buys every requirement except R4's recording half at zero cost to the client bundle, which matters on a store that has already stripped link prefetching from sixty-one sites to protect mobile load. The browser SDK is the expensive half of Sentry and the least necessary: the boundaries required by R4 can report through a route on our own origin, so a client fault still reaches the tracker without shipping a vendor SDK to every shopper.

The alternative of keeping logs and adding structure was considered seriously and rejected on hosting facts rather than preference. The current plan's runtime logs are short-lived and log forwarding is a paid tier, so better-formatted logs would improve how a fault reads without changing whether anyone ever reads it. Structure addresses legibility; the spec's problem is retention and notification.

## Technical decisions

- D1 — **Server-side SDK only.** No browser SDK, no tunnel route for one, no `NEXT_PUBLIC_` DSN. R8 is a requirement, not an aspiration, and a public DSN is also an open capture endpoint on someone else's quota.
- D2 — **Capture happens at the places faults already converge**, not at fifty-seven call sites. `toErrorResponse`'s final branch is the single funnel for unhandled route faults; `instrumentation.ts` (introduced by [rate-limiting](../rate-limiting/) D2) registers the SDK and owns `onRequestError`. Both are already the choke points, so nothing new is threaded through the domains.
- D3 — **The deliberate fail-open paths report explicitly**, at warning level: the rate limiter's unreachable branch, the ledger backfill's gap count, and the reconciliation sweep's recovery count. These never throw and so would never be captured otherwise — spec R3 exists because of them, and capturing only what throws would miss the entire reason for the feature.
- D4 — **Bodies are dropped, and identifiers are attached in their place.** Request bodies are never transmitted: this store's payloads are addresses, phone numbers and basket contents, and any filter that must enumerate the safe fields will miss one the day a field is added — the failure is silent and the data is already gone. What replaces them is a deliberately chosen context that makes the record findable rather than present: route, method, status, release, error class, the opaque user and order identifiers, and the *names* of any fields a validation or constraint failure attributed — which `toErrorResponse` already computes, and which are field names rather than values. The operator then looks the record up in a database they own. Logging the key instead of the row is the ordinary answer to this problem, and it means dropping bodies costs almost none of the diagnostic power it appears to.
- D4a — **Vendor-side scrubbing is not relied upon.** The SDK's own personal-data suppression is enabled as a second layer, never as the first — a control whose correctness is enforced in someone else's service is one this project cannot test. D4's stripping happens before transmission, in code with a unit test against it.
- D5 — **`global-error.tsx` and a route-level `error.tsx` land in this PR whatever happens to Sentry.** The app has neither. They are worth having on their own merits, they satisfy R4's shopper-facing half with no vendor involved, and building them first means the tracking decision can be reversed without leaving the store worse off than it is now.
- D6 — **Client faults reach the tracker through our own origin.** The boundary posts to a route handler that captures server-side. This keeps D1 intact, and the route is rate limited like any other public write ([rate-limiting](../rate-limiting/) R1) — an unauthenticated reporting endpoint is otherwise a way to burn the free tier's quota.
- D7 — **Absent configuration means absent capture, silently.** No DSN, no initialisation, no warning — this is the one place the project's usual "a disabled control must announce itself" rule does not apply, because observability failing closed would satisfy R6 by taking the store down. The rate limiter's boot gate is the control that announces itself; this one must not.
- D8 — **The free tier's quota is a design constraint.** Grouping (R2) is what keeps a single hot loop from consuming a month's allowance in an hour; a sampling ceiling on the noisiest issues is the backstop if it does.

## Packages

One new dependency — Sentry's Next.js SDK, server-side configuration only. To be added to [DEPENDENCIES.md](../../DEPENDENCIES.md) with the reason stated as retention and alerting rather than "error tracking", since that is what distinguishes it from the logging the store already has. No package is needed for D5.

## UI approach

Two error pages, mobile-first per [ADR-0015](../../adr/0015-mobile-first-design.md). At ~360px each is a single column: what happened in plain language, a primary action to retry, and a way back to browsing docked where the thumb reaches. Neither page shows a stack trace, an error code the shopper cannot use, or a raw message — the envelope's generic text is deliberate and this must not undo it. `global-error.tsx` renders its own shell, since by definition the layout above it has failed.

## Data model

None.

## API / contract changes

One new route handler for D6's client reports. It is not a DTO any client reads, so [CONTRACTS.md](../../CONTRACTS.md) is unaffected and the PR carries no `[CONTRACT]` flag.

## Test plan

- Unit — scrubbing: an event carrying an address, email, phone number and order total emits none of them; the user id, order id and attributed field names survive (D4).
- Unit — environment: a `preview` deployment initialises no capture.
- Unit — D7: with no DSN the module initialises nothing, captures nothing and logs nothing.
- Unit — D6's route: rejects a malformed report, and is subject to the limiter.
- Route — `toErrorResponse`'s final branch captures once per fault and still returns the unchanged generic envelope, so ADR-0013's contract is untouched.
- Component — the error boundary renders its recovery affordances at 360px and shows no raw message.

## Delivery (PRs)

Two PRs, in this order.

1. **Error boundaries** — `global-error.tsx` and `error.tsx`, no vendor. Independently valuable and independently demoable; the store visibly stops showing a blank failure.
2. **Capture and alerting** — the SDK, the funnel at `toErrorResponse` and `onRequestError`, D3's explicit warnings, scrubbing, and the reporting route. This is the PR that changes behaviour outside the browser, and it is the one whose scrubbing needs the closest review.

## Open questions

None. Alerts go to email, which needs no infrastructure and no maintenance; a chat destination can be added later without changing anything here. Only `production` captures — preview shares the same free-tier quota and its traffic is not a customer's, so spending the allowance on it would trade real signal for rehearsal noise.
