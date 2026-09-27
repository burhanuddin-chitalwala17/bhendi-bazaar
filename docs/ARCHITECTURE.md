# ARCHITECTURE.md — current state

- **Verified:** 2026-09-27
- **Covers:** `src/app/*/`, `server/*/`, `prisma/schema.prisma`, `src/lib/rate-limit/**`

Describes what **exists now**, at HLD level. Not a plan — planned work is in [BACKLOG.md](BACKLOG.md) and [specs/](specs/). Update *after* a structural change, never before ([../CLAUDE.md](../CLAUDE.md) Golden Rules). Domain-internal detail belongs in `<domain>/CLAUDE.md`, co-located with the code.

## Shape

A single Next.js 16 application — one deployable, one database. Not a service architecture: the domains in [../CLAUDE.md](../CLAUDE.md) are bounded contexts inside one process, enforced by convention rather than by network boundaries.

```
Browser ──▶ Next.js 16 (App Router, React 19)      ──▶ PostgreSQL (Prisma 7 + adapter-pg)
            ├── (main)  storefront    12 pages     ──▶ Cloudflare R2   (images only — ADR-0028)
            ├── (admin) console       24 pages     ──▶ Razorpay         (payments)
            ├── (org)   seller portal 21 pages     ──▶ Shiprocket       (shipping rates)
            ├── (auth)  sign-in flow   4 pages     ──▶ Resend           (email)
            └── api/                  103 handlers  ──▶ YouTube          (embedded video; hosted video plays natively from R2)
```

Deployed on Vercel; every route is server-rendered on demand. There is no static generation and no ISR.

A second entrypoint, `worker/main.ts`, runs the job queue: a pg-boss schema in the same Postgres, reached through one seam (`server/shared/jobs/`), worked by a long-running process that imports each domain's handlers and calls them as functions ([ADR-0038](adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)). The site enqueues inside its own transactions; the worker writes a heartbeat the admin dashboard reads. Its image is `infra/worker/Dockerfile`, its machine is provisioned by `infra/worker/provision.sh`, and both are deployment facts recorded in [OPERATIONS.md](OPERATIONS.md), not in code ([ADR-0037](adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md)).

Images are the one asset class with a delivery layer of its own: uploads are downscaled and re-encoded before they reach the object store (`server/catalog/image-upload.ts` server-side, `src/lib/image/downscale.ts` for the browser-direct bulk path), and every render goes through `next/image` so the bytes served match the slot. Every write, delete and URL derivation goes through one seam, `server/catalog/object-store.ts`, so reads never pass through our code ([ADR-0028](adr/0028-images-live-in-cloudflare-r2.md)). Both ceilings predate R2 and were set because Vercel Blob's transfer allowance was withdrawn rather than billed ([ADR-0026](adr/0026-images-are-delivered-through-the-optimizer.md)).

## Layers

`src/` is organised by **layer** — it is a Next.js app, and the framework dictates that shape. `server/` is organised by **domain**, one directory per bounded context owning its own service, repository, and types ([ADR-0012](adr/0012-modules-are-vertical-slices-by-domain.md)).

| Layer | Lives in | Responsibility |
|---|---|---|
| Pages / components | `src/app/**`, `src/components/<domain>/**` | Rendering, user interaction ([ADR-0031](adr/0031-one-components-home-organised-by-domain.md)) |
| Client services | `src/services/**` | `fetch()` wrappers over own API routes |
| Server data access | `src/data-access-layer/**` | Server-component reads, called directly from pages |
| Route handlers | `src/app/api/**` | HTTP boundary: parse, authorize, delegate |
| **Domains** | `server/<domain>/` | Business logic, transactions, and Prisma access for their own aggregates |

Two entry paths into data, by rendering mode: server components read through `src/data-access-layer/`, while client components call `src/services/`, which call route handlers. Both converge on the same domain services.

Domains are `catalog`, `cart`, `checkout`, `payments`, `shipping`, `identity`, `notifications`, `analytics`, `promotions`, `payouts`, `bidding`, `wishlist`, `content` (what is made from an image: enhancement, renditions, capture rules — reading catalog's assets through catalog's public surface), plus `shared` for what genuinely spans them. Each owns its aggregate's repository ([ADR-0003](adr/0003-one-repository-per-aggregate.md)). External systems sit behind an interface in `<domain>/providers/<name>/`. Admin-facing reads are `admin.*` files inside the owning domain — there is no separate admin tree.

