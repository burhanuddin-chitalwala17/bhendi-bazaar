# CLAUDE.md — route handlers

- **Verified:** 2026-10-25
- **Covers:** `src/app/api/**`

> Read the root [`/CLAUDE.md`](../../../CLAUDE.md) first. Its seven Invariants are hard blocks here more than anywhere: this is where an untrusted request becomes a write.

A route handler is the HTTP boundary and nothing else. It does four things, in this order: authorize, parse, delegate, and answer. Business rules live in `server/<domain>/`; reads a server component can do never need a handler.

## The four steps

1. **Authorize by portal.** `/api/admin/**` calls `requirePlatformAdmin` (`src/lib/admin-auth.ts`). `/api/org/**` is defined through `withOrg` (`src/lib/org-auth.ts`), the only thing that can hand a handler an org scope. Neither tree borrows the other's authority. `tests/unit/portal-boundary.test.ts`
2. **Parse, never cast** (Invariant 4). Validate the body with a schema from `src/lib/validation/schemas/` via `validateRequest`, and never write `as T` on `request.json()`. Define the schema in that folder, not inline, so the form can use the same one through `useServerForm`. Whitelist fields symmetrically on create and update, and never accept a server-owned field. `tests/unit/request-body-parsing.test.ts`
3. **Delegate to a service.** Call `server/<domain>/*.service`, never Prisma or a repository. Invariant 5: a table is reached through one repository. A handler that touches `prisma.*` gives the same row two shapes.
4. **Answer in the envelope.** Errors go out through `toErrorResponse` (`src/lib/api-error-response.ts`). A message reaches the user only as a `DomainError` ([ADR-0013](../../../docs/adr/0013-one-error-envelope-and-useserverform.md)). Never build `{ error }` by hand.

## Every route has a caller

A handler exists because a browser must call it: a mutation, or a read triggered by interaction ([ADR-0034](../../../docs/adr/0034-render-on-the-server-by-default.md)). Its caller is an `*ApiClient` in `src/components/<domain>/` ([ADR-0048](../../../docs/adr/0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md)). A caller outside the repository, such as a gateway webhook or a link in an email, is named in `EXTERNALLY_CALLED` with who calls it. `tests/unit/route-reachability.test.ts`

## Money and payment

- **A price, total or amount in the body is discarded.** The server recomputes it from `Product.price` through the one effective-price resolver (Invariant 1, [ADR-0018](../../../docs/adr/0018-one-effective-price-function.md)).
- **`paymentStatus` is written only by the handler that verified a gateway signature** with `crypto.timingSafeEqual` and matched the amount (Invariant 2).
- **A webhook that cannot match its payload answers non-2xx.** A silent success is how a dead payment path stays invisible.
