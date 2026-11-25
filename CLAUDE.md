# CLAUDE.md — Project-Wide Rules & SDLC

- **Verified:** 2026-11-24
- **Covers:** `server/*/`, `src/components/*/`, `src/app/api/`, `docs/adr/*.md`, `.claude/`

## Purpose
Single source of rules for **bhendi-bazaar** — a Next.js 16 + Prisma 7 e-commerce store. **Claude Code reads this at the start of every session.** Keep it under 200 lines.

## How to use this file
- Always-on **project-wide** rules live here.
- Always-on **domain-specific** rules live in that domain's `CLAUDE.md` (e.g. `server/shipping/CLAUDE.md`). These load **lazily** — only when a file in that directory is read — so they cost nothing until relevant.
- Workflows are skills, invoked rather than remembered: `/bb-brainstorm <topic>` (spike, no code), `/bb-sdlc spec-start|ux-start|adr-new|pr-finish`, `/bb-build <feature>` (implement an accepted TRD, unit by unit, gates recorded), `/bb-review` (before any unit is done).
- When a rule, a skill and an ADR disagree, the newest ADR wins; fix the stale one in the same change.
- The **canonical index of standing conventions** is the *Documentation & Process Conventions* section below. Each entry is a one-line pointer to its ADR; detail lives there so it cannot drift.

## Repository shape
Single git repo. Docs are split by **volatility**; [docs/README.md](docs/README.md) maps every file. Rules for one directory live in that directory's `CLAUDE.md`, which loads only when a file there is read:
- `server/<domain>/CLAUDE.md` — that domain (+ `ARCHITECTURE.md`, `adr/` where warranted)
- `src/components/CLAUDE.md` — the front end: layers, primitives, tokens, form factors, hooks and API clients
- `src/app/api/CLAUDE.md` — route handlers: portal guards, parsing, the error envelope

## Domains
Bounded contexts. A change that crosses two of these needs a `CONTRACTS.md` check.

Each is a directory under `server/`, owning its own service, repository, and types ([ADR-0012](docs/adr/0012-modules-are-vertical-slices-by-domain.md)).

| Domain | Directory | Owns |
|---|---|---|
| catalog | `server/catalog/` | Products and stock, categories, orgs (profile, members, locations, storefront), brands, reviews, search, media assets and the R2 seam, video, bulk import |
| listing | `server/listing/` | The vocabulary a product is described in — facts, product types, families, permitted answers — and what each channel makes of it: mappings, readiness, the register, org listing defaults |
| cart | `server/cart/` | Cart persistence and the sign-in merge |
| checkout | `server/checkout/` | Orders and their lifecycle |
| payments | `server/payments/` | Gateway conversation and payment state |
| shipping | `server/shipping/` | Carriers, rates, shipments |
| identity | `server/identity/` | Profile, addresses, passwords, users |
| notifications | `server/notifications/` | Transactional email |
| promotions | `server/promotions/` | Offers, coupons, and the one effective-price resolver every surface calls |
| payouts | `server/payouts/` | What each org earned, what the platform kept, what is still owed |
| bidding | `server/bidding/` | Timed auctions on a single item, and the gate that suspends it from normal sale |
| analytics | `server/analytics/` | Aggregating read-model for the admin dashboard. **Read-only**, and the one documented exception to the no-cross-domain-reads rule |
| wishlist | `server/wishlist/` | Saved products, and the demand signal an org reads off them |
| channels | `server/channels/` | A shop's authorised connections to marketplaces: consent, encrypted tokens, renewal, health. Tokens never leave it |
| content | `server/content/` | What is made from an image: enhancement proposals and their ledger, renditions, what each channel asks of a photograph, and every AI-generated picture through one provider-agnostic port ([ADR-0076](docs/adr/0076-image-generation-goes-through-one-port-and-models-are-data.md)). Reads catalog's assets through catalog's public surface, never its repositories |
| requests | `server/requests/` | Tickets for what a shop can't fix itself: requirements the admin enables, issues a developer fixes. Keyed by the fix, never by the shop |
| subscriptions | `server/subscriptions/` | What each shop may use of the paid features (Channels, Storefront, Image enhancement, Social selling), and the one check every domain asks. Imports only `shared` |
| audience | `server/audience/` | A shop's contacts and their marketing consent: the append-only log, its projection, and the one `may` every marketing sender asks |
| *(shared)* | `server/shared/` | Prisma client, audit log, pagination, retry, the job-queue seam, the closed set of channels, the one writer of `Address`, the neutral social facts (`social-events/`) and each shop's sealing key (`seal/`, ADR-0085). Only what genuinely spans domains — not a dumping ground |

**There is no `admin` domain.** An admin listing is a query on its domain, kept as `admin.*` files there — and those files are read models: every write is a named command on the aggregate's one repository ([ADR-0055](docs/adr/0055-an-admin-surface-reads-through-projections-and-writes-through-the-aggregates-one-repository.md)). Admin *pages* are grouped by audience in `src/app/(admin)/`, which is a UI concern.

