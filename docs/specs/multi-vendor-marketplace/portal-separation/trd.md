# TRD — portal separation

- **Status:** Draft
- **Domain:** cross-domain
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-08
- **References:** [spec.md](spec.md), [../spec.md](../spec.md), [../portal-split.md](../portal-split.md), [../organisations-and-membership](../organisations-and-membership/), [ADR-0013](../../../adr/0013-one-error-envelope-and-useserverform.md), [CONTRACTS.md](../../../CONTRACTS.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Three route groups, and one question answered per request: *may this person act here, and for whom?*
The answer carries the scope with it, so authorization and filtering are the same act rather than two
steps a handler could do one of.

`(admin)` keeps its name and loses the pages whose audience is a vendor. `(org)` is new and every path
under it names its organisation. Which page goes where is settled in
[../portal-split.md](../portal-split.md); this document is about the check.

## Technical decisions
- **D1 — Two independent authorization axes, and `User.role` stays.** `User.platformRole` (`USER` | `ADMIN`) answers "do I run the platform"; `OrgMember.role` (`owner` | `staff`) answers "what may I do inside this org". They are different in kind — one platform exists, so platform capability is a property of a person and needs no join; membership is a property of a relationship. Expressing platform-admin as membership of a sentinel "platform org" was rejected: its id becomes a magic constant every authorization path must know, and every org query grows an "unless it is that one" branch.
- **D2 — `User.role` is renamed `platformRole` and becomes a declared union.** It is a bare `String` today with a runtime `["USER","ADMIN"].includes()` in `server/identity/admin.user.service.ts:53` and the literal `"ADMIN"` repeated in eight places. Once `OrgMember.role` exists, an unqualified `role` means two things — which is how `ProductFlag` drifted. Kept as an enum rather than collapsed to a boolean: a read-only platform support role is a plausible third value, and a boolean forecloses it.
- **D3 — Membership is checked where the data is read, not in middleware.** Middleware proves only that someone is signed in: it reads the JWT via `getToken` (`src/middleware.ts:104`) and cannot query Postgres, because the `pg` adapter needs Node sockets and middleware runs on the edge. Membership is also revocable between sign-in and the request, so a token claim would keep asserting access after [../org-team](../org-team/) removed it. Trusting the token for `platformRole` is acceptable — it changes rarely and its blast radius is the platform portal — and is not acceptable for membership.
- **D4 — The authorization helper returns the scope, not a boolean.** It resolves the session user and the org from the path, and yields the membership — including the `orgId` that every subsequent query filters on. A boolean would leave the filter as a separate step someone can omit, and an omitted filter is a cross-vendor leak. Returning the scope makes being authorized and being scoped one act. Same reasoning as `useServerForm`, where the correct thing is the only convenient thing ([ADR-0013](../../../adr/0013-one-error-envelope-and-useserverform.md)).
- **D5 — It throws `ForbiddenError`, it does not return a response.** `toErrorResponse` turns that into a 403 in the standard envelope. `src/lib/admin-auth.ts` does the opposite today — `verifyAdminSession()` returns `AdminSession | NextResponse`, so every caller discriminates with `instanceof NextResponse`, and it hand-rolls its own error body. Four handlers under `src/app/api/admin/sellers/` skip the helper entirely and inline the check. All of it is migrate-on-contact under ADR-0013 decision 7, and this subfeature is the contact.
- **D6 — No platform-admin bypass into an org portal.** Tempting for support, and rejected: a bypass is an exception inside the filter that must never fail, and exceptions are where leaks live. A platform admin who needs an org's data uses the cross-vendor platform views, which exist for exactly that. An explicit, audited "act as this org" is a separate feature if it is ever wanted, not a branch in the check.
- **D7 — `(session.user as any)` goes.** It appears twice in `src/lib/admin-auth.ts` and four times in the sellers handlers — `any` at an authorization boundary, which [CLAUDE.md](../../../../CLAUDE.md) calls a defect. The session user type is declared once and the augmentation lives with the auth config.
- **D8 — The membership lookup is memoised per request, never cached across requests.** `@@unique([userId, orgId])` is the covering index, so the check is a single index hit; React `cache()` lets several server components on one page share one lookup. Anything longer-lived reintroduces the revocation problem D3 exists to avoid.
- **D9 — Org pages are server components by default.** The portal is lists and forms over data the server already has, so the org id in the path is read server-side and the data fetched through `src/data-access-layer/` — no client `fetch("/api/org/...")` for a read. 62 files currently declare `"use client"` and 36 client call sites hit `/api`; the org portal should not add to either without interactivity earning it ([CLAUDE.md](../../../../CLAUDE.md) — render on the server by default).

## Packages
None.

## Data model
**[MIGRATION]** — `User.role` → `User.platformRole`, renamed in place with hand-corrected SQL rather than the generated drop-and-create. No new tables; `OrgMember` arrives in [../organisations-and-membership](../organisations-and-membership/).

## API / contract changes
**[CONTRACT]** — handlers move between `/api/admin/…` and `/api/org/[orgId]/…` per
[../portal-split.md](../portal-split.md), and their client wrappers move with them. The session shape
changes with D2 and D7. [CONTRACTS.md](../../../CONTRACTS.md) moves in the same PRs.

## Test plan
Per [TESTING.md](../../../TESTING.md). Authorization is the one place where a passing happy path proves
nothing — every test here is an attempt to get at something.

- **Cross-org denial** — a member of org A requesting org B's products, orders, stock and shipments is refused on every one, and the refusal is a 403 in the standard envelope.
- **Revocation takes effect immediately** — a member removed mid-session is refused on the next request, without signing out. This is the test that fails if membership is ever read from the token.
- **No bypass** — a platform admin with no membership is refused an org path (D6), and is not silently granted by the `/admin` check.
- **Scope comes from the check** — a handler given a path org it is not a member of never reaches its query at all.
- **Group boundaries** — a static assertion that nothing under `(admin)` filters by org and nothing under `(org)` reads across orgs, in the manner of `tests/unit/form-error-display.test.ts`. It is the only way a 37-surface split stays split.

## Delivery (PRs)
| PR | Scope | Behaviour |
|---|---|---|
| 1 | `role` → `platformRole`, declared union, `as any` removed, `admin-auth` converted to throw `ForbiddenError` | none — same access, stated once |
| 2 | The org authorization helper, with no pages using it yet | none |
| 3 | `(org)` group and the org-scoped pages and handlers moved out of `(admin)` | **yes — the split** |
| 4 | Platform-only pages confirmed and the group-boundary assertion added | none |

## Open questions
Must be closed before Draft → Accepted.

- Does `/org` with no org id redirect to the first membership, or render a chooser? The first is fewer clicks; the second is honest when someone has several. [../org-portal-chrome](../org-portal-chrome/) may want to own this.
- Should an org path use the org `code` (`SEL-001`) rather than its id, so URLs are legible? It leaks the code to anyone with the URL, which may be fine, and means a code can never change.
- Do platform admins keep a route into the storefront's admin-ish views (abandoned carts, reviews) at the same paths, or do those move too? [../portal-split.md](../portal-split.md) assigns them but not their final URLs.
