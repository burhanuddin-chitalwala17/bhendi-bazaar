# Documentation

- **Verified:** 2026-08-03

A map of this directory. Every link here points at a file that exists — if one does not, that is a defect ([ADR-0009](adr/0009-docs-reference-code-never-copy-it.md)).

Project-wide rules live in [../CLAUDE.md](../CLAUDE.md), not here. That file is loaded into every agent session; this directory is read on demand.

## The organising idea

Docs are split by **volatility**, not by topic ([ADR-0001](adr/0001-monorepo-doc-structure.md)). Each file below changes for exactly one reason, so "partly stale" is not a state it can be in.

| Document | Holds | Changes when |
|---|---|---|
| [../CLAUDE.md](../CLAUDE.md) | Rules, invariants, conventions index | A rule changes (rarely) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | What exists **now**, at HLD level | Structure changes — updated *after*, never before |
| [adr/](adr/) | Why each decision was made | Never. A new ADR supersedes an old one |
| [CONTRACTS.md](CONTRACTS.md) | Shapes crossing the client/server boundary | A DTO changes → PR flagged `[CONTRACT]` |
| [specs/](specs/) | Work not yet built | A feature is planned or delivered |
| [BACKLOG.md](BACKLOG.md) | Where the project is, phase by phase | A phase starts, blocks, or completes |
| [CHANGELOG.md](CHANGELOG.md) | What happened | Every merged PR. Append-only |
| [DEPENDENCIES.md](DEPENDENCIES.md) | Why each package is here | A package is added, bumped, or removed |
| [TESTING.md](TESTING.md) | Test strategy and coverage targets | The strategy changes |
| [OPERATIONS.md](OPERATIONS.md) | Env vars, deploy, runbook | The deployment or an external service changes |
| [INTEGRATIONS.md](INTEGRATIONS.md) | How Razorpay, Shiprocket, Resend, Vercel and Prisma actually behave | A spike or an incident teaches something durable |

**Domain-level docs co-locate with their code**, not here. They load lazily — only when a file in that directory is read — so they cost no context until relevant. The eight domains are listed in [../CLAUDE.md](../CLAUDE.md); those with docs so far:

| Domain doc | Covers |
|---|---|
| [server/shipping/CLAUDE.md](../server/shipping/CLAUDE.md) + [ARCHITECTURE.md](../server/shipping/ARCHITECTURE.md) + [adr/](../server/shipping/adr/) | Shipping — the one domain with a real provider abstraction, so the one with its own ADR sequence |
| [server/services/CLAUDE.md](../server/services/CLAUDE.md) | Checkout and payments. One file for two domains because this tree is organised by layer, not domain; it splits when [ADR-0003](adr/0003-one-repository-per-aggregate.md) consolidation gives each a directory |

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
- **Specs are feature folders**, `kebab-case`, no numbering; `spec.md` (product) + `trd.md` (technical, no code); ≤100 readable lines each ([ADR-0010](adr/0010-spec-convention.md)).
- **ADRs are immutable.** Supersede, never edit.

## Workflows

Invoke these rather than recalling the steps: `/bb-brainstorm <topic>` (research before a TRD), `/bb-sdlc spec-start|adr-new|pr-finish`, `/bb-review` (before any PR is done — checks the Invariants).

## [_archive/](_archive/) — ⚠️ do not trust

The pre-2026-08 documentation, superseded and retained for salvage only. 49% of its lines were pasted code and 76% of its links were dead; it contains statements now known to be false. See [_archive/README.md](_archive/README.md) for what is worth mining and what is not.