A domain calls another domain's public surface, never its internals. Cross-domain shapes go in [CONTRACTS.md](docs/CONTRACTS.md).

---

## Project Invariants (non-negotiable)

These are hard blocks, not tradeoffs. Each exists because it was violated and cost something real — see the linked ADR.

### 1. The server is the sole authority on money
Item prices, totals, and payment amounts are **always** recomputed server-side from `Product.price`. A price, total, or amount arriving in a request body is untrusted input to be discarded, never a value to persist or charge. ([ADR-0002](docs/adr/0002-server-holds-pricing-authority.md))

### 2. Payment state changes only on a verified gateway signal
`paymentStatus: "paid"` is written in exactly one place: the handler that has verified a gateway signature against the persisted order **and** matched its amount. It is never accepted from a request body, never set by the browser, and never settable at order-creation time. ([ADR-0005](docs/adr/0005-payment-state-server-only.md))

### 3. Money is integer paise
All monetary columns and all arithmetic are `Int` paise. Never `Float`, never `Number` division on currency. Epsilon comparison on a total (`Math.abs(a - b) < 0.01`) is a bug, not a tolerance. ([ADR-0004](docs/adr/0004-money-as-integer-paise.md))

### 4. Every request body is parsed, never cast
Route handlers validate with a Zod schema from `src/lib/validation/schemas/`. `as SomeType` on `await request.json()` is forbidden — it is a compile-time fiction with no runtime effect. No raw request object is ever spread into a Prisma `data` argument. A form gets its client validation from that same schema via `useServerForm`, so what a user sees inline cannot drift from what the server enforces ([ADR-0013](docs/adr/0013-one-error-envelope-and-useserverform.md)).

Additionally: **write paths whitelist their fields, and create and update must be symmetric** — an update that whitelists nothing while its create whitelists everything is how mass assignment happens. **Server-owned fields are never accepted as input**, even optionally: `rating`, `reviewsCount`, `createdAt`, `updatedAt`, `paymentStatus`, computed totals, and **`slug`** (generated from the name at creation, then frozen — a slug needing percent-encoding does not survive a route param, and changing one 404s every existing link). There is no admin exception: parsing is about the *payload* being untrusted, not the caller being unknown.

### 5. One aggregate, one repository
Each table is reached through exactly one repository module. Two repositories writing the same table is a hard block — it is how the same row comes to have two different shapes. `admin.*` modules never write and a service never writes through `tx.<model>`; `tests/unit/one-repository.test.ts` reads every file. ([ADR-0003](docs/adr/0003-one-repository-per-aggregate.md), [ADR-0055](docs/adr/0055-an-admin-surface-reads-through-projections-and-writes-through-the-aggregates-one-repository.md))

### 6. Stock moves conditionally, inside the transaction
Stock moves only through catalog's stock commands (`server/catalog/stock.service.ts`): a guarded `updateMany` per (product, location) row inside the order's `$transaction`, where `count === 0` means out of stock; an admin edit is a compare-and-set against the quantity the editor saw. Read-then-write is a race, not a check. ([ADR-0007](docs/adr/0007-conditional-stock-decrement.md))

### 7. Seeds refuse to run against a non-local database
`prisma/seed.ts` deletes every fixture table, so `assertSeedTargetIsAllowed` is its first statement and the guard lives in `prisma/seed-guard.ts` — in the seed itself, so it holds when someone types the raw command. Three rules, each with its reasoning in that file's header and its proof in `tests/unit/seed-guard.test.ts`:

- **Allowlist, never a denylist.** A denylist fails open on the one host nobody listed, which is the wrong default for an irreversible operation. Hostname alone decides nothing — Prisma Postgres serves dev and production from the same `db.prisma.io`.
- **Wiping is a second intent** — `SEED_ALLOW_DESTRUCTIVE=1`, separate from seeding.
- **A deployed or CI environment is refused first**, whatever else is set. `SEED_ALLOWED_DATABASE_URL` and `SEED_ALLOW_DESTRUCTIVE` belong in a local `.env` and never in a deployment.

**Reference data does not belong in the seed.** It is permanently dev-only, so anything production cannot run without — product types, listing values, channel maps — ships as a data migration, which `vercel.json` applies on deploy. The test is whether production breaks without it. A test never uses or deletes a reference row as a fixture.

---

## SDLC — Lite

> Solo project. Rigor is calibrated for one developer keeping a real store safe, not a team coordinating PRs.

