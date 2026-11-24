# CONTRACTS.md — client ↔ server DTO contracts

- **Verified:** 2026-11-24
- **Covers:** `src/lib/validation/schemas/*.ts`, `src/app/api/*/`, `src/lib/api-error-response.ts`
- **Scope:** shapes that cross the browser/server boundary via `src/app/api/**` route handlers.

## Purpose
In a monorepo the client and server share a type system but **not** a runtime. A shape TypeScript believes is shared still travels as JSON, so anything the compiler cannot see — a `Date` arriving as a string, a field the server never sends, a cast that silences a mismatch — becomes a runtime problem that compiles cleanly.

This file records the shapes that cross that boundary and is where a breaking change is negotiated. When a DTO here changes, the commit subject is flagged `[CONTRACT]`.

## Rules

1. **One shape per concept, declared once.** A DTO is defined in exactly one module imported by both sides. Two declarations of the same concept drift, and the compiler will not catch it — separately declared string enums with matching values are mutually assignable.
2. **No casts across the boundary.** `as SomeType` on a value that arrived over the wire asserts a shape rather than checking it; parse with Zod ([Invariant 4](../CLAUDE.md)). `as unknown as T` is a hard block — it is a deliberate defeat of the type system.
3. **Timestamps cross as ISO strings.** JSON has no date type. A wire DTO types them `string`; conversion to `Date` is explicit and at the point of use.
4. **Money crosses as integer paise** ([ADR-0004](adr/0004-money-as-integer-paise.md)) — true since PR-37: every monetary column is `Int` paise and wire money validates as `paiseAmount`. Formatting happens once, in `src/lib/format.ts`. The one asymmetry: **admin product prices arrive as rupees** (`rupeeAmount`, ≤2 decimals — humans type rupees) and convert at the catalog service; a Zod transform could not do it because the same schema validates on both sides (ADR-0013) and would run twice.
5. **The server sends a projection, not a row.** Responses use an explicit `select`. A Prisma model is never returned wholesale — `User` carries `passwordHash` and reset tokens; `ShippingProvider` carries `authToken` and `accountInfo`.
6. **Additive changes preferred.** Add optional fields; never silently change a field's meaning. Removal goes through a deprecation note here, in the DTO's section.
7. **Server-owned fields are never accepted inbound**, even as optional: `paymentStatus`, computed totals, `rating`, `reviewsCount`, `createdAt`.

---

## The error envelope

Every route handler returns this shape on failure, and every client reads it through
`readApiError`. Defined in `src/lib/api-error.ts`; produced by `toErrorResponse`.

```json
{
  "error": "This SKU is already in use",
  "details": [{ "path": "sku", "message": "This SKU is already in use" }]
}
```

`error` is always present and always safe to show. `details` appears when the failure
can be blamed on specific input, and **one envelope carries both sources** — a Zod
failure and a database constraint violation are indistinguishable to the client, which
is the point: a form maps `details` onto its fields without knowing which produced it.

`path` matches the form field name. `useServerForm` routes each detail to its field via
`setError`, and surfaces anything it could not place rather than dropping it.

Statuses: 400 invalid input · 403 forbidden · 404 missing · 409 conflict (duplicate,
stale foreign key, exhausted stock) · 500 internal.

**Only the 500 branch discards its message.** Domain code opts into being shown by
throwing `DomainError` (or `NotFoundError` / `ConflictError` / `ForbiddenError`);
anything else is treated as an internal fault and logged, because a raw Prisma message
can name columns.

**A paid feature the shop does not hold** is a 403 whose `details` name it:
`[{ "path": "feature", "message": "channels" }]` (or `storefront`, `image_enhancement`), with the
plan's sentence as `error`. Thrown as `FeatureLockedError`; a client opens the locked sheet on that
detail instead of a toast (subscriptions/feature-access D4).

Neither key is compiler-checked, which is why both sides go through the shared helpers
rather than reaching into the body. A handler that hand-rolls `NextResponse.json({ ... })`
on an error path is a defect.

---

## Current shapes

Each domain's shapes are in its own file, so a change reads only the one it touches:

| Domain | File | Holds |
|---|---|---|
| cart | [contracts/cart.md](contracts/cart.md) | Cart persistence and the sign-in merge |
| checkout | [contracts/checkout.md](contracts/checkout.md) | Orders and their lifecycle |
| promotions | [contracts/promotions.md](contracts/promotions.md) | Offers, coupons and the effective price |
| payments | [contracts/payments.md](contracts/payments.md) | Gateway conversation and payment state |
| shipping | [contracts/shipping.md](contracts/shipping.md) | Shipping providers |
| catalog | [contracts/catalog.md](contracts/catalog.md) | Products, media uploads, bulk upload, reviews |
| catalog | [contracts/storefront.md](contracts/storefront.md) | Seller profile and storefront, banners, the shop setup list |
| listing | [contracts/listing.md](contracts/listing.md) | The listing vocabulary |
| channels | [contracts/channels.md](contracts/channels.md) | Marketplace connections, listings, stock sync, publishing, readiness |
| content | [contracts/content.md](contracts/content.md) | Image enhancement and AI images |
| identity | [contracts/identity.md](contracts/identity.md) | Addresses and phone numbers |
| requests | [contracts/requests.md](contracts/requests.md) | Setup requests |
| subscriptions | [contracts/subscriptions.md](contracts/subscriptions.md) | Feature access |

Shapes every domain shares stay here.

### Paginated listings
Every admin and org listing crosses the wire as `{ ..., pagination: { page, limit, total, totalPages } }` — one `Pagination` declaration in `server/shared/pagination.ts`, re-exported by `src/types/shared.ts` (Rule 1; it was declared twice until PR-111).

`limit` is **caller-chosen but not caller-defined**: it is parsed at every handler against the closed set `PAGE_SIZE_OPTIONS` (10/25/50/100) by `resolvePageSize`, and anything else falls back to `DEFAULT_PAGE_SIZE` rather than reaching a Prisma `take`. An unbounded `take` is a table scan a query string can ask for, so this is Invariant 4 at a read boundary, not a convenience. `page` goes through `resolvePageNumber` for the same reason — a negative page is a negative `skip`.

`GET /api/admin/orgs` returns this envelope as of PR-111, where it previously returned a bare `OrgWithStats[]` and the browser searched, filtered and sliced it locally. Its `search` and `status` params now narrow the query, so `total` counts matching rows rather than fetched ones.

Since the B-007 tracker fix, `DELETE /api/admin/orgs/[id]` is removed. In its place, `PATCH /api/admin/orgs/[id]` accepts `{ action: "block" | "unblock" }` (Zod-validated) and returns the updated `OrgWithStats`. The `Org` client type (`src/domain/org.ts`) gains `isBlocked: boolean`. Blocked orgs are invisible to buyers via `FROM_ACTIVE_ORG` and their portal shows a suspended state.

## Adding a DTO
A shape goes in its domain's file under `contracts/`; one every domain shares goes here.
Record a shape when it crosses the boundary and either more than one route uses it, or getting it wrong would fail silently. A one-off response shape used by a single route does not need an entry — its Zod schema is its documentation.
