# CLAUDE.md — Project-Wide Rules & SDLC

- **Verified:** 2026-09-29
- **Covers:** `server/*/`, `src/components/*/`, `docs/adr/*.md`


## Purpose
Single source of rules for **bhendi-bazaar** — a Next.js 16 + Prisma 7 e-commerce store.
**Claude Code reads this at the start of every session.** Keep it under 200 lines.

## How to use this file
- Always-on **project-wide** rules live here.
- Always-on **domain-specific** rules live in that domain's `CLAUDE.md` (e.g. `server/shipping/CLAUDE.md`). These load **lazily** — only when a file in that directory is read — so they cost nothing until relevant.
- Operational workflows (start a spec, finish a PR, log a decision) live in `.claude/skills/`. Invoke them rather than asking Claude to remember the steps.
- When a rule and a skill disagree, the skill wins for that workflow — then update this file to match.
- The **canonical index of standing conventions** is the *Documentation & Process Conventions* section below. Each entry is a one-line pointer to its ADR; detail lives there so it cannot drift.

## Repository shape
Single git repo (monorepo). Docs are split by **volatility**, not by folder convenience:

```
CLAUDE.md              ← you are here: rules, invariants, conventions index
docs/
├── ARCHITECTURE.md    ← current state HLD (what exists now, never plans)
├── CONTRACTS.md       ← client ↔ API DTO shapes; breaking-change protocol
├── BACKLOG.md         ← phased status map
├── CHANGELOG.md       ← append-only history, newest first
├── DEPENDENCIES.md    ← why each package exists
├── TESTING.md         ← strategy + per-layer coverage targets
├── OPERATIONS.md      ← env vars, deploy, runbook
├── INTEGRATIONS.md    ← how external services actually behave
├── adr/               ← one immutable file per decision + README index
└── specs/<feature>/   ← spec.md (product) + trd.md (technical)

server/<domain>/            ← one directory per bounded context, owning its own layers
  CLAUDE.md                 ← that domain's rules (+ ARCHITECTURE.md, adr/ where warranted)
  providers/<name>/          ← an external system, behind an interface
```
Domain files load **lazily** — only when a file in that directory is read — so they cost no context until relevant.

## Domains
Bounded contexts. A change that crosses two of these needs a `CONTRACTS.md` check.

Each is a directory under `server/`, owning its own service, repository, and types ([ADR-0012](docs/adr/0012-modules-are-vertical-slices-by-domain.md)).

| Domain | Directory | Owns |
|---|---|---|
| catalog | `server/catalog/` | Products, categories, orgs (selling organisations), reviews, search |
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
| content | `server/content/` | What is made from an image: enhancement proposals and their ledger, renditions, capture rules. Reads catalog's assets through catalog's public surface, never its repositories |
| *(shared)* | `server/shared/` | Prisma client, audit log, pagination, retry. Only what genuinely spans domains — not a dumping ground |

**There is no `admin` domain.** Admin and storefront read the same tables, so an admin listing is a query on `catalog` or `checkout`, kept as `admin.*` files inside that domain. Admin *pages* are grouped by audience in `src/app/(admin)/`, which is a UI concern.

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
Route handlers validate with a Zod schema from `src/lib/validation/schemas/`. `as SomeType` on `await request.json()` is forbidden — it is a compile-time fiction with no runtime effect. No raw request object is ever spread into a Prisma `data` argument.

A form gets its client validation from that same schema via `useServerForm`, so what a user sees inline cannot drift from what the server enforces ([ADR-0013](docs/adr/0013-one-error-envelope-and-useserverform.md)).

Additionally: **write paths whitelist their fields, and create and update must be symmetric** — an update that whitelists nothing while its create whitelists everything is how mass assignment happens. **Server-owned fields are never accepted as input**, even optionally: `rating`, `reviewsCount`, `createdAt`, `updatedAt`, `paymentStatus`, computed totals, and **`slug`** (generated from the name at creation, then frozen — a slug needing percent-encoding does not survive a route param, and changing one 404s every existing link). There is no admin exception: parsing is about the *payload* being untrusted, not the caller being unknown.

### 5. One aggregate, one repository
Each table is reached through exactly one repository module. Two repositories writing the same table is a hard block — it is how the same row comes to have two different shapes. ([ADR-0003](docs/adr/0003-one-repository-per-aggregate.md))

### 6. Stock moves conditionally, inside the transaction
Stock is changed with a guarded `updateMany({ where: { stock: { gte: qty } } })` in the same `$transaction` as the order, and `count === 0` means out-of-stock. Read-then-write is a race, not a check. ([ADR-0007](docs/adr/0007-conditional-stock-decrement.md))

