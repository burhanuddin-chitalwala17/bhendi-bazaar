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
| promotions | `server/promotions/` | Offers, coupons, and the one effective-price resolver every surface calls |
| payouts | `server/payouts/` | What each org earned, what the platform kept, what is still owed |
| bidding | `server/bidding/` | Timed auctions on a single item, and the gate that suspends it from normal sale |
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

Deleting rows requires a second explicit gate (`SEED_ALLOW_DESTRUCTIVE=1`), so seeding and wiping are separate intents. **A deployed or CI environment is refused before any of that is consulted** — `VERCEL`, `VERCEL_ENV`, `CI`, or `NODE_ENV=production` present means no seed, whatever the other variables say. "Never set `SEED_ALLOWED_DATABASE_URL` in Vercel" was the only thing standing between production and a wipe, and a rule people must remember is not a control. No credential literal lives in a seed. The guard lives in the seed itself, so it holds when someone types the raw command.

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
- **Every design axis goes through tokens, not just colour** — type (`text-4xs`…), tracking (`tracking-eyebrow`…), elevation *roles* (`shadow-raised`/`-lifted`/`-overlay`), shape (`rounded-card`/`-field`) and page width (`PageShell`, `max-w-page`) are declared in `globals.css` and enforced by `tests/unit/design-tokens.test.ts`, which also fails any `font-*` class with no matching theme token. A literal at the call site is what made a rebrand one file and a redesign a hundred. ([ADR-0022](docs/adr/0022-design-decisions-go-through-tokens.md))
- **An item up for bidding cannot be bought, and the product never knows it** — suspension is derived at read time from the live event set, memoised per request for display and re-checked inside the order transaction, which is the only race-safe point. Nothing is written to `Product` when an event opens or closes, and `status` alone never means "biddable" — go through `bidding-window.ts`. ([ADR-0023](docs/adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md), [server/bidding/CLAUDE.md](server/bidding/CLAUDE.md), [bidding spec](docs/specs/bidding/spec.md))
- **A product leaves sale by archiving, never by deletion** — an `archivedAt` timestamp archives it; hard delete survives only for a product no order line, promotion target or bidding event depends on, and the one delete control degrades to an archive and says which it did. Visibility is one exported `where` fragment every buyer-facing query spreads, with a guard test over the call sites; the enforcement point is an assertion **inside the order transaction**, because filtering a listing is presentation and removing a button is not a control. Archiving is reversible and never a side effect of an import or a promotion. ([ADR-0029](docs/adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md), [product-archive spec](docs/specs/product-archive/spec.md))
- **A phone number is contact data, not an identity key** — `User.mobile` carries no unique constraint, email is the sole identity key, and no code resolves a user from a phone (the answer is a set). Phone-based sign-in or recovery needs its own ADR before it can assume otherwise. ([ADR-0024](docs/adr/0024-phone-is-contact-data-not-an-identity-key.md))
- **An unpaid checkout releases its goods and is shown to nobody** — abandonment is the common case, not the exception: the browser's dismissal, a blocked checkout and the cron all reach one `releaseIfUnpaid`, which asks the gateway first and never releases while a payment is in flight. Abandoned orders are kept in full and hidden through `VISIBLE_ORDER_WHERE` applied inside the repositories, never at the call site. ([checkout-abandonment](docs/specs/checkout-abandonment/), [ADR-0025](docs/adr/0025-order-codes-are-random-not-sequential.md))
- **An order code is random, and a reference rather than a credential** — `BB-` plus eight characters from an alphabet without `I L O U 0 1`, generated without reading the table, so codes cannot collide, cannot be enumerated, and do not report sales volume. Both code shapes stay valid for ever. ([ADR-0025](docs/adr/0025-order-codes-are-random-not-sequential.md))
- **Images are stored small and delivered through the optimizer** — every image in `src/` renders through `next/image`; a raw `<img>` is only for a local `blob:`/`data:` preview or a renderer that cannot take one, and `unoptimized` only for a third party's already-sized asset, each allowlisted *with its reason* in `tests/unit/image-delivery.test.ts`. `fill` always carries `sizes` — without it a 64px slot downloads the viewport width. Photographs are downscaled to `MAX_IMAGE_EDGE` and re-encoded as WebP before upload, by both the server route and the browser-direct bulk wizard, from one budget in `server/catalog/media.ts`. The free tier withdraws transfer rather than billing it, so the symptom of getting this wrong is a blank catalogue. ([ADR-0026](docs/adr/0026-images-are-delivered-through-the-optimizer.md))
- **Images live in Cloudflare R2, behind one seam** — every write, delete and URL derivation goes through `server/catalog/object-store.ts`; reads never pass through our code, so there is no metered egress path to exhaust. The public base URL is configuration (`R2_PUBLIC_BASE_URL`), never derived from the credentialed S3 endpoint, and `next.config.ts` reads it for `remotePatterns` — a host missing there 404s every image at the optimizer with no error anywhere. A browser gets a presigned PUT, not a token. ([ADR-0028](docs/adr/0028-images-live-in-cloudflare-r2.md))
- **A zoomable surface declares the size it zooms to, and the stored ceiling clears it** — a zoom scales bytes already downloaded rather than fetching sharper ones, so the gallery's active slide and the lightbox use `ZOOMABLE_IMAGE_SIZES` (the one sanctioned overstatement of ADR-0026's honest-`sizes` rule) and `MAX_IMAGE_EDGE` is derived from `MAX_ZOOM_SCALE`, declared once in `server/catalog/media.ts`. Measured: a 1600px ceiling against a 3× zoom had twice the error of 2000px on the surface where a buyer inspects weave and stonework. ([ADR-0027](docs/adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md))
- **The audit trail records an action; it never decides whether it happened** — services go through `recordAdminAction` (after a committed mutation, never throws) or `recordAdminActionIn(tx, …)` (inside the mutation's transaction, throws with it), never `adminLogRepository.createLog`. An admin id used as a foreign key is re-read, not taken from the JWT claim. ([ADR-0021](docs/adr/0021-audit-trail-never-fails-the-action.md))
- **An org storefront is a scoped projection of the marketplace, on one domain** — the same catalogue, price resolver, basket and checkout read through an org filter at `/store/<handle>`. `/store` is public and crawled, `/org` stays the gated seller portal, `/product/<slug>` stays canonical, and a storefront query never selects a commercial column. A storefront is live from org creation — no verification, approval or publish flag — and `Org.isActive` is the one withdrawal switch, which must hide that org's products **platform-wide**, not just its storefront. Handles are generated then owner-changeable: a retired handle is *held* for a configurable window (currently 180 days), redirecting and unavailable to others, then *released* to the pool answering 404; resuming one must delete the redirect pointing away from it. The switch is `FROM_ACTIVE_ORG` in `server/catalog/product.visibility.ts`, spread beside `ON_SALE` by every read a buyer reaches — same seam as archiving, second dimension. ([ADR-0030](docs/adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md), [org-storefront spec](docs/specs/org-storefront/spec.md))
- **One components home, by domain, and every control through its primitive** — all components live in `src/components/<domain>/` (`ui/`, `shared/` and `layout/` aside); `src/admin`, `src/org`, `src/containers` and `src/components/admin` are dissolved and stay so. Placement follows the domain served, never the audience calling (ADR-0012's rule, one layer up). No raw `<button>`, `<select>` or text `<input>` outside `src/components/ui` — only `type="file"` and `type="hidden"` stay raw — and appearance comes from a variant, not a className. `tests/unit/ui-primitives.test.ts` enforces it. ([ADR-0031](docs/adr/0031-one-components-home-organised-by-domain.md))

---

## Development Principles

- **SOLID**, **DRY**, **YAGNI**, **KISS** — extensibility comes from good seams, not pre-built features.
- **Separation of concerns** — components know nothing about Prisma; repositories know nothing about HTTP.
- **Render on the server by default.** `"use client"` is earned by interactivity — state, effects, event handlers, browser APIs — not by being a component. A server component reads through `src/data-access-layer/`; a client component that only displays data receives it as props. **A route handler exists for something a browser must call**: a mutation, or a fetch triggered by interaction. Reading data a server component could have read is a round trip bought for nothing, and it is how a page ends up with a loading spinner over data the server already had. Push `"use client"` down to the smallest leaf that needs it rather than marking a whole page.
- **Mobile-first: base styles target a ~360px phone; breakpoints add, never restore.** Most buyers are on phones. The base layout is single-column (`grid-cols-N` only behind `sm:`/`md:`) **except comparison grids** — product listings are 3-up and category lanes 2-up at base, via `PRODUCT_GRID_CLASSES`, because one-per-screen defeats comparing ([ADR-0016](docs/adr/0016-mobile-app-shell.md)); the storefront's phone navigation is the bottom tab bar, so a fixed element sits at `bottom-tabbar`, not `bottom-0`; `hidden md:*` on a primary action requires a mobile affordance in the same change; hover is an enhancement, never the only affordance; interactive targets are ≥40px with nothing below `size-9`; overlays carry `max-h-overlay overflow-y-auto` (the one cap token in `globals.css`); inputs keep `Input`'s 16px mobile base (a `text-xs` override reintroduces iOS zoom); DOM order is the mobile reading order. ([ADR-0015](docs/adr/0015-mobile-first-design.md))
- **A hook does one thing.** Data fetching, form state, and presentation are three hooks, not one; a hook that returns more than one concern is the seam in the wrong place.
- **Design goes through tokens — every axis, not just colour.** Semantic tokens in `src/app/globals.css` are the only way colour (`primary`, `muted`, `destructive`, `success`/`warning`/`info`, `scrim`, `hero`), type size (`text-4xs`…`text-2xs`, below Tailwind's `text-xs`), tracking (`tracking-label`/`-eyebrow`/`-eyebrow-wide`/`-display`), elevation (`shadow-raised`/`-lifted`/`-overlay`/`-inset-field`) and shape (`rounded-card`/`rounded-field`) reach a className. A literal at the call site — `bg-emerald-50`, `text-[0.7rem]`, `tracking-[0.18em]`, `shadow-lg` — pins one value in one place and turns a redesign into a hunt. Page width and the page title come from `PageShell`/`PageHeader`, never a hand-rolled `mx-auto max-w-*`. `tests/unit/design-tokens.test.ts` enforces all of it. ([ADR-0022](docs/adr/0022-design-decisions-go-through-tokens.md))
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