`bidding` is the newest and the only domain whose stored state deliberately answers less than the question asked of it: an event's status records whether it was cancelled or settled, and *when* it is — scheduled, running, finished — is derived from its timestamps against the clock on every read. Nothing in the feature runs on a schedule as a result, and no read can be stale, because nothing was cached to go stale. See [server/bidding/CLAUDE.md](../server/bidding/CLAUDE.md).

`catalog` now derives one number the same way, for the same reason: a product's rating and review count are computed from its published reviews on every read (`server/catalog/review-rating.ts`), memoised per request so a listing asks once for a page of tiles rather than once per tile. The two columns that used to hold them were written by nothing, so every product advertised itself as unrated however many reviews it carried — a stored aggregate with no writer is worse than no aggregate ([product-reviews](specs/product-reviews/) R6a).

`server/` is imported through the `@server/*` alias; deep relative paths are not used. Four type-only imports still run inward, from `server/` to `src/lib/validation/schemas/` — the residue of DTOs declared on both sides, tracked in [CONTRACTS.md](CONTRACTS.md). Six route handlers use Prisma directly rather than going through a domain: `api/admin/shipments/[id]/tracking`, `api/auth/signup`, `api/checkout/allocate`, `api/products/check-stock`, `api/profile/upload-picture`, `api/webhooks/shipping/shiprocket`.

## Cross-cutting

- **Auth** — NextAuth v4, JWT session strategy, credentials + Google OAuth. `src/lib/auth-config.ts` defines providers and callbacks, including a `signIn` callback that links a Google login to a pre-existing email-matched user by inserting an `Account` row — behaviour `PrismaAdapter` does not provide under a JWT strategy. `src/lib/admin-auth.ts` exposes `requireSession()` and `requirePlatformAdmin()`; `src/lib/org-auth.ts` exposes `requireOrgMember()` for server components and the `withOrg()` wrapper that every `/api/org/[orgId]/*` handler is built from, so being authorised and being scoped to one org are the same act. Signing in on the storefront happens in one sheet mounted by `AuthSheetProvider` (`src/context/AuthSheetContext.tsx`) and opened with `useAuthSheet().open({ view, reason, intent })`. It renders the same form components (`src/components/auth/`) as the `(auth)` pages, stays on the page, and finishes a named intent afterwards — carried through the Google round trip in `sessionStorage` (`src/lib/auth-intent.ts`). The pages honour `callbackUrl` only as a same-origin path (`src/lib/safe-callback-url.ts`). `src/middleware.ts` guards admin *pages*; its matcher excludes `/api`, so API authorization is in-handler.
- **Validation and errors** — Zod schemas in `src/lib/validation/schemas/` are the single definition of an accepted payload: a route parses with one, and the matching form uses the same one as its resolver. Failures return the envelope in [CONTRACTS.md](CONTRACTS.md) via `toErrorResponse`, and `useServerForm` routes field-attributed errors onto their inputs ([ADR-0013](adr/0013-one-error-envelope-and-useserverform.md)). Every route handler now returns failures through `toErrorResponse`; none hands a raw `error.message` to a client. Form-side conversion to `useServerForm` is still partial and tracked in [BACKLOG.md](BACKLOG.md).
- **Cart state** — Zustand store (`src/store/cartStore.ts`) with localStorage persistence, synced to the `Cart` table for signed-in users via `src/hooks/cart/useCartSync.ts`, which must be mounted exactly once above the router. On sign-in the local cart wins on quantity conflicts, items whose product no longer exists are dropped, and price and thumbnail are refreshed from the database.
- **Rate limiting** — **detached, and says so.** `src/lib/rate-limit/` is one seam that allows everything and reports `RATE_LIMITING_ENABLED === false`; the Upstash and in-memory implementations sit beside it unimported, because no cache is wired. `tests/unit/rate-limit-detached.test.ts` fails the moment the live path grows a cache dependency again, so this cannot quietly become half-true. Nothing may be designed on the assumption that a limiter is protecting it — see [rate-limiting](specs/rate-limiting/) and the watch-list entry in [BACKLOG.md](BACKLOG.md).
- **Response security headers** — `src/lib/security-headers.ts` holds both halves: a per-request Content-Security-Policy built in `src/middleware.ts` around a fresh nonce, and the invariant set (HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) applied in `next.config.ts` so it reaches static assets too. `script-src` carries no `'unsafe-inline'` — Next stamps the nonce onto its own inline scripts — and the gateway is admitted by name on `script-src`, `frame-src`, `form-action` and `connect-src`. `CSP_REPORT_ONLY=1` downgrades enforcement to reporting without a code change. `tests/unit/security-headers.test.ts` asserts the properties rather than the string.
- **Encryption** — AES-256-GCM, per-message random IV, PBKDF2 key derivation (`server/shipping/utils/encryption.ts`). Used for stored shipping-provider credentials.
- **Email** — Resend, templates under `server/notifications/templates/`. One of them goes to the store rather than a buyer: Contact us emails a subject and message to the support inbox with the sender as Reply-To, and stores nothing ([contact-us](specs/contact-us/)). The other Contact us option, WhatsApp, is a `wa.me` link with no server side.