### 7. Seeds refuse to run against a non-local database
`prisma/seed.ts` deletes every table, so `assertSeedTargetIsAllowed` is its first statement and the guard lives in `prisma/seed-guard.ts` — in the seed itself, so it holds when someone types the raw command. Three rules, each with its reasoning in that file's header and its proof in `tests/unit/seed-guard.test.ts`:

- **Allowlist, never a denylist.** A denylist fails open on the one host nobody listed, which is the wrong default for an irreversible operation. Hostname alone decides nothing — Prisma Postgres serves dev and production from the same `db.prisma.io`.
- **Wiping is a second intent** — `SEED_ALLOW_DESTRUCTIVE=1`, separate from seeding.
- **A deployed or CI environment is refused first**, whatever else is set. `SEED_ALLOWED_DATABASE_URL` and `SEED_ALLOW_DESTRUCTIVE` belong in a local `.env` and never in a deployment.

**Reference data does not belong in the seed.** It is permanently dev-only, so anything production cannot run without ships as a data migration, which `vercel.json` applies on deploy. The test is whether production breaks without it.

---

## SDLC — Lite

> Solo project. Rigor is calibrated for one developer keeping a real store safe, not a team coordinating PRs.

### Cycle per feature
```
SPIKE / R&D          — /bb-brainstorm <topic>      (research only, no code)
   ↓
SPEC + TRD           — /bb-sdlc spec-start <feature-name>
   - docs/specs/<feature>/spec.md  (requirements + product approach)
   - docs/specs/<feature>/trd.md   (technical approach, NO code)
   - ≤100 readable lines each; over that → split into subfeatures
   ↓
IMPLEMENTATION       — small PRs, each independently demoable, each with tests
   ↓
REVIEW               — /bb-review
   ↓
ARCHITECTURE.md      — only if structure changed (domain-local vs docs/, by scope)
   ↓
CHANGELOG.md entry   — always
   ↓
MERGE                — /bb-sdlc pr-finish walks the gate
```

### A TRD is required when a PR
- changes a domain's architecture or data flow,
- adds a third-party package,
- starts a new feature, **or**
- changes a DTO in `CONTRACTS.md` — flagged `[CONTRACT]` in the CHANGELOG.

### Not required for
typo/comment fixes, config tweaks with no behaviour change, single-function refactors with no public-API impact, doc-only changes. **Even these still need** a CHANGELOG entry and tests for any changed logic.

### Golden Rules
1. **Architecture docs describe what exists, not what is planned.** Update *after* the change, never before.
2. **Changelogs are append-only.** Never edit an old entry; append a correction.
3. **ADRs are immutable.** To reverse one, write a new ADR and set the old one's Status to `Superseded by ADR-NNNN`.
4. **No pasted code in docs.** Reference `path/file.ts:42` instead. Pasted code is an uncompiled copy of a moving target — it is why the pre-2026-08 docs rotted. ([ADR-0009](docs/adr/0009-docs-reference-code-never-copy-it.md))
5. **Every doc carries `Verified:` YYYY-MM-DD.** Stale is acceptable; *silently* stale is not.
6. **/bb-review runs before any PR is done.**

---

## Documentation & Process Conventions

Canonical index of *how we work*. **Each line is a pointer** — the rule's statement and its ADR, nothing more. Detail lives in the ADR so it has exactly one wording ([ADR-0009](docs/adr/0009-docs-reference-code-never-copy-it.md) D6), and this file is loaded into every session, so a paragraph here is a paragraph paid for on every task. **A new convention adds a line here and an ADR to point at**, or it will not be followed.

