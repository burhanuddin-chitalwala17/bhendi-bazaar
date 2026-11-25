# ADR-0084: Main holds only finished work; planning lives on its feature branch

- **Date:** 2026-11-25
- **Status:** Accepted (owner, 2026-11-25). Amends [ADR-0001](0001-monorepo-doc-structure.md) D1 and D5 (`specs/` as the home of forward plans on main), [ADR-0073](0073-a-shipped-feature-keeps-its-spec-and-decisions-and-drops-its-ux-and-trd.md) (what a shipped folder keeps) and [ADR-0081](0081-the-mechanical-steps-of-the-cycle-are-scripts.md) D2 (what `spec:status` deletes)

## Context

By 2026-11-25 main carried 36 things that were not finished work: Draft, Accepted and In-progress spec folders
with their TRDs, ux decks and prototypes, TRDs left beside shipped specs, and a `handoff/` folder of build
prompts. A session reading main could not tell a plan from a fact, and a plan merged early drifted from the
branch where it was still being changed. ADR-0001 had made `docs/specs/` the home of forward plans and nothing
said when a plan may reach main, so each merge brought some along.

## Decision

1. **Main holds code, the living docs (ARCHITECTURE, CONTRACTS, CONVENTIONS, OPERATIONS, BACKLOG and the rest),
   ADRs, and for each shipped feature its `spec.md` and `decisions.md` — nothing else from planning.** A spec
   folder is on main only when its Status ships (`ships()`, a Status beginning with Implemented).
2. **Planning lives on the feature branch.** spec-start, ux-start, the TRD and the handoff are written and
   committed there, and reach main only in the merge that ships the feature, already retired. A container
   folder with no `spec.md` may hold child spec folders and nothing else. No `handoff/` folder or other session
   notes on main.
3. **Retiring keeps the reasoning.** `npm run spec:status -- <feature> Implemented` deletes every file in the
   folder but `spec.md` and `decisions.md`, pins links into them as `<sha>:path`, and first refuses if any Q id
   they cite is missing from `decisions.md`, since that is where the why survives. An id belonging to another
   log is written `<feature> Qn` or `parent Qn`.
4. **Enforced in three places:**
   - `tests/unit/finished-work.test.ts`, in the gate on every branch: a shipped folder holds only `spec.md` and
     `decisions.md`, and has a `decisions.md` (features shipped before ADR-0061 are a ratchet allowlist).
   - `npm run check:main-ready` (`scripts/main-ready.mjs`), not in the gate because a feature branch
     legitimately carries plans: fails, naming each offender and its fix, on `handoff/`, any spec folder whose
     Status does not ship, and any other file in a shipped folder. `/bb-sdlc pr-finish` runs it before a merge.
   - `.githooks/pre-push` runs that check on the tree of each commit pushed to `refs/heads/main`, read with
     `git ls-tree`/`git show`, so a push from any worktree is judged by what lands. `git push --no-verify`
     skips it; that is for an emergency the owner chooses, never a session's way round a refusal.
5. The Q-id check is not in the gate: a shipped spec cites its parent's ids in prose (`(Q42)` after a link to
   the parent log) that no pattern tells apart from its own, and once the TRD is gone there is nothing left to
   compare. It runs where the TRD still exists, at retirement.

## Alternatives

- **Keep plans on main, marked by Status** (the practice until now). Rejected: a Status line is one header in a
  long file, and sessions read the plan as current fact; plans also changed on two branches at once.
- **A separate planning repository or a `planning` branch for all features.** Rejected: the plan and the code it
  plans would travel apart, and one long-lived branch collects every feature's conflicts.
- **Enforce in CI on main only.** Rejected: CI runs after the push has landed; the hook refuses before it, and
  the gate test keeps the always-true half honest on every branch.

## Consequences

- ✅ Everything under `docs/specs/` on main is shipped requirement plus reasoning; the BACKLOG names what is planned.
- ✅ A retired TRD cannot take a decision with it.
- ⚠️ A plan is visible only on its branch; reading one means checking that branch out. What main held on
  2026-11-25 is kept on branch `planning-archive-2026-11-25`.
- ⚠️ The hook is active only once `core.hooksPath` points at `.githooks` (`npm install`'s `prepare` sets it).
- ⚠️ A programme parent whose Status does not ship cannot sit on main above its shipped children, though they
  cite its decisions; each such parent is the owner's call.
