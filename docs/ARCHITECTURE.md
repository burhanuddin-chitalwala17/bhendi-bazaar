# ARCHITECTURE.md — current state

- **Verified:** 2026-08-30

Describes what **exists now**, at HLD level. Not a plan — planned work is in [BACKLOG.md](BACKLOG.md) and [specs/](specs/). Update *after* a structural change, never before ([../CLAUDE.md](../CLAUDE.md) Golden Rules). Domain-internal detail belongs in `<domain>/CLAUDE.md`, co-located with the code.

## Shape

A single Next.js 16 application — one deployable, one database. Not a service architecture: the domains in [../CLAUDE.md](../CLAUDE.md) are bounded contexts inside one process, enforced by convention rather than by network boundaries.

```
Browser ──▶ Next.js 16 (App Router, React 19)      ──▶ PostgreSQL (Prisma 7 + adapter-pg)
            ├── (main)  storefront   ~12 pages     ──▶ Upstash Redis   (rate limits)
            ├── (admin) console      ~14 pages     ──▶ Vercel Blob     (images only — ADR-0017)
            ├── (auth)  sign-in flow  ~4 pages     ──▶ Razorpay        (payments)
            └── api/                  46 handlers  ──▶ Shiprocket      (shipping rates)
                                                   ──▶ Resend          (email)
                                                   ──▶ YouTube         (product video, embedded)
```

Deployed on Vercel; every route is server-rendered on demand. There is no static generation and no ISR.

## Layers

`src/` is organised by **layer** — it is a Next.js app, and the framework dictates that shape. `server/` is organised by **domain**, one directory per bounded context owning its own service, repository, and types ([ADR-0012](adr/0012-modules-are-vertical-slices-by-domain.md)).

| Layer | Lives in | Responsibility |
|---|---|---|
| Pages / components | `src/app/**`, `src/components/**`, `src/containers/**` | Rendering, user interaction |
| Client services | `src/services/**` | `fetch()` wrappers over own API routes |
| Server data access | `src/data-access-layer/**` | Server-component reads, called directly from pages |
| Route handlers | `src/app/api/**` | HTTP boundary: parse, authorize, delegate |
| **Domains** | `server/<domain>/` | Business logic, transactions, and Prisma access for their own aggregates |

Two entry paths into data, by rendering mode: server components read through `src/data-access-layer/`, while client components call `src/services/`, which call route handlers. Both converge on the same domain services.

Domains are `catalog`, `cart`, `checkout`, `payments`, `shipping`, `identity`, `notifications`, `analytics`, plus `shared` for what genuinely spans them. Each owns its aggregate's repository ([ADR-0003](adr/0003-one-repository-per-aggregate.md)). External systems sit behind an interface in `<domain>/providers/<name>/`. Admin-facing reads are `admin.*` files inside the owning domain — there is no separate admin tree.

`server/` is imported through the `@server/*` alias; deep relative paths are not used. Four type-only imports still run inward from `server/` to `src/domain/` — the residue of DTOs declared on both sides, tracked in [CONTRACTS.md](CONTRACTS.md). Five route handlers use Prisma directly rather than going through a domain.

## Cross-cutting

- **Auth** — NextAuth v4, JWT session strategy, credentials + Google OAuth. `src/lib/auth-config.ts` defines providers and callbacks, including a `signIn` callback that links a Google login to a pre-existing email-matched user by inserting an `Account` row — behaviour `PrismaAdapter` does not provide under a JWT strategy. `src/lib/admin-auth.ts` exposes `verifyAdminSession()`, called by every admin handler. `src/middleware.ts` guards admin *pages*; its matcher excludes `/api`, so API authorization is in-handler.
- **Validation and errors** — Zod schemas in `src/lib/validation/schemas/` are the single definition of an accepted payload: a route parses with one, and the matching form uses the same one as its resolver. Failures return the envelope in [CONTRACTS.md](CONTRACTS.md) via `toErrorResponse`, and `useServerForm` routes field-attributed errors onto their inputs ([ADR-0013](adr/0013-one-error-envelope-and-useserverform.md)). Coverage is partial — the product path is converted; the remaining handlers and forms are tracked in [BACKLOG.md](BACKLOG.md).
- **Cart state** — Zustand store (`src/store/cartStore.ts`) with localStorage persistence, synced to the `Cart` table for signed-in users via `src/hooks/cart/useCartSync.ts`, which must be mounted exactly once above the router. On sign-in the local cart wins on quantity conflicts, items whose product no longer exists are dropped, and price and thumbnail are refreshed from the database.
- **Rate limiting** — Upstash Redis (`src/lib/rate-limit.ts`) on auth, payment, and order routes. A second in-memory limiter (`src/lib/rateLimit.ts`) serves the cart routes and is per-instance.
- **Encryption** — AES-256-GCM, per-message random IV, PBKDF2 key derivation (`server/shipping/utils/encryption.ts`). Used for stored shipping-provider credentials.
- **Email** — Resend, templates under `server/services/email/templates/`.

## Data

PostgreSQL via Prisma 7 with the `pg` driver adapter. 40 migrations; **`prisma/schema.prisma` is the authoritative schema reference** — there is no separate schema document, by design ([ADR-0009](adr/0009-docs-reference-code-never-copy-it.md)). 34 models, 11 enums. Money is integer paise ([ADR-0004](adr/0004-money-as-integer-paise.md), landed in PR-37); the remaining `Float` columns are weights and ratings, which are not money. The Prisma client is a dev-mode global singleton in `src/lib/prisma.ts`; the `pg` Pool is constructed per module evaluation.

**Two constraints live in migration SQL rather than in the schema**, because Prisma's schema language cannot express either: a partial unique index and a row-level `CHECK` on `ProductMedia`, which together make "exactly one cover per product, and it is a photograph" a database fact rather than a convention. They are re-stated in a doc comment on the model and asserted against the migration text in `tests/unit/product-media.test.ts` — a constraint whose only home is a migration file is otherwise invisible to anyone reading the schema ([product-video](specs/product-video/) D4/D13a).

## Shipping

The one pluggable subsystem. `server/shipping/domain/provider.interface.ts` defines the provider contract, `server/shipping/providers/shiprocket/` implements it, and `server/shipping/services/orchestrator.service.ts` coordinates rate quoting. Provider credentials are stored encrypted and connected through the admin console.

**Rate quoting and shipment booking use different implementations.** Quotes come from the Shiprocket provider; booking goes through `server/shipping/providers/_placeholder/mock.booking.ts`, which returns a generated AWB and a placeholder tracking URL. The `_placeholder` prefix is deliberate — it marks the module as not a carrier implementation, so it cannot be mistaken for one. Unifying them is [shipping-fulfilment](specs/shipping-fulfilment/).

## Testing

44 Vitest unit files, 518 tests, run with `npm run test:run`. Strategy and per-layer targets are in [TESTING.md](TESTING.md); making CI gates block is still outstanding ([BACKLOG.md](BACKLOG.md) Phase 4).

## Intentionally absent

No caching layer (no `unstable_cache`, no Redis response cache). No background job runner — retries are in-process via `server/shared/retry.ts`. No search index; product search is a `contains` match, which no btree index can serve. No structured logging or error tracking. No feature flags. No multi-currency, no i18n.
