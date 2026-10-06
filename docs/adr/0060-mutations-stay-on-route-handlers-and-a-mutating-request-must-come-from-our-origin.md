# ADR-0060: Mutations stay on route handlers, and a mutating request must come from our origin

- **Date:** 2026-10-05
- **Status:** Accepted. Corrects the CSRF premise in [ADR-0048](0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md)'s alternatives.

## Context

[ADR-0048](0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md) rejected Next.js Server Actions "for now", saying route handlers "carry CSRF checks". A `/bb-brainstorm` on 2026-10-02 and the review of 2026-10-05 found that premise false: `src/lib/csrf.ts` existed and had zero callers. The only thing standing between a hostile page and `POST /api/cart` was the browser's default `SameSite=Lax` on the session cookie — adequate for top-level navigations, unverified for anything else, and never written down.

The brainstorm also found what Server Actions would cost here: an error model built on *returned* values where ours throws `DomainError` into one envelope; action IDs that rotate per deploy, so a buyer with the Razorpay modal open across a deploy sees "Failed to find Server Action"; one action at a time per tab; a 1 MB body cap that uploads through the server would hit; and three gates (`request-body-parsing`, `portal-boundary`, `route-reachability`) built around route files. What they would give — a built-in Origin check and one round trip — can be had without them.

## Decision

1. **Mutations stay on route handlers**, called through `*ApiClient` modules (ADR-0048). Server Actions are not adopted. The trigger to revisit is a feature that is mostly form-driven page flows with no client state and no payment step.
2. **Every mutating request to `/api/**` must come from our own origin.** `src/middleware.ts` refuses `POST`, `PUT`, `PATCH` and `DELETE` whose `Origin` (or, absent that, the `Referer`'s origin) is not the request's own origin, computed the way `server/shared/app-url.ts` computes it — never a hardcoded host. `Sec-Fetch-Site: same-origin` is accepted as sufficient when present.
3. **Two exemptions, both named in code:** routes a caller outside the repository reaches (the `EXTERNALLY_CALLED` list in `tests/unit/route-reachability.test.ts` — carrier and gateway webhooks, which are authenticated by signature, not origin), and `/api/auth/**`, where NextAuth carries its own CSRF token.
4. **The predicate is a pure function** in `src/lib/same-origin.ts`, tested against real cases: missing Origin on a POST, a foreign Origin, a forwarded-host deploy, a webhook path, a GET. The refusal is a 403 in the standard error envelope's shape, built by hand in the middleware: `toErrorResponse` would pull Zod and domain code into the edge bundle for one constant.
5. **`src/lib/csrf.ts` is deleted.** A protection nobody calls is worse than none, because it is cited as if it worked.

## Alternatives considered

- **Server Actions for every mutation.** The framework's direction, and it would delete most clients. Rejected for the costs above; the one protection it adds for free is decision 2.
- **Double-submit CSRF token** — what `csrf.ts` implemented. Rejected: it needs a header on every client request and a cookie dance, to defend against the same attack an Origin check refuses in one comparison. Browsers have sent `Origin` on cross-site mutating requests for a decade.
- **Rely on `SameSite=Lax` alone** — what we had. Rejected: a defence that is a browser default, unverified in production, and invisible in the code is not a decision; it is luck.

## Consequences

- ✅ A cross-site page cannot make a signed-in buyer's browser mutate anything, and the rule is one readable function.
- ✅ ADR-0048 stands on true premises: one request door, typed clients, shared schemas — plus an Origin check.
- ⚠️ A legitimate caller from another origin (a future mobile app, a partner) must either be a webhook with a signature or be added to the exemption with a reason. That is the correct friction.
- ⚠️ A proxy or CDN that rewrites `Host` without `X-Forwarded-Host` would refuse every mutation. `app-url.ts` already handles the deploy's headers; a new host is a deployment fact ([ADR-0037](0037-the-host-is-a-deployment-fact-not-an-architectural-input.md)) that must keep them.
