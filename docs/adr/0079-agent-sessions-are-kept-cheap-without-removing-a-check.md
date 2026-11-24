# ADR-0079: Agent sessions are kept cheap without removing a check

- **Date:** 2026-11-24
- **Status:** Accepted

## Context

Development runs through Claude Code, and its cost is the context it carries times the steps it takes. Three habits
inflated both: each gate ran as its own command whose full output entered the context, a failing fix was retried
in variations until the session was large, and nothing stopped a read of files no change is decided from
(`package-lock.json`, build output, the frozen changelog). The owner asked for a cheaper process on the condition
that no quality gate is weakened.

## Decision

1. `npm run gate` (`scripts/gate.sh`) runs the blocking checks CI runs before deploy — `tsc --noEmit`,
   `npm run test:unit` (which includes `docs:check`) and `npm run lint:boundary` — every one of them, and prints a
   line per check and only the failing lines. Integration tests stay `npm run test:integration`, against the
   disposable database.
2. When the same check fails twice for the same reason, the session stops and reports what it tried and its
   hypothesis, and waits for the owner. A third variation is not attempted.
3. `.claude/settings.json` denies reading `package-lock.json`, `.next/`, `node_modules/` and `docs/archive/`.
4. `npm run adr:new` (`scripts/adr-new.mjs`) numbers, names and indexes a new ADR from the template; the author
   writes the prose.

## Alternatives

- **Run fewer checks per unit** (typecheck only, tests at merge). Rejected: the cost is the output read, not the
  run, and a defect found at merge costs a whole session to find again.
- **Leave it to the owner's discipline** (`/clear`, interrupting loops by hand). Rejected as the only measure: a
  rule a session loads holds when nobody is watching.

## Consequences

- ✅ A unit's gate costs a few lines of context instead of four full runs; a stuck fix costs two attempts, not ten.
- ✅ The checks themselves are unchanged — the same commands, the same exit codes, the same CI.
- ⚠️ `gate.sh` filters output by pattern; a failure whose lines match none still shows `FAIL` with no detail, and
  the session then runs that check directly.
- ⚠️ A denied path cannot be read even when it would help (a lockfile conflict); the owner lifts the rule for that
  session.
