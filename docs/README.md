# Documentation

- **Verified:** 2026-11-24
- **Covers:** `docs/*.md`, `docs/adr/*.md`, `docs/specs/*/`

A map of this directory. Every link here points at a file that exists — if one does not, that is a defect ([ADR-0009](adr/0009-docs-reference-code-never-copy-it.md)).

Project-wide rules live in [../CLAUDE.md](../CLAUDE.md), not here. That file is loaded into every agent session; this directory is read on demand.

## The organising idea

Docs are split by **volatility**, not by topic ([ADR-0001](adr/0001-monorepo-doc-structure.md)). Each file below changes for exactly one reason, so "partly stale" is not a state it can be in.

| Document | Holds | Changes when |
|---|---|---|
| [../CLAUDE.md](../CLAUDE.md) | Rules and invariants, loaded into every session | A rule changes (rarely) |
| [CONVENTIONS.md](CONVENTIONS.md) | The index of standing conventions, one pointer line per ADR | A convention is added |
| [archive/CHANGELOG-HISTORY.md](archive/CHANGELOG-HISTORY.md) | The retired changelog: monthly summaries to Oct 2026, November's entries | Never — frozen ([ADR-0078](adr/0078-the-changelog-is-retired-and-the-commit-subject-is-the-record.md)) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | What exists **now**, at HLD level | Structure changes — updated *after*, never before |
| [adr/](adr/) | Why each decision was made | Never. A new ADR supersedes an old one |
| [CONTRACTS.md](CONTRACTS.md) | Rules, the error envelope and shared shapes; an index of the per-domain files | A shared shape or a rule changes |
| [contracts/](contracts/) | Each domain's shapes crossing the client/server boundary, one file per domain | A DTO changes → commit flagged `[CONTRACT]` |
| [specs/](specs/) | Work not yet built | A feature is planned or delivered |
| [BACKLOG.md](BACKLOG.md) | Where the project is, phase by phase | A phase starts, blocks, or completes |
| [DEPENDENCIES.md](DEPENDENCIES.md) | Why each package is here | A package is added, bumped, or removed |
| [TESTING.md](TESTING.md) | Test strategy and coverage targets | The strategy changes |
| [OPERATIONS.md](OPERATIONS.md) | Env vars, deploy, runbook | The deployment or an external service changes |
| [INTEGRATIONS.md](INTEGRATIONS.md) | How Razorpay, Shiprocket, Resend, Cloudflare R2, Vercel, Prisma, the marketplaces and Meta actually behave | A spike or an incident teaches something durable |
| [TRACKER.md](TRACKER.md) | Bugs and features from the platform audit | A bug is fixed or a feature is built |
| [GTM-READINESS.md](GTM-READINESS.md) | The 2026-10-31 production/GTM review: scores, blockers, roadmap, progress checks | Never edited; a later review supersedes it |

**Domain-level docs co-locate with their code**, not here. They load lazily — only when a file in that directory is read — so they cost no context until relevant. The thirteen domains are listed in [../CLAUDE.md](../CLAUDE.md); those with docs so far:

| Domain doc | Covers |
|---|---|
| [server/shipping/CLAUDE.md](../server/shipping/CLAUDE.md) + [ARCHITECTURE.md](../server/shipping/ARCHITECTURE.md) + [adr/](../server/shipping/adr/) | Shipping — the one domain with a real provider abstraction, so the one with its own ADR sequence |
| [server/content/CLAUDE.md](../server/content/CLAUDE.md) | Content — image enhancement and the provider-agnostic generation module ([ADR-0076](adr/0076-image-generation-goes-through-one-port-and-models-are-data.md)) |
| [server/checkout/CLAUDE.md](../server/checkout/CLAUDE.md) | Checkout — orders and their lifecycle; the orchestrating domain |
| [server/payments/CLAUDE.md](../server/payments/CLAUDE.md) | Payments — the gateway conversation and the single-writer rule |
| [server/bidding/CLAUDE.md](../server/bidding/CLAUDE.md) | Bidding — timed auctions, and the sale gate that suspends an item from normal sale |
| [server/notifications/CLAUDE.md](../server/notifications/CLAUDE.md) | Notifications — transactional email |
| [server/subscriptions/CLAUDE.md](../server/subscriptions/CLAUDE.md) | Subscriptions — the paid-feature switches and the one check every domain asks |
| [src/components/CLAUDE.md](../src/components/CLAUDE.md) | The front end — its layers, and the gates each rule answers to (not a domain; loads when a component is read) |
| [src/app/api/CLAUDE.md](../src/app/api/CLAUDE.md) | Route handlers — authorize, parse, delegate, answer (not a domain) |

The remaining domains (`catalog`, `listing`, `cart`, `identity`, `analytics`, `promotions`, `payouts`, `wishlist`, `shared`) have directories but no `CLAUDE.md` yet — one is added when work first touches the domain, per [ADR-0012](adr/0012-modules-are-vertical-slices-by-domain.md) decision 8.

## Where to look

- **"What are the rules?"** → [../CLAUDE.md](../CLAUDE.md). Start with the seven Project Invariants; they are hard blocks.
- **"How does this fit together?"** → [ARCHITECTURE.md](ARCHITECTURE.md)
- **"Why is it done this way?"** → [adr/README.md](adr/README.md) index. If the reason is not there, it was not decided — it drifted.
- **"Why can't I just change this shape?"** → [CONTRACTS.md](CONTRACTS.md)
- **"What am I allowed to trust from the client?"** → [ADR-0002](adr/0002-server-holds-pricing-authority.md) and [Invariant 4](../CLAUDE.md). Short answer: nothing.
- **"How do I run this?"** → [OPERATIONS.md](OPERATIONS.md)
- **"What's next?"** → [BACKLOG.md](BACKLOG.md)

## Conventions

- **No pasted implementation code.** Reference `path/file.ts` plus a symbol name. Exceptions: shell commands, env-var names, wire-format JSON, diagrams ([ADR-0009](adr/0009-docs-reference-code-never-copy-it.md)).
- **Every doc carries `Verified: YYYY-MM-DD`** — the date its claims were last checked against the code. Stale is tolerable; silently stale is not.
- **Specs are feature folders**, `kebab-case`, no numbering; `spec.md` (product) + `trd.md` (technical, no code); `spec.md` ≤100 readable lines, `trd.md` and `ux.md` uncapped ([ADR-0010](adr/0010-spec-convention.md), [ADR-0071](adr/0071-only-the-spec-is-line-capped.md)). Each also holds `decisions.md` (every question, who decided, why) and, for a feature with UI, `ux.md` (journeys, state matrix, copy, signed off before the TRD) ([ADR-0061](adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md)).
- **ADRs are immutable.** Supersede, never edit.

## Workflows

Invoke these rather than recalling the steps: `/bb-brainstorm <topic>` (research before a TRD), `/bb-sdlc spec-start|ux-start|adr-new|pr-finish`, `/bb-build <feature>`, `/bb-review` (before any PR is done — checks the Invariants).
