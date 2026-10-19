---
name: bb-build
description: Implements an accepted spec + TRD for bhendi-bazaar, one unit at a time, with the gates run and recorded at every step — the step between "TRD accepted" and "/bb-review" that used to have no checklist. Refuses a Draft TRD, an open decision, or UI without a signed-off ux.md, plans units from the TRD's Delivery list mapped to R/A/D ids, writes the failing test for each acceptance id first, mutation-tests every new guard and records it, runs /bb-review in a fresh subagent, flips spec and TRD status together, and ends with an acceptance report the owner can walk on a phone. Examples — "/bb-build channel-registry", "/bb-build listing-vocabulary/variants", "build the accepted spec for product-video".
---

# /bb-build — from an accepted TRD to committed units

The owner writes specifications; this skill is what makes the code that follows trustworthy without the owner reading it. Everything below is a step the pipeline used to leave to memory ([CLAUDE.md](../../../CLAUDE.md) SDLC; [ADR-0056](../../../docs/adr/0056-a-gate-against-existing-debt-is-a-ratchet.md) for why gates are recorded, not claimed).

## 0. Refuse what cannot be built yet

Read `docs/specs/<feature>/spec.md`, `decisions.md`, `ux.md` and `trd.md`. Stop and say why if:
- `decisions.md` has an entry still **open** that a unit depends on ([ADR-0061](../../../docs/adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md));
- the feature has UI and `ux.md` is missing, has a blank state-matrix row, or lacks the owner's dated sign-off;
- the TRD's **Status** is Draft with open questions, or it has no **Delivery** list;
- an acceptance id (`A<n>`) is not observable from outside — "works correctly" is not a criterion; given/when/then on a named surface is;
- a **Hazards** entry has no `Answered by D<n>`;
- the TRD introduces a persistence shape, integration pattern or model with no **Prior art** section ([ADR-0046](../../../docs/adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md)).

A spec that changes while code is being written is a moving target: if a decision is reversed mid-build (as channel-registry D10 was), the spec is edited *first*, dated, and the unit plan is re-read.

## 1. Plan the units from Delivery

Emit the unit list as the TRD's Delivery section states it — one commit each — and for every unit the R/A/D ids it closes and whether it changes behaviour. Anything a unit would touch that no id covers is scope creep: log it in `decisions.md` as parked, do not build it. A question that comes up mid-build goes in the log too, decided or asked, before the unit continues. Name the directory rules each unit will meet: [src/components/CLAUDE.md](../../../src/components/CLAUDE.md), [src/app/api/CLAUDE.md](../../../src/app/api/CLAUDE.md), the domain's `CLAUDE.md`. Name the gates the TRD's **Gates touched** section lists; a new allowlist entry needs its reason sentence written now.

## 2. Build each unit, in this order

1. **The failing test first, for each `A<n>` the unit claims.** The test name carries the id (`"… (spec A3)"`) so traceability is greppable. A unit whose acceptance cannot be tested says so in the TRD's Test plan as *verified manually*, with what will be looked at and at which width.
2. **Implement**, following the layer the file sits in. A screen implements every row of its `ux.md` state matrix, with the copy exactly as written; a new state found while building goes back into `ux.md` first. Layers: a route handler authorizes, parses, delegates, answers; a component renders, a hook holds state, an `*ApiClient` makes the call; a write is a named command on the aggregate's one repository ([ADR-0055](../../../docs/adr/0055-an-admin-surface-reads-through-projections-and-writes-through-the-aggregates-one-repository.md)). The PostToolUse hook runs the scanning gates on every save — read its output as a finding, never silence it.
3. **A new guard is mutation-tested before it is trusted.** Break the rule once in the source, watch the test go red, restore. Write the mutation into the CHANGELOG entry: what was broken, that it failed. "Mutation-tested" without the mutation is a claim ([ADR-0056](../../../docs/adr/0056-a-gate-against-existing-debt-is-a-ratchet.md) D4). A test that cannot be made to fail by a realistic change is not worth keeping.
4. **Run the gates:** `npx tsc --noEmit -p .`, `npx vitest run tests/unit`, and the integration suite against the disposable database (`DATABASE_URL` pointing at `bhendi_bazaar_ci` on the local Postgres — see [docs/TESTING.md](../../../docs/TESTING.md)); `npm run lint:boundary`; `npm run docs:check`. Never seed or migrate a database that is not disposable.
5. **Write the CHANGELOG entry** — newest first, `[CONTRACT]` when a DTO or schema in `server/*/*.types.ts`, `src/lib/validation/schemas/` changed (and `CONTRACTS.md` moved in the same unit), `[MIGRATION]` when `prisma/migrations/` gained a folder (and its header says whose data a `DROP` discards). Name the suites that ran.
6. **Review in a fresh context.** Spawn a subagent that has not seen the implementation, hand it `.claude/skills/bb-review/SKILL.md` and the unit's range, and fix every finding before committing. The author's own review is step 2's hook, not this.
7. **Commit** the unit on the working branch. Never push; the owner pushes ([CLAUDE.md](../../../CLAUDE.md) SDLC).

## 3. Close the feature

- **Spec versus shipped:** every R, A and D is either *closed in PR-n*, *deferred — spec updated to say so*, or a finding. A promise the code did not keep (variants D7, 2026-10-04) is exactly what this step exists to catch.
- **Flip Status together**: spec and TRD move to Implemented in the same commit; run `npm run docs:index`; add the row to `docs/BACKLOG.md`. `docs-integrity` fails a spec whose TRD disagrees.
- **Update ARCHITECTURE.md** only if structure changed, and only after it did. A new domain adds itself to `PUBLIC_SURFACE`, the Domains table and `docs/README.md`.
- **The acceptance report**, written for the owner, not for an engineer: one line per `A<n>` — the test that proves it or the manual check that was done, at what width — then one line per `ux.md` state saying how to reach it on the preview, plus the preview URL. The owner's review is walking that list on a phone, not reading the diff.

## Definition of done, per unit

A failing test existed for each acceptance id claimed · the gates pass · a new guard has its mutation recorded · the CHANGELOG entry exists and names the suites that ran · spec and TRD Status agree · no decision it relied on is open · every ux.md state it built is reachable · `/bb-review` ran in a clean context · no allowlist grew without a reason sentence.
