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
   folder is on main only when its Status ships (`ships()`, a Status beginning with Implemented), or when it is
   a **programme parent**: its own Status does not ship but at least one child spec folder's does. A parent
   stays because its children cite its decisions; it holds `spec.md`, `decisions.md` and child folders only.
   A parent whose children have none of them shipped is planning, and stays on its branch (owner, 2026-11-25).
2. **Planning lives on the feature branch.** spec-start, ux-start and the TRD are written and committed there,
   as are handoff prompts if they are kept as files (`handoff/`, [ADR-0080](0080-planning-and-building-never-share-a-session.md)), and reach main only in the merge that ships the feature, already retired. A container
   folder with no `spec.md` may hold child spec folders and nothing else. No `handoff/` folder or other session
   notes on main.
3. **Retiring keeps the reasoning.** `npm run spec:status -- <feature> Implemented` deletes every file in the
   folder but `spec.md` and `decisions.md`, pins links into them as `<sha>:path`, and first refuses if any Q id
   they cite is missing from `decisions.md`, since that is where the why survives. An id belonging to another
   log is written `<feature> Qn` or `parent Qn`.
4. **Enforced in three places:**
   - `tests/unit/finished-work.test.ts`, in the gate on every branch: a shipped folder holds only `spec.md` and
     `decisions.md`, and has a `decisions.md` (features shipped before ADR-0061 are a ratchet allowlist); a
     programme parent whose children have all shipped holds no planning file either. A parent with a child
     still being planned may carry a parent TRD on that branch, so the gate cannot ask more.
   - `npm run check:main-ready` (`scripts/main-ready.mjs`), not in the gate because a feature branch
     legitimately carries plans: fails, naming each offender and its fix, on `handoff/`, any spec folder whose
     Status does not ship unless it is a programme parent, and any other file in a shipped folder or parent. `/bb-sdlc pr-finish` runs it before a merge.
   - CI's `main-ready` job runs it on every pull request into `main`; the owner makes it a required check.
   - `.githooks/pre-push` runs it on the tree of the tip pushed to `refs/heads/main`, read with
     `git ls-tree`/`git show`, so a local push from any worktree is judged by what lands. `git push --no-verify`
     skips it; that is for an emergency the owner chooses, never a session's way round a refusal.
5. The Q-id check is not in the gate: a shipped spec cites its parent's ids in prose (`(Q42)` after a link to
   the parent log) that no pattern tells apart from its own, and once the TRD is gone there is nothing left to
   compare. It runs where the TRD still exists, at retirement.

## Alternatives

- **Keep plans on main, marked by Status** (the practice until now). Rejected: a Status line is one header in a
  long file, and sessions read the plan as current fact; plans also changed on two branches at once.
- **A separate planning repository or a `planning` branch for all features.** Rejected: the plan and the code it
  plans would travel apart, and one long-lived branch collects every feature's conflicts.
- **Programme parents follow the plain rule** (removed until their own Status ships). Rejected by the owner:
  shipped children cite their parent's decisions and spec, so removing the parent takes reasoning for shipped
  code off main, and a programme can run for months.
- **Enforce only in CI.** Rejected: a check on pushes to main runs after the push has landed, and a direct push
  never meets the PR check. CI guards the GitHub merge, the hook the local push, and the gate test keeps the
  always-true half honest on every branch.

## Consequences

- ✅ Everything under `docs/specs/` on main is shipped requirement plus reasoning; the BACKLOG names what is planned.
- ✅ A retired TRD cannot take a decision with it.
- ⚠️ A plan is visible only on its branch; reading one means checking that branch out. What main held on
  2026-11-25 is kept on branch `planning-archive-2026-11-25`.
- ⚠️ The hook is active only once `core.hooksPath` points at `.githooks` (`npm install`'s `prepare` sets it), and
  the CI job blocks a merge only once branch protection requires it.
- ⚠️ A programme parent on main shows a Status that does not ship; its unshipped children are absent until
  they ship, so the parent's spec can describe more than main holds.