## Data

PostgreSQL via Prisma 7 with the `pg` driver adapter. 62 migrations; **`prisma/schema.prisma` is the authoritative schema reference** — there is no separate schema document, by design ([ADR-0009](adr/0009-docs-reference-code-never-copy-it.md)). 48 models, 17 enums. Money is integer paise ([ADR-0004](adr/0004-money-as-integer-paise.md), landed in PR-37); the only remaining `Float` columns are weights, which are not money — `Product.rating` was the other one and is gone, because a rating is now computed from the reviews rather than stored. The Prisma client is a dev-mode global singleton in `server/shared/prisma.ts`; the `pg` Pool is constructed per module evaluation.

**Several constraints live in migration SQL rather than in the schema**, because Prisma's schema language cannot express them. On `ProductMedia`: a partial unique index and a row-level `CHECK`, which together make "exactly one cover per product, and it is a photograph" a database fact rather than a convention. They are re-stated in a doc comment on the model and asserted against the migration text in `tests/unit/product-media.test.ts` — a constraint whose only home is a migration file is otherwise invisible to anyone reading the schema ([product-video](specs/product-video/) D4/D13a).

On `BiddingEvent` and `Bid` the same device carries more weight, because there the constraint *is* the concurrency design: a partial unique index on `productId` where the status is open makes "one live bidding event per product" something two simultaneous requests cannot both satisfy, and `CHECK`s pin an ordered window, positive money, a complete sale record, and a bid attributable to either an account or a named guest. Verified against a real database in `tests/integration/bidding-concurrency.test.ts` rather than against mocks — what is being tested is what Postgres does under contention, which a stub would happily fake ([bidding](specs/bidding/) D4/D6).

## Shipping

The one pluggable subsystem. `server/shipping/domain/provider.interface.ts` defines the provider contract, `server/shipping/providers/shiprocket/` implements it, and `server/shipping/services/orchestrator.service.ts` coordinates rate quoting. Provider credentials are stored encrypted and connected through the admin console.

**Rate quoting and shipment booking use different implementations.** Quotes come from the Shiprocket provider; booking goes through `server/shipping/providers/_placeholder/mock.booking.ts`, which returns a generated AWB and a placeholder tracking URL. The `_placeholder` prefix is deliberate — it marks the module as not a carrier implementation, so it cannot be mistaken for one. Unifying them is [shipping-fulfilment](specs/shipping-fulfilment/).

## Testing

156 Vitest files (138 of them under `tests/unit/`), run with `npm run test:run`. The file count is asserted by `tests/unit/docs-integrity.test.ts`; a test count is not, because nothing can check it without running the suite — which is why the number this paragraph used to carry drifted 518 → 983 unnoticed. Strategy and per-layer targets are in [TESTING.md](TESTING.md). In CI (`.github/workflows/ci.yml`) `tsc --noEmit` and the test run are blocking gates; **lint is not** — it carries `continue-on-error: true` and reports 40 errors, all `no-explicit-any`. None is in a route handler any more: `src/app/api/**` is at zero, so the rule holds where CLAUDE.md calls it a defect. What remains is in admin pages, hooks and the shipping provider layer ([BACKLOG.md](BACKLOG.md)).

## Intentionally absent

No caching layer (no `unstable_cache`, no Redis response cache); the three `export const revalidate` declarations — `src/app/sitemap.ts`, `src/app/(admin)/admin/products/page.tsx`, `src/app/(main)/bid/[slug]/opengraph-image.tsx` — are the whole of it, and none sits on a price-bearing read ([ADR-0018](adr/0018-one-effective-price-function.md)). No background job runner — retries are in-process via `server/shared/retry.ts`. No search index; product search is a `contains` match, which no btree index can serve. No structured logging or error tracking. No feature flags. No multi-currency, no i18n.
