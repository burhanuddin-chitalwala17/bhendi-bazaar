---
name: bb-brainstorm
description: Research-only spike for bhendi-bazaar. Investigates a technical question before a TRD is written — library options, external-service behaviour, Postgres and Prisma capabilities, failure modes — and outputs findings, not code. Invoke before /bb-sdlc spec-start on anything non-trivial. Examples — "/bb-brainstorm how should product search be indexed", "/bb-brainstorm Razorpay refund API", "/bb-brainstorm should mutations move to Server Actions".
---

# /bb-brainstorm — research spike

Investigates a question so a TRD can rest on something. **Research only.**

## Rules

1. **No code.** Do not implement, do not edit application files, do not create a branch. The output is understanding.
2. **No decision.** Present options with trade-offs. The decision is made in a TRD or an ADR, by the user.
3. **Verify, don't recall.** For anything about this codebase, read the code. For anything about an external service, check current documentation — an API's behaviour today is not necessarily what it was. **For the shape of a solution, check what the field actually does** ([ADR-0046](../../../docs/adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md)): a design can be internally sound, consistent with everything around it, and a named anti-pattern. Our own prevailing pattern is evidence, never authority.
4. **Say what you could not determine.** An unresolved unknown is a finding; a confident guess is a liability, especially about payment or courier behaviour.

## Where to look

- **This codebase** — read it. Note what already exists: a capability may be half-built (a column with no reader, an interface with one implementation, a helper with no callers). Half-built is a different starting point from nothing, and often the more important finding.
- **Existing decisions** — `docs/adr/` and the domain `adr/` folders. A question may already be answered, or answered and superseded. Check before researching afresh.
- **`docs/INTEGRATIONS.md`** — accumulated external-service behaviour. Read it first for anything gateway-, courier-, or email-related, and add to it as you learn.
- **External docs** — the provider's own current documentation for Razorpay, Shiprocket, Resend, Cloudflare R2, fal.run (image model host), Prisma, Next.js (and `node_modules/next/dist/docs/` for the installed version).
- **The database** — `prisma/schema.prisma` is the authoritative schema. For questions about query behaviour, Postgres capability often matters more than Prisma's surface.

## Constraints to respect

A spike that proposes something the project has ruled out wastes the spike. Check against:

- The **seven Project Invariants** in [CLAUDE.md](../../../CLAUDE.md). Anything that would require relaxing one needs an ADR superseding the relevant record, and that should be stated explicitly as part of the finding.
- **YAGNI.** This is a solo project running a real store. Prefer the smallest thing that satisfies the requirement. Note when an option is genuinely more capable but disproportionate.
- **The host is a deployment fact, not a design input** ([ADR-0037](../../../docs/adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md)). The web app runs as request-scoped functions: no in-memory state across requests, cold starts, connection limits. Long-running and background work belongs on the owned worker against the Postgres job queue ([ADR-0038](../../../docs/adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)). An option tied to one vendor's feature names its exit.
- **A single Postgres.** A new piece of infrastructure (a cache, a queue, a search service) is not viable until its operational cost is named. Upstash rate limiting is parked, not available.

## Output

Findings, written for the user to decide from. Structure that fits the question, but generally:

- **The question**, restated precisely — often the useful first result is that the question was ambiguous.
- **What already exists** here, if relevant.
- **Options**, each with what it costs, what it forecloses, and what it assumes.
- **Failure modes** — how each option behaves when the external service is slow, down, or returns something unexpected. For payment and shipping this is usually the deciding factor rather than the happy path.
- **A recommendation**, clearly marked as one, with the reasoning.
- **Open questions** the spike could not close, and what would close them.

## Then

- Durable external-service behaviour → add it to `docs/INTEGRATIONS.md`.
- A decision the spike makes obvious → `/bb-sdlc adr-new`.
- A feature ready to specify → `/bb-sdlc spec-start`.

Do **not** write findings into a project doc as a standing record of problems. A spike's output belongs in a TRD, an ADR, or `INTEGRATIONS.md` — never as a bug list that will go stale.
