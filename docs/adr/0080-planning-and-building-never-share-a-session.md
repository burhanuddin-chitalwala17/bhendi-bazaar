# ADR-0080: Planning and building never share a session

- **Date:** 2026-11-24
- **Status:** Accepted

## Context

A feature was usually planned and built in one Claude session. By the time the TRD was accepted the session held
the whole planning conversation, often over 100k tokens, and every build step re-sent it: dozens of tool calls,
each paying for discussion the TRD already records. The owner rarely replies during a build, but the cost is in
the agent's own steps, not the replies. A rule to "start a new session" was left to memory and did not hold.

## Decision

1. An Accepted TRD ends the planning session. Its last output is the handoff — one `/bb-build <feature> unit <n>`
   prompt per Delivery unit, each marked `after U<k>` or `independent` — and the session stops.
2. `/bb-build` refuses to build in a session that wrote or discussed the feature's spec, ux or TRD; it prints the
   handoff instead. A build session builds one unit, or one run of dependent units, then ends.
3. Units are started by the owner, or by the planning session when asked: sequential units one after another,
   independent units in parallel only when no two touch the same files, each on its own branch. The starter does
   not watch them.
4. A TRD's Delivery list says, per unit, `after U<k>` or `independent`.

## Alternatives

- **A line in personal Claude memory.** Rejected: it does not reach sessions on another machine or sessions
  another session starts. The repository is what every session reads.
- **Continue in the planning session after `/compact`.** Rejected: a summary still carries planning detail, and
  loses decisions in ways nobody checks; the TRD and `decisions.md` are the checked summary.
- **Always fan out every unit in parallel.** Rejected: most units depend on the one before, and parallel branches
  touching the same files cost a merge that is dearer than the time saved.

## Consequences

- ✅ Each build step carries the TRD and the files it touches, not the conversation that produced them.
- ✅ The TRD has to be complete enough to build from alone — a gap shows up as a question in the build session.
- ⚠️ Each new session spends roughly 20k tokens orienting itself; a two-step unit may cost more than it saves.
- ⚠️ A question raised in a build session goes into `decisions.md`, not back to the planning conversation.