- **Docs split by volatility** — rules / current state / decisions / plans / history each have one home. [ADR-0001](docs/adr/0001-monorepo-doc-structure.md)
- **Domain docs co-locate with code** — `<domain>/CLAUDE.md`, lazy-loaded. [ADR-0001](docs/adr/0001-monorepo-doc-structure.md)
- **ADRs are append-only** — supersede, never edit. [ADR-0001](docs/adr/0001-monorepo-doc-structure.md), [index](docs/adr/README.md)
- **ADRs are for genuine decisions** — real alternatives, the rejected one often conventional. [docs/adr/README.md](docs/adr/README.md)
- **Specs are `spec.md` + `trd.md`, ≤100 lines each, no code.** [ADR-0010](docs/adr/0010-spec-convention.md)
- **CHANGELOG is append-only, newest first, one entry per PR** — `[CONTRACT]` when a DTO changes.
- **Docs reference code by path, never copy it.** [ADR-0009](docs/adr/0009-docs-reference-code-never-copy-it.md)
- **A doc's `Verified:` date is a gate** — declare `Covers:`; `npm run docs:check` fails on drift. [ADR-0009](docs/adr/0009-docs-reference-code-never-copy-it.md)
- **One error envelope, consumed by `useServerForm`** — `toErrorResponse` out, `readApiError` in, `DomainError` to opt into a shown message. [ADR-0013](docs/adr/0013-one-error-envelope-and-useserverform.md)
- **`server/` is organised by domain, not by layer or caller** — no `admin/` tree. [ADR-0012](docs/adr/0012-modules-are-vertical-slices-by-domain.md)
- **A domain is reached through its public surface** — `*.service`, `*.types` and the seams it declares. Never another domain's repository. [ADR-0033](docs/adr/0033-a-domain-is-reached-through-its-public-surface.md)
- **One components home, by domain; every control through its primitive.** [ADR-0031](docs/adr/0031-one-components-home-organised-by-domain.md)
- **An overlay's surface follows its content** — picker, canvas task, detail panel, handed-off flow; each carries its own phone form. [ADR-0040](docs/adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md)
- **The UI is mobile-first** — base = phone, breakpoints add. [ADR-0015](docs/adr/0015-mobile-first-design.md)
- **The phone storefront is an app shell** — bottom tab bar, 3-up grids, docked actions. [ADR-0016](docs/adr/0016-mobile-app-shell.md)
- **Every design axis goes through tokens** — colour, type, tracking, elevation, shape, width. [ADR-0022](docs/adr/0022-design-decisions-go-through-tokens.md)
- **A file's reasons to change are a decision** — a file reaches at most two other domains; beyond that the set and the reason are recorded. It is the *import* that adds a reason, so that is where the gate fires, at any size. [ADR-0036](docs/adr/0036-a-files-reasons-to-change-are-a-decision.md)
- **Closed sets are declared once and compared by constant** — `ORDER_STATUS.PAID`, never `"paid"`.
- **Render on the server by default** — a `page.tsx` is never `"use client"`; push it to the smallest leaf. [ADR-0034](docs/adr/0034-render-on-the-server-by-default.md)
- **One effective-price function serves display and charge.** [ADR-0018](docs/adr/0018-one-effective-price-function.md)
- **A discount is one winning offer, allocated to lines, with its funding recorded.** [ADR-0019](docs/adr/0019-discount-is-one-winning-offer.md)
- **An order code is random, a reference rather than a credential.** [ADR-0025](docs/adr/0025-order-codes-are-random-not-sequential.md)
- **An unpaid checkout releases its goods and is shown to nobody.** [checkout-abandonment](docs/specs/checkout-abandonment/)
- **Records that carry money or attribution never cascade** — deletion is refused; the real operation is cancellation. [ADR-0020](docs/adr/0020-money-bearing-records-never-cascade.md)
- **A product leaves sale by archiving, never by deletion.** [ADR-0029](docs/adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md)
- **A record a person authored is retired, never deleted** — one column per way of retiring it. [ADR-0032](docs/adr/0032-records-people-authored-are-retired-not-deleted.md)
- **A user is deactivated, never deleted** — and that is not `isBlocked`. [ADR-0032](docs/adr/0032-records-people-authored-are-retired-not-deleted.md)
- **An item up for bidding cannot be bought, and the product never knows it.** [ADR-0023](docs/adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)
- **A phone number is contact data, not an identity key.** [ADR-0024](docs/adr/0024-phone-is-contact-data-not-an-identity-key.md)
- **The audit trail records an action; it never decides whether it happened.** [ADR-0021](docs/adr/0021-audit-trail-never-fails-the-action.md)
- **An org storefront is a scoped projection of the marketplace, on one domain.** [ADR-0030](docs/adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md)
- **Images live in Cloudflare R2, behind one seam.** [ADR-0028](docs/adr/0028-images-live-in-cloudflare-r2.md)
- **Images are stored small and delivered through the optimizer.** [ADR-0026](docs/adr/0026-images-are-delivered-through-the-optimizer.md)
- **A zoomable surface declares the size it zooms to; the stored ceiling clears it.** [ADR-0027](docs/adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md)
- **Video is stored in our own object store and transcoded by the worker; a YouTube link stays an embed.** [ADR-0039](docs/adr/0039-video-is-stored-in-our-object-store-and-transcoded-by-the-worker.md)
- **Every response carries a nonce-based CSP** — `script-src` never gains `'unsafe-inline'`. [ADR-0035](docs/adr/0035-every-response-carries-a-nonce-based-csp.md)
- **The host is a deployment fact, not an architectural input** — seams, app-named environment, no vendor names in config; a free tier is used, never depended on. [ADR-0037](docs/adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md)
- **A channel is classed by where the sale completes** — storefront, shopfront, marketplace; the kind decides the machinery. [ADR-0041](docs/adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)
- **The shared vocabulary is the intersection; a channel declares its own extras as a schema** — never a bag, never the union. [ADR-0042](docs/adr/0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md)
- **A variant is a product in a family** — its own SKU, price and stock; the family carries what they share. [ADR-0043](docs/adr/0043-a-variant-is-a-product-in-a-family.md)
- **A marketplace order's money is reported, not computed** — Invariant 2's shape, not Invariant 1's exception; it never enters the payouts ledger. [ADR-0044](docs/adr/0044-a-marketplace-orders-money-is-reported-not-computed.md)
- **Channel mappings are versioned data** — category, attribute and value; an unmapped value fails readiness rather than being guessed. [ADR-0045](docs/adr/0045-channel-mappings-are-versioned-data.md)
- **Background work runs on an owned worker against a Postgres job queue** — enqueued in the business transaction, handlers idempotent on job id, no HTTP between queue and code. [ADR-0038](docs/adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)
- **A new model is checked against the field before the codebase** — a TRD introducing a new persistence shape, data model or integration pattern states the established approach and whether it follows it; our own prevailing pattern is evidence, never authority. [ADR-0046](docs/adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md)
- **A guard is mutation-tested before it is trusted** — break the rule in the source and watch it go red, or it is decoration. Two Invariants had no guard at all and nothing noticed. ([docs/TESTING.md](docs/TESTING.md))
- **The tests are audited like the code** — a suite that cannot run, or passes over an empty scan, is not a passing suite. `tests/unit/test-integrity.test.ts`
- **Every route handler has a caller, named in the repository or declared as external** — no compiler follows a string. `tests/unit/route-reachability.test.ts`
- **Index tables are generated from the files they index, never typed** — `npm run docs:index`; a stale table fails `docs:check`. `tests/unit/docs-integrity.test.ts`

