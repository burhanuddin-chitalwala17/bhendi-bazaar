# ADR-0063: Every public route is classified for rate limiting in one registry

- **Date:** 2026-10-29
- **Status:** Accepted
- **Context:** Rate limits were added handler by handler, with a budget typed at each call site. Coverage was whatever someone remembered: when the limiter was reconnected for [rate-limiting](../specs/rate-limiting/), more than twenty public handlers had never had a limit, among them password reset, payment confirmation and the checkout coupon quote, which tells anyone whether a code exists. The owner asked on 2026-10-29 that limiting be done once, so a module added later cannot ship an unlimited endpoint by forgetting ([decisions Q1](../specs/rate-limiting/decisions.md)).
- **Decision:**
  1. **One registry**, `src/lib/rate-limit/registry.ts`, classifies every public route method (everything outside `/api/admin` and `/api/org`): limited under a named policy, or exempt with a reason sentence.
  2. **Policies are a closed set declared once with their budgets**, `src/lib/rate-limit/policies.ts`. A handler names its route; it never states a number.
  3. **One helper limits a handler**, `limitRequest` in `src/lib/rate-limit/index.ts`, keyed by the route's registry entry and typed so only a limited route's key compiles.
  4. **A scanning test holds it**, `tests/unit/rate-limit-registry.test.ts`: it derives routes from the file tree and fails an unclassified route, an entry with no route, and a limited route that never calls the limiter with its own key.
- **Alternatives considered:**
  - *A wrapper per route* (`export const POST = limited(policy, handler)`) — rejected. It is the conventional shape and reads well at the call site, but nothing notices a route that was never wrapped, which is exactly the failure being fixed; the budgets also scatter across files again.
  - *Middleware only* — rejected. `src/middleware.ts` runs on the edge before the session is known, so it can key only on address, not account (spec R7), and it cannot see whether a coupon quote carries a code. It would also put the store's client in every request's path, pages included.
  - *A default limit for any unlisted route* — rejected. It hides the routes nobody thought about, which is the decision this makes someone take; a signed webhook given a default limit fails silently on a gateway's retry burst.
- **Consequences:**
  - ✅ A new public route fails the suite until someone decides its limit or writes down why it has none.
  - ✅ Budgets are reviewable in one file, and changing one moves every route under that policy.
  - ⚠️ The gate checks that the handler calls the limiter, not where in the handler. A limit placed after an expensive step still passes; review catches that.
  - ⚠️ The registry is a list to edit for every new route. That is the point, and the test's message says where.
