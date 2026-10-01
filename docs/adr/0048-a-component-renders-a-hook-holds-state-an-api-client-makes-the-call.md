# ADR-0048: A component renders, a hook holds state, an API client makes the call

- **Date:** 2026-10-02
- **Status:** Accepted

## Context

The front end is meant to be layered: tokens → `globals.css` → `ui/` primitives → `shared/` wrappers → domain composites → pages. Only the visual half of that was enforced ([ADR-0022](0022-design-decisions-go-through-tokens.md), [ADR-0031](0031-one-components-home-organised-by-domain.md)). The behaviour half was written nowhere, and on 2026-10-02 it looked like this:

- **49 `fetch` calls in 42 components**, plus 8 in hooks. The sequence "fetch, check `ok`, `readApiError`, parse" was hand-written about 40 times. A generic `call(url, init)` helper was re-invented four times.
- **API clients lived in three places**: `src/services/` (grouped by layer, and by audience under `services/admin/`), co-located `*ApiClient.ts` files, and inline. They were named `*ApiClient` or `*Service`, and some showed toasts themselves.
- **The cost was real defects, not tidiness.**
  - `cart-line-items` parsed an error body as stock rows because it never checked `ok`.
  - Two search pickers let an older reply overwrite a newer one.
  - The bulk wizards dropped row-level error details.
  - Four components read the error envelope by hand instead of through `readApiError` ([ADR-0013](0013-one-error-envelope-and-useserverform.md)).
- **One component (`OrdersTable`) was typed by `@prisma/client`'s `Order`**, so the page handed it the whole order row, every column of it. The boundary test missed it twice:
  - it checked only the Prisma *client* path, never `@prisma/client`;
  - it exempted type-only imports, applying [ADR-0033](0033-a-domain-is-reached-through-its-public-surface.md) D5, which was written for imports between server domains.

Each of the 49 sites was classified before this was decided. **None needed to own its request**: no upload progress, streaming or polling. The bulk wizards' presigned uploads already go through `src/lib/image/upload-direct.ts`.

## Decision

1. **A component renders; a hook holds state; an API client makes the request.**
   - A server page reads through `src/data-access-layer/` and passes props ([ADR-0034](0034-render-on-the-server-by-default.md)).
   - A client component gets behaviour from a hook: `useServerForm`, `useMutation`, `useAsyncData`, or a domain hook built on them.
2. **`fetch` appears only in an API-client module.** That means a file named `*ApiClient.ts`, plus two named exceptions:
   - `src/lib/api-client.ts`, the one request helper;
   - `src/lib/image/upload-direct.ts`, which talks to the object store rather than to our API.

   No component, hook, context or store calls `fetch`.
3. **An API client lives with its domain**, in `src/components/<domain>/`, beside the components that use it ([ADR-0031](0031-one-components-home-organised-by-domain.md) D4).
   - It is named `<thing>ApiClient` ([ADR-0003](0003-one-repository-per-aggregate.md) D4).
   - It sends through `apiRequest` and throws `ApiError`.
   - It never shows a toast or navigates; those are the caller's decisions.
   - `src/services/` is dissolved.
   - A URL that varies by portal (admin vs org) is a parameter of the client function, not a reason for the component to own the call.
4. **A component's types are DTOs, never rows.**
   - A component never imports `@prisma/client` or a repository, type-only included.
   - Its shapes come from a domain's `*.types` or `src/domain/`.
   - This narrows ADR-0033 D5 for components only. A type is erased, but a component typed by a row is handed the row.
5. **Enforced by tests, with no allowlist:**
   - `tests/unit/module-boundaries.test.ts` enforces D4;
   - `tests/unit/api-clients.test.ts` enforces D2 and D3.

   Every existing site was movable, so an exception list would only have recorded unfinished work.

## Alternatives considered

- **Keep `src/services/`.** It holds most of the clients today. Rejected: it groups by layer, and `services/admin/` by audience. ADR-0012 refused both axes for `server/` and ADR-0031 refused them for components. Co-location by feature is also what the two most-cited React structures do (bulletproof-react's `features/*/api`, Feature-Sliced Design's `api` segment).
- **Server Actions for mutations.** This is the direction Next.js's App Router points, and it would delete most clients outright. Rejected for now, not forever: route handlers carry CSRF checks, rate limits, the `route-reachability` caller check and `useServerForm`'s error envelope. Moving all of that is its own decision and needs its own `/bb-brainstorm`, not a side effect of a cleanup.
- **A data-fetching library (TanStack Query, SWR).** Rejected for now. Pages are server components that refresh with `router.refresh()`, so there is little client cache to manage. The three hooks cover the cases that exist, once `useAsyncData` cancels stale requests.
- **A ratchet allowlist of today's offenders.** This is the usual shape here (ADR-0033 D6). Rejected because the classification found no site that needs it.

## Consequences

- ✅ One place per request. The envelope is read the same way everywhere, and the race and parse defects above close with the move.
- ✅ "May this component call the network?" has a mechanical answer: no.
- ✅ A component's props say what it shows. A new column on a table cannot leak to the browser by default.
- ⚠️ A one-off request now needs a client function and usually a hook: two small files where there was one inline call.
- ⚠️ Server Actions stay an open question, and this ADR is what a future one would supersede.
