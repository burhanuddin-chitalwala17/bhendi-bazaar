# ADR-0073: A shipped feature keeps its spec and decisions, and drops its ux and TRD

- **Date:** 2026-11-12
- **Status:** Accepted. Amends [ADR-0010](0010-spec-convention.md) (specs are never deleted) and [ADR-0061](0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md) (ux.md stays the reference for built screens); amended by [ADR-0084](0084-main-holds-only-finished-work-planning-lives-on-its-feature-branch.md) (every file but spec.md and decisions.md goes, Q ids checked first; nothing unshipped on main)

## Context

By 2026-11-12, `docs/specs/` held 78 `ux.md` and `trd.md` files (688 KB) for features already built. Once a
feature ships, the code, its copy module and its tests are the truth; a ux deck or TRD starts drifting from them
on the next change, and a new session reading it is misled. The owner reads specs and decisions, not TRDs.

## Decision

1. **When a feature's Status becomes Implemented, its `ux.md` and `trd.md` are deleted in the same commit.**
   `spec.md` (what must stay true) and `decisions.md` (why) stay: neither is recoverable from code.
2. A link into a deleted file becomes a pinned git reference, `` `<sha>:docs/specs/<feature>/trd.md` ``, so a
   D or U id cited from code or tests can still be read with `git show`.
3. Copy modules, not `ux.md`, are the source of a shipped screen's words. A change to a shipped screen updates
   the copy module and, where it changes a requirement, the spec.
4. Supporting artifacts (sweeps, spikes, prototypes) go with the ux and TRD unless the spec still needs them.

## Consequences

- The specs tree holds what is planned in full, and what is built as requirement plus reasoning.
- The spec–TRD status check only applies while both exist.
- Reopening a shipped feature starts a fresh TRD, using the old one from git if useful.
