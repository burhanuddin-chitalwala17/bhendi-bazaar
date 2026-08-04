# CHANGELOG

## Format
- **Append-only.** Never edit an old entry; corrections go in as new entries.
- Newest entries at the top.
- Entry header: `## [PR-NN] YYYY-MM-DD — Short title`
- Add `[CONTRACT]` when a DTO in [CONTRACTS.md](CONTRACTS.md) changed — the signal that client and server must move in lockstep.
- Add `[MIGRATION]` when the PR includes a Prisma migration, so a deploy knows to run one.
- One entry per merged PR. Cross-domain changes are recorded here; domain-internal changes go in that domain's own CHANGELOG.

## Entries

## [PR-02] 2026-08-04 — `server/` restructured into vertical slices by domain

Implemented [ADR-0012](adr/0012-modules-are-vertical-slices-by-domain.md). `server/` had been organised along three competing axes — by layer (`services/`, `repositories/`, `domain/`), by domain (`shipping/`), and by caller (`admin/`) — and is now one directory per bounded context, each owning its own service, repository, and types.

Nine domains: `catalog` (19 files), `cart` (6), `checkout` (6), `payments` (3), `shipping` (26), `identity` (9), `notifications` (7), `analytics` (3), plus `shared` (6). The `admin/`, `repositories/`, `services/`, and `domain/` trees are gone.

Three decisions taken during the migration, recorded here because they resolve ambiguities ADR-0012 did not anticipate:
- **`analytics` is a new ninth domain.** The dashboard read-model reads `order`, `product`, `review`, and `user`, so it had no owner. It is explicitly read-only and the one documented exception to the no-cross-domain-reads rule.
- **The audit log went to `shared/audit/`**, not a domain. It is written from services across five domains, which makes it infrastructure rather than a business concern.
- **Reviews folded into `catalog`.** A review drives `Product.rating` and `reviewsCount`, so it is a property of a product in this data model.

`server/services/shipping/mockShippingIntegration.ts` is **deliberately left outside every domain**. Moving it into `shipping` would place a mock inside the tree whose own rules forbid one; deleting it is a behaviour change belonging to [shipping-fulfilment](specs/shipping-fulfilment/). Its homelessness is the marker.

Measured effects:

| | Before | After |
|---|---|---|
| `@server/*` alias imports | 11 | **167** |
| Deep relative imports into `server/` | 64 | **0** |
| `server/` → `src/` imports (inverted) | 24 | **4** |

The inversion collapsed because 22 of the 24 were `@/lib/prisma`, now `server/shared/prisma.ts`. The remaining four are type-only imports of DTOs declared on both sides — a contract change rather than a move, tracked in [CONTRACTS.md](CONTRACTS.md). `Pagination` was split out of the old `server/types.ts` into `shared/`, and the duplicate `ProductFlag` in the dashboard now points at the canonical `catalog` declaration.

Also fixed in passing, since the file moved anyway: `adress.service.ts` → `identity/address.service.ts`, retiring a misspelling that was load-bearing in two import paths.

**Pure move — no logic changed.** Verified by `tsc --noEmit` after each of the nine steps and a full `next build` at the end; all 74 routes compile. Docs updated per ADR-0012 decision 8: [ARCHITECTURE.md](ARCHITECTURE.md), the root [`CLAUDE.md`](../CLAUDE.md) domain table, and `server/services/CLAUDE.md` split into `server/checkout/CLAUDE.md` and `server/payments/CLAUDE.md`.

## [PR-01] 2026-08-03 — Documentation system: CLAUDE.md, ADRs, specs, skills
Established the project's documentation and decision-record system, ported from the `ums-soul` / `ums-sentinel` structure and adapted for a monorepo ([ADR-0001](adr/0001-monorepo-doc-structure.md)).

**Root `CLAUDE.md`** as the always-loaded rule surface — there was previously no `CLAUDE.md` anywhere, so no project rule reached an agent session. It carries seven Project Invariants, the domain map, the Lite SDLC cycle, and a canonical index of standing conventions in which each entry is a one-line pointer to its ADR, so detail cannot drift. Held under the 200-line guidance. Domain rules co-locate as `<domain>/CLAUDE.md` and load lazily — only when a file in that directory is read — so they cost no context until relevant.

**`docs/adr/`** with a README index and nine records establishing the rules the codebase is held to: docs structure, server-side pricing authority, one repository per aggregate, integer paise, server-only payment state, conditional stock reservation, docs-reference-code, spec layout, and `server/` as vertical slices by domain.

The README states a two-part test for when an ADR is warranted — genuine alternatives existed, *and* the choice constrains future work in a way someone could reasonably undo, the sharpest signal being that the rejected option is the more conventional one. Three drafted records (0006 boundary validation, 0008 seed safety, 0011 CI gates) failed it: each held one small decision wrapped in well-established practice. Their substance moved to `CLAUDE.md` Invariants 4 and 7 and to [TESTING.md](TESTING.md)'s CI-gates section; the numbers stay absent rather than being reused. The README also records that an ADR is not what makes a rule followed — ADRs are not loaded into a session, so a convention-setting ADR needs a pointer line in `CLAUDE.md`'s conventions index.

**The docs hub** — [ARCHITECTURE.md](ARCHITECTURE.md) (current state), [CONTRACTS.md](CONTRACTS.md) (client↔server DTOs), [BACKLOG.md](BACKLOG.md) (phased milestone map), [TESTING.md](TESTING.md), [DEPENDENCIES.md](DEPENDENCIES.md), [OPERATIONS.md](OPERATIONS.md), [INTEGRATIONS.md](INTEGRATIONS.md), [README.md](README.md) as a map, and [specs/](specs/).

**Six specs** covering Phase 2 and Phase 3 of [BACKLOG.md](BACKLOG.md), each `spec.md` (requirements) + `trd.md` (technical approach, no code), under the ≤100 readable-line cap ([ADR-0010](adr/0010-spec-convention.md)).

**Three skills** — `/bb-review`, `/bb-sdlc`, `/bb-brainstorm` — so the SDLC is invoked rather than recalled. `/bb-review` checks the seven Invariants against a diff, which is what makes `CLAUDE.md` enforcement rather than intention.

**Domain docs** for payments, checkout, and shipping: `CLAUDE.md`, `ARCHITECTURE.md`, and `adr/` co-located with each domain's code.

The seventeen pre-existing doc files moved to [_archive/](_archive/) with `git mv`, so `git log --follow` still reaches their history. Roughly half their content was pasted implementation code and three quarters of their internal links were dead; a single notice in the archive records what is worth mining and marks the rest untrustworthy. Nothing was deleted.

No code, schema, or dependency changes — documentation only.
