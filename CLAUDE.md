# CLAUDE.md — Project-Wide Rules & SDLC

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
| analytics | `server/analytics/` | Aggregating read-model for the admin dashboard. **Read-only**, and the one documented exception to the no-cross-domain-reads rule |
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
`prisma/seed.ts` deletes every table, so it aborts unless the target database has been named as a seed target. Every check is an **allowlist**, never a denylist of production hostnames — a denylist fails open on an unrecognised host, which is the wrong default for an irreversible operation.

**Hostname alone is not sufficient**, and assuming it was is how this invariant sat unimplemented: Prisma Postgres serves development and production from the same `db.prisma.io`, so allowing that host would allow production. Nor does `localhost` prove anything by itself — the same local server hosts unrelated work databases — so a local target must also be a database *named* in the seed's allowlist (`bhendi_bazaar_dev`); any other target must be named exactly by `SEED_ALLOWED_DATABASE_URL`, set in a local `.env` and never in a deployment environment.

Deleting rows requires a second explicit gate (`SEED_ALLOW_DESTRUCTIVE=1`), so seeding and wiping are separate intents. No credential literal lives in a seed. The guard lives in the seed itself, so it holds when someone types the raw command.

**Reference data does not belong in the seed.** The seed is destructive and therefore permanently dev-only, so anything production cannot run without — a carrier's catalogue row, for instance — ships as a data migration, which `vercel.json` applies on deploy. The test is whether production breaks without it.

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

Canonical index of *how we work*. Each line points; detail lives in the ADR so it cannot drift. **When a new convention is set, add a line here** or it will not be followed.

- **Docs split by volatility** — rules / current state / decisions / plans / history each have exactly one home. ([ADR-0001](docs/adr/0001-monorepo-doc-structure.md))
- **Domain docs co-locate with code** — `<domain>/CLAUDE.md`, lazy-loaded when a file there is read. ([ADR-0001](docs/adr/0001-monorepo-doc-structure.md))
- **ADRs** — one file per decision, `adr/NNNN-kebab-title.md`, plus a README index. Append-only; supersede, never edit. ([ADR-0001](docs/adr/0001-monorepo-doc-structure.md))
- **Specs** — feature folders, kebab-case, no numbering; `spec.md` (product) + `trd.md` (technical, no code); ≤100 readable lines each. ([ADR-0010](docs/adr/0010-spec-convention.md))
- **CHANGELOG** — append-only, newest on top, one entry per PR; `[CONTRACT]` flag when a DTO changes.
- **Docs reference code by path, never copy it.** ([ADR-0009](docs/adr/0009-docs-reference-code-never-copy-it.md))
- **One error envelope, and forms consume it via `useServerForm`.** Handlers return failures through `toErrorResponse`; clients read them through `readApiError`; domain code opts into a shown message by throwing `DomainError`. **Touching a form or handler that still uses the old pattern means converting it.** ([ADR-0013](docs/adr/0013-one-error-envelope-and-useserverform.md), [CONTRACTS.md](docs/CONTRACTS.md))
- **`server/` is organised by domain, not by layer or caller** — one directory per bounded context, owning its own layers; external systems behind an interface in `<domain>/providers/<name>/`; no `admin/` tree. ([ADR-0012](docs/adr/0012-modules-are-vertical-slices-by-domain.md))
- **ADRs are for genuine decisions** — real alternatives, and the rejected option is often the conventional one. Not for small or well-established practice. ([docs/adr/README.md](docs/adr/README.md))
- **The UI is mobile-first** — base = phone, breakpoints add; no capability removed on mobile without a replacement. ([ADR-0015](docs/adr/0015-mobile-first-design.md))
- **The phone storefront is an app shell** — bottom tab bar is primary navigation, product grids are 3-up / category lanes 2-up at base (the one scoped exception to single-column), tiles are designed at ~105px, primary actions dock above the tab bar, safe areas respected. ([ADR-0016](docs/adr/0016-mobile-app-shell.md))
- **Video is embedded, never uploaded to our own storage** — a video is a provider-tagged reference (`kind` + `ref`) rendered click-to-play, on any surface and any plan; images still go to Blob. Blob's transfer allowance is per-account and shared with every product image, and overrunning it withdraws access rather than billing, so a self-hosted video's worst case is the whole catalogue going blank. ([ADR-0017](docs/adr/0017-video-is-embedded-not-hosted.md))
- **One effective-price function serves display and charge** — every surface that needs a price (DAL, listings, product page, cart, order transaction) calls the same resolver, which takes the clock as an argument; offer resolution is never cached beyond a request. A read path that needs a price and does not call it is a defect. ([ADR-0018](docs/adr/0018-one-effective-price-function.md))
- **A discount is one winning offer, allocated to lines, with its funding recorded** — offers compete rather than stack; the winner is allocated per line by largest-remainder rounding; the org bears its own best offer and the platform only the remainder, floored at zero. `Order.discount` is a display total, never an input to settlement. ([ADR-0019](docs/adr/0019-discount-is-one-winning-offer.md))
- **Records that carry money or attribution never cascade** — every foreign key out of a discount, ledger, settlement, rate or promotion-target row is `onDelete: Restrict`; deletion is refused and the real operation is cancellation. Cascade stays correct only for children carrying no money or attribution. ([ADR-0020](docs/adr/0020-money-bearing-records-never-cascade.md))

