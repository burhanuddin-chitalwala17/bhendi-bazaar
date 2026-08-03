---
name: bb-sdlc
description: Operational SDLC flows for bhendi-bazaar. Three subcommands — spec-start (scaffold a feature folder with spec.md + trd.md in docs/specs/), adr-new (add a decision record to docs/adr/ or a domain's adr/), pr-finish (walk the pre-merge checklist). Invoke during the SDLC cycle. Examples — "/bb-sdlc spec-start order-cancellation", "/bb-sdlc adr-new switch product search to pg_trgm", "/bb-sdlc pr-finish".
---

# /bb-sdlc — operational SDLC flows

Three subcommands. Pick the one matching the invocation.

## Where docs live

- **Project-wide:** `docs/` — `ARCHITECTURE.md`, `CONTRACTS.md`, `BACKLOG.md`, `CHANGELOG.md`, `DEPENDENCIES.md`, `TESTING.md`, `OPERATIONS.md`, `INTEGRATIONS.md`, `adr/`, `specs/`.
- **Domain-internal:** co-located with the code — `<domain>/CLAUDE.md`, `<domain>/ARCHITECTURE.md`, `<domain>/adr/`, `<domain>/CHANGELOG.md`.

When something below says "the relevant `ARCHITECTURE.md`", choose by scope: one domain → that domain's; crossing domains → `docs/`.

---

## Subcommand: `spec-start <feature-name>`

Scaffolds a feature folder under `docs/specs/`. Convention: [ADR-0010](../../../docs/adr/0010-spec-convention.md).

### Steps

1. **Name it.** `kebab-case`, descriptive, **no number**. One feature per folder.
2. **Check for overlap.** Scan `docs/specs/` for an existing or obviously adjacent folder. If the work belongs to an existing feature, add a **subfeature subfolder** rather than a second top-level folder.
3. **Confirm it is a requirement, not a defect.** A spec states what must be true. If the rule is already stated in an ADR and the work is simply making the code obey it, **no spec is needed** — that is a PR. Push back rather than scaffolding a spec whose content would be a bug report; a spec should still read correctly after the work lands.
4. **Write `spec.md` — requirements and product approach only.** No technical approach, package choices, data-model or algorithm decisions. Those go in the TRD. Frame requirements as properties of the product, in language that survives the implementation.

```markdown
# Spec — <feature>

- **Status:** Draft
- **Domain:** <bounded context from CLAUDE.md, or cross-domain>
- **Phase:** <phase from BACKLOG.md>
- **Verified:** YYYY-MM-DD
- **References:** trd.md, relevant ADRs, related features

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
One or two lines, in product terms.

## Why
The product or user reason it exists. Not "X is broken" — what should be true and why it matters.

## Requirements
- R1 — …

## Product acceptance
- A1 — how we know it works, from the outside.

## Out of scope (this feature)
What belongs to other features or phases, with links.
```

5. **Confirm a spike exists before the TRD.** A TRD captures technical decisions and should rest on something — a `/bb-brainstorm`, an existing ADR, or a genuine constraint. If the feature is non-trivial and nothing has been investigated, offer `/bb-brainstorm` first.

```markdown
# TRD — <feature>

- **Status:** Draft
- **Domain:** …
- **Phase:** …
- **Verified:** YYYY-MM-DD
- **References:** spec.md, the spike, ADRs

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
The chosen approach, and what makes it the right shape.

## Technical decisions
- D1 — decision + rationale (+ reference).

## Packages
New dependencies, cross-referenced to DEPENDENCIES.md. "None" if none.

## Data model
Schema changes. Flag [MIGRATION]. "None" if none.

## API / contract changes
Touches docs/CONTRACTS.md? If so the PR carries [CONTRACT] and CONTRACTS.md moves in lockstep. "None" if none.

## Test plan
The tests that will exist when done, cross-referenced to TESTING.md.

## Delivery (PRs)
Small PRs, each independently verifiable. Say which one changes behaviour.

## Open questions
Must be closed before Draft → Accepted.
```

6. **Enforce the cap.** ≤100 **readable** lines each — prose only, excluding front-matter, headings, table rows, fenced blocks, link-only lines, and blanks. Over the cap → split into subfeatures. Count it; don't estimate.
7. **Add a row** to `docs/specs/README.md`, and to `docs/BACKLOG.md` under its phase.

---

## Subcommand: `adr-new <title>`

Adds an immutable decision record. Format and rules: [docs/adr/README.md](../../../docs/adr/README.md).

### Steps

1. **Choose scope.** Cross-domain or project-wide → `docs/adr/`. Internal to one domain → that domain's `adr/`. Each sequence numbers independently from 0001.
2. **Number it** — highest existing in that folder + 1, zero-padded to four digits. Filename `NNNN-kebab-title.md`.
3. **Check it is a decision, not a task.** An ADR records a choice between alternatives that constrains future work. If there were no real alternatives, it is not an ADR.
4. **Write it:**

```markdown
# ADR-NNNN: Title

- **Date:** YYYY-MM-DD
- **Status:** Proposed / Accepted
- **Context:** Why was this needed? What forces are at play? State the problem and the pressure — 2–4 sentences. Not an enumeration of defects: an ADR is immutable, so it should read as well in a year as today.
- **Decision:** What was decided. Numbered, specific enough to be checkable.
- **Alternatives considered:** What else was on the table and why each was rejected. **An ADR with no rejected alternatives is not recording a decision.** Include the option a reasonable person would have chosen — often the textbook answer — and say why it lost here.
- **Consequences:** ✅ what gets easier, ⚠️ what gets harder or riskier. Be honest about the costs; an ADR listing only benefits is advocacy.
```

5. **Add a row** to that folder's `README.md` index.
6. **To reverse a past decision:** write a new ADR, then edit **only** the old one's `Status` line to `Superseded by ADR-NNNN` and add a pointer. Never edit a past Context, Decision, or Alternatives.
7. **If the decision sets a standing convention**, add a one-line pointer to the *Documentation & Process Conventions* index in the root `CLAUDE.md`. A rule that lives only in an ADR will not be followed — ADRs are not loaded into a session; `CLAUDE.md` is.

---

## Subcommand: `pr-finish`

Walks the pre-merge gate. Report each item as pass, fail, or not-applicable — do not fix silently.

1. **`/bb-review` has been run** and its findings addressed. If not, run it now; this is the substantive check and the rest is bookkeeping.
2. **Tests exist** for changed logic, and pass. `npm run test:run`.
3. **Typecheck passes.** `npx tsc --noEmit`.
4. **Lint** introduces no new errors.
5. **CHANGELOG entry** added — newest at top, one per PR, append-only. `[CONTRACT]` if a DTO changed, `[MIGRATION]` if a migration was added.
6. **A TRD exists** if the PR changes architecture or data flow, adds a package, starts a feature, or changes a contract.
7. **Docs updated** where they are now wrong: the relevant `ARCHITECTURE.md` if structure changed, `CONTRACTS.md` if a DTO changed, `DEPENDENCIES.md` if a package was added, `OPERATIONS.md` if setup or deploy changed. Bump each touched doc's `Verified:` date.
8. **Spec status moved** if this PR completed one — `Draft` → `Implemented` in the spec and in `docs/specs/README.md`, and the row in `BACKLOG.md`.
9. **No findings written into docs.** Defects fixed in this PR should leave no trace as documentation; the CHANGELOG records what changed, and that is enough.
10. **Branch is not `main`.** Commit or push only when asked.

Report the checklist with its verdicts, then state plainly whether the PR is ready.