### Cycle per feature
```
SPIKE            /bb-brainstorm <topic>           research only, no code
SPEC             /bb-sdlc spec-start <feature>    one outcome; Scope In/Later cut by Claude; decisions.md opened
UX               /bb-sdlc ux-start <feature>      ux.md: journeys, state matrix, copy; prototype; owner signs off
TRD              trd.md                           cites ux.md and Q ids; no line cap (ADR-0071)
HANDOFF          TRD Accepted → planning session prints one prompt per unit and stops (ADR-0080)
IMPLEMENTATION   /bb-build <feature>              in a new session; refuses open decisions or unsigned UX; failing test per A id first
REVIEW           /bb-review                       in a fresh context, not by the author
DOCS             ARCHITECTURE.md only if structure changed; the commit subject is the record (ADR-0078)
MERGE            /bb-sdlc pr-finish walks the gate
```

### A TRD is required when a PR
- changes a domain's architecture or data flow,
- adds a third-party package,
- starts a new feature, **or**
- changes a DTO in `CONTRACTS.md` — flagged `[CONTRACT]` in the commit subject.

Not required for typo fixes, no-behaviour config tweaks, single-function refactors, doc-only changes — which **still need** tests for any changed logic.

### Golden Rules
1. **Architecture docs describe what exists, not what is planned.** Update *after* the change, never before.
2. **/bb-review runs before any unit is done.** The rest — commit subjects as the record, immutable ADRs, no pasted code, `Verified:` dates — is in the index below.
3. **Commit each unit on the working branch, then push that branch.** `.claude/settings.json` allows a plain `git push` to `origin` and denies a force-push (owner, 2026-11-24). Never push to `main` and never force-push; opening, merging or commenting on a PR stays the owner's. A new spec or TRD stays uncommitted until the owner has read it.

## Documentation & Process Conventions

The full index of standing conventions is [docs/CONVENTIONS.md](docs/CONVENTIONS.md): one line per rule, each pointing at its
ADR. **Read it before any task that adds a domain, a route, a screen, a migration, a spec or an ADR**, and check the lines
that touch your change. A new convention adds a line there and an ADR to point at. The ones that apply to almost every change:

- **One components home, by domain; every control through its primitive.** [ADR-0031](docs/adr/0031-one-components-home-organised-by-domain.md)
- **A component renders, a hook holds state, an API client makes the call** — `fetch` only in a `*ApiClient.ts` beside its domain; props are DTOs, never `@prisma/client`. [ADR-0048](docs/adr/0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md)
- **The UI is mobile-first** — base = phone, breakpoints add. [ADR-0015](docs/adr/0015-mobile-first-design.md)
- **Every design axis goes through tokens** — colour, type, tracking, elevation, shape, width; colour values live only in the primitive palette, which semantic tokens point at. [ADR-0022](docs/adr/0022-design-decisions-go-through-tokens.md), [ADR-0049](docs/adr/0049-colour-is-a-primitive-palette-read-through-semantic-tokens.md)
- **Closed sets are declared once and compared by constant** — `ORDER_STATUS.PAID`, never `"paid"`. [ADR-0003](docs/adr/0003-one-repository-per-aggregate.md) D5
- **Words live in copy modules, our own paths in `ROUTES`** — `<area>-copy.ts` beside the components; `server/shared/routes.ts` for links; the suite fails on any inline. [ADR-0067](docs/adr/0067-words-live-in-copy-modules-and-our-own-paths-in-one-routes-table.md)
- **Render on the server by default** — a `page.tsx` is never `"use client"`; push it to the smallest leaf. [ADR-0034](docs/adr/0034-render-on-the-server-by-default.md)
- **Every public route is classified for rate limiting** — one registry: a named policy or an exemption with its reason; an unclassified route fails the suite. [ADR-0063](docs/adr/0063-every-public-route-is-classified-for-rate-limiting-in-one-registry.md)

## Development Principles

- **SOLID**, **DRY**, **YAGNI**, **KISS** — extensibility comes from good seams, not pre-built features; components know nothing about Prisma, repositories know nothing about HTTP.
- **A hook does one thing.** Data fetching, form state, and presentation are three hooks, not one. Front-end detail is in [src/components/CLAUDE.md](src/components/CLAUDE.md).
- **Dependency direction is inward** — `server/` must not import from `src/`. Shared types belong in a neutral module.
- **`any` is a defect at a trust boundary.** Route handlers, auth, and payment code are typed or they are wrong.
- **Never hardcode our own origin.** Relative paths in the browser, `appUrl()` (`server/shared/app-url.ts`) on the server; `src/lib/config.ts` holds static brand facts only.
- **Two identical failures stop the session.** When the same check fails twice for the same reason, report what you tried and your hypothesis, and wait — no third variation. Run checks with `npm run gate`, which prints only failures. [ADR-0079](docs/adr/0079-agent-sessions-are-kept-cheap-without-removing-a-check.md)
- **Comments explain why, not what.** Write one only where the reason is not recoverable from the code: a non-obvious constraint, a rejected alternative, an external quirk. **One or two lines.** If it needs a paragraph it belongs in an ADR or a spec — link that from a short comment instead. No file-header essays, no restating the signature, no narrating the next line.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