## Development Principles

- **SOLID**, **DRY**, **YAGNI**, **KISS** — extensibility comes from good seams, not pre-built features.
- **Separation of concerns** — components know nothing about Prisma; repositories know nothing about HTTP.
- **Render on the server by default.** `"use client"` is earned by interactivity — state, effects, event handlers, browser APIs — not by being a component. A server component reads through `src/data-access-layer/`; a client component that only displays data receives it as props. **A route handler exists for something a browser must call**: a mutation, or a fetch triggered by interaction. Reading data a server component could have read is a round trip bought for nothing, and it is how a page ends up with a loading spinner over data the server already had. Push `"use client"` down to the smallest leaf that needs it rather than marking a whole page.
- **Mobile-first: base styles target a ~360px phone; breakpoints add, never restore.** Single-column at base except comparison grids (`PRODUCT_GRID_CLASSES`); a fixed element sits at `bottom-tabbar`, not `bottom-0`; `hidden md:*` on a primary action needs a mobile affordance in the same change; hover is never the only affordance; targets ≥40px; inputs keep `Input`'s 16px base or iOS zooms. ([ADR-0015](docs/adr/0015-mobile-first-design.md), [ADR-0016](docs/adr/0016-mobile-app-shell.md))
- **A hook does one thing.** Data fetching, form state, and presentation are three hooks, not one; a hook that returns more than one concern is the seam in the wrong place.
- **Design goes through tokens.** Colour, type size, tracking, elevation and shape reach a className only as a semantic token from `src/app/globals.css`; page width and title come from `PageShell`/`PageHeader`. A literal at the call site turns a redesign into a hunt. `tests/unit/design-tokens.test.ts` and `tests/unit/cn-tokens.test.ts` enforce it — the second because `cn` must be taught every custom token or `tailwind-merge` cannot tell it is one. ([ADR-0022](docs/adr/0022-design-decisions-go-through-tokens.md))
- **No magic strings** — closed sets are enums or `as const` unions, declared **once** (see Invariant 5's reasoning; `ProductFlag` was declared three times and drifted silently).
- **Dependency direction is inward** — `server/` must not import from `src/`. Shared types belong in a neutral module.
- **`any` is a defect at a trust boundary.** Route handlers, auth, and payment code are typed or they are wrong.
- **Never hardcode our own origin.** In the browser use a relative path; where an absolute URL is genuinely needed there, use `window.location.origin`. On the server use `appUrl()` (`server/shared/app-url.ts`). `src/lib/config.ts` is for static brand facts only — an origin is environment-specific or runtime-known, so it is never a constant.
- **Comments explain why, not what.** Write one only where the reason is not recoverable from the code: a non-obvious constraint, a rejected alternative, an external quirk. **One or two lines.** If it needs a paragraph it belongs in an ADR or a spec — link that from a short comment instead. No file-header essays, no restating the signature, no narrating the next line.

## Skills

| Skill | When |
|---|---|
| `/bb-brainstorm <topic>` | Before a TRD. Research only, no code. |
| `/bb-sdlc <sub>` | `spec-start <feature>`, `adr-new <title>`, `pr-finish`. |
| `/bb-review` | Before any PR is considered done. Checks the Invariants above. |

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
