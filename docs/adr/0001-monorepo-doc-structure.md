# ADR-0001: Monorepo docs split by volatility; domain docs co-located with code

- **Date:** 2026-08-03
- **Status:** Accepted
- **Context:** The project had ~10,000 lines of documentation and no working documentation *system*. Three structural problems, each with a different remedy: roughly half the content was pasted implementation code rather than references to it, so the tree invalidated itself on every refactor; there was no always-loaded rule surface at all, so no project convention reached an agent session; and no file had a single reason to change, so every document was simultaneously a tutorial, a reference, and a plan, and therefore permanently half-stale. A sibling project (`ums-soul`) had already converged on a structure that solves all three, so this ADR ports it rather than rediscovering it. The monorepo question — where the per-service layer goes when there are no separate service repos — is the only genuinely new decision here.
- **Decision:**
  1. **Split docs by volatility, not by topic.** Each of these has exactly one home: *rules* (`CLAUDE.md`), *current state* (`ARCHITECTURE.md`), *immutable decisions* (`adr/`), *forward plans* (`specs/`), *history* (`CHANGELOG.md`), *registries* (`DEPENDENCIES.md`, `TESTING.md`, `CONTRACTS.md`, `OPERATIONS.md`). A file that would have to change for two different reasons is split.
  2. **The root `CLAUDE.md` is the always-loaded surface** and carries a canonical index of standing conventions, each a one-line pointer to its ADR. It points rather than duplicates so detail cannot drift, and it stays under 200 lines per Claude Code's stated guidance.
  3. **Domain docs co-locate with code** — `<domain>/CLAUDE.md`, e.g. `server/shipping/CLAUDE.md`. Claude Code loads subdirectory `CLAUDE.md` files **lazily**, only when a file in that directory is read, so co-located rules cost no context until relevant. Nested `.claude/skills/` behave the same way.
  4. **ADRs are one file per decision** in `docs/adr/` with a README index, append-only, superseded rather than edited.
  5. **Planning centralizes, implementation federates.** `specs/` and `BACKLOG.md` live in `docs/` because a feature may span domains; `CLAUDE.md` and `ARCHITECTURE.md` federate to the domain that owns them.
- **Alternatives considered:**
  - *Polish the existing tree in place* — rejected on measurement. At 49% pasted code and 76% dead links, the salvageable signal is under 10 pages; correcting it costs more than rewriting and leaves a tree whose shape still encourages inlining code.
  - *Centralize everything under `docs/domains/<domain>/`* — rejected. It reads well as a map but sits far from the code, so it is easy to forget, and it forfeits the lazy-loading property that makes co-located `CLAUDE.md` free.
  - *Keep a single top-level `docs/` with no domain layer* — rejected. With eight bounded contexts, one `ARCHITECTURE.md` either exceeds the line cap or omits detail; the cap exists precisely to force this decomposition.
  - *`@import` the detail into `CLAUDE.md`* — rejected. Imports are resolved **eagerly at launch**, so they organize without reducing token cost. Path-scoped `.claude/rules/` is the lazy alternative where a rule is genuinely file-pattern-specific.
  - *Delete the old tree outright* — rejected in favour of a decision recorded separately; git retains history either way, but a few operational passages (env setup, the shipping admin guide) are worth mining first.
- **Consequences:**
  - ✅ A rule now reaches every session. Previously none did.
  - ✅ Each doc has exactly one reason to change, so "partly stale" stops being possible.
  - ✅ Domain rules are free until relevant, so per-domain guidance can be detailed without taxing context.
  - ✅ The convention index makes a new rule discoverable from the always-loaded file, which is the only place adherence is reliable.
  - ⚠️ Deliberate asymmetry: planning centralizes while rules and architecture federate. Justified (a feature may span domains; a rule belongs to its code) but worth remembering so it does not read as drift.
  - ⚠️ Nine more files to keep honest. Mitigated by the `Verified:` header and by `/bb-review`, which flags a doc older than the last structural change to the code it describes.