---

## Development Principles

- **SOLID**, **DRY**, **YAGNI**, **KISS** — extensibility comes from good seams, not pre-built features.
- **Separation of concerns** — components know nothing about Prisma; repositories know nothing about HTTP.
- **Render on the server by default.** `"use client"` is earned by interactivity — state, effects, event handlers, browser APIs — not by being a component. A server component reads through `src/data-access-layer/`; a client component that only displays data receives it as props. **A route handler exists for something a browser must call**: a mutation, or a fetch triggered by interaction. Reading data a server component could have read is a round trip bought for nothing, and it is how a page ends up with a loading spinner over data the server already had. Push `"use client"` down to the smallest leaf that needs it rather than marking a whole page.
- **Mobile-first: base styles target a ~360px phone; breakpoints add, never restore.** Most buyers are on phones. The base layout is single-column (`grid-cols-N` only behind `sm:`/`md:`) **except comparison grids** — product listings are 3-up and category lanes 2-up at base, via `PRODUCT_GRID_CLASSES`, because one-per-screen defeats comparing ([ADR-0016](docs/adr/0016-mobile-app-shell.md)); the storefront's phone navigation is the bottom tab bar, so a fixed element sits at `bottom-tabbar`, not `bottom-0`; `hidden md:*` on a primary action requires a mobile affordance in the same change; hover is an enhancement, never the only affordance; interactive targets are ≥40px with nothing below `size-9`; overlays carry `max-h-overlay overflow-y-auto` (the one cap token in `globals.css`); inputs keep `Input`'s 16px mobile base (a `text-xs` override reintroduces iOS zoom); DOM order is the mobile reading order. ([ADR-0015](docs/adr/0015-mobile-first-design.md))
- **A hook does one thing.** Data fetching, form state, and presentation are three hooks, not one; a hook that returns more than one concern is the seam in the wrong place.
- **Colour goes through tokens.** Semantic tokens in `src/app/globals.css` (`primary`, `muted`, `destructive`, `success`/`warning`/`info`, `scrim`, `hero`) are the only way colour reaches a className — raw palette classes (`bg-emerald-50`, `text-gray-500`) pin one shade in one theme and turn a rebrand into a hunt. `tests/unit/design-tokens.test.ts` enforces it. Spacing/size uses Tailwind's scale (`p-4`, `text-sm`), never arbitrary bracket values without a reason.
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
