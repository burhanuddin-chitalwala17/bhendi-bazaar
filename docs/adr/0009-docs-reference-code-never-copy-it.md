# ADR-0009: Docs reference code by path; they never copy it

- **Date:** 2026-08-03
- **Status:** Accepted
- **Context:** Roughly half of the project's documentation, by line count, sat inside code fences — in the worst files, over 80%. Pasted code is a second copy of a moving target that no compiler checks and no test exercises. It is wrong the instant the original changes, and the cost of resyncing thousands of lines by hand guarantees nobody will, which is why the tree was abandoned wholesale rather than gradually.

  A second failure mode compounded it: documenting intent as fact. Index files listed documents that were never written, and a section headed "Architecture Decisions" recorded five decisions as bare feature bullets with no context, no rejected alternatives, and no consequences — the shape of a decision record without the content that makes one useful. Both failures share a cause: nothing distinguished *what is* from *what was imagined*.

  A sibling project reached the same conclusion independently and encoded it as a rule (`ums-soul` ADR-05: *"no code — at most a few references to existing code to justify a decision, never the code we intend to write"*). This ADR adopts it.
- **Decision:**
  1. **No pasted implementation code in docs.** Reference the code instead — a path plus a symbol name (`server/services/orderService.ts`, `createOrderWithShipments`), falling back to a line number only when no symbol locates the target. A reference is checkable and navigable, and degrades visibly rather than silently.
  2. **Narrow exceptions**, where the text *is* the artifact and is not a copy of application source: shell commands in `OPERATIONS.md`, env-var names, wire-format JSON in `CONTRACTS.md`, and diagrams. A schema or DTO shape in `CONTRACTS.md` is the contract, not a copy of it.
  3. **Docs state what exists.** Planned work belongs in `BACKLOG.md` or a spec, never in `ARCHITECTURE.md` or a README. An index links only to files that exist.
  4. **Every doc carries `Verified: YYYY-MM-DD`** in its header — the date its claims were last checked against the code. Stale is tolerable; *silently* stale is what happened here.
  5. **`/bb-review` checks this**: it flags a doc whose `Verified:` date predates the last structural change to the code it describes, and rejects a diff that adds a fenced code block outside the exceptions above.
  6. **Reference, don't duplicate, across docs too.** The `CLAUDE.md` conventions index points at ADRs rather than restating them, so a rule has exactly one wording.
- **Alternatives considered:**
  - *Keep code samples but add a CI check that they still compile* — rejected. Literate-programming or snippet-extraction tooling can do this, but it is real infrastructure to build and maintain for a solo project, and it addresses staleness while leaving the duplication.
  - *Keep code samples and accept staleness in "illustrative" examples* — rejected. This is exactly the current state; a stale example is read as current and misleads more than no example.
  - *Generate API reference docs from source (TypeDoc, Prisma docs generators)* — not rejected, but out of scope: generated reference is a different artifact from the reasoning these docs are for. `prisma/schema.prisma` already *is* the schema reference, which is why a hand-written schema document is redundant with it — and was the single most drifted file in the superseded tree.
  - *Cap doc length instead* — adopted as a **complement** in [ADR-0010](0010-spec-convention.md), not an alternative. A length cap limits the damage; this rule removes the cause.
- **Consequences:**
  - ✅ Docs stop being invalidated by unrelated refactors, so the marginal cost of keeping them true collapses.
  - ✅ Docs get shorter and denser, holding the reasoning that code cannot express — which is the only thing a doc is uniquely good for.
  - ✅ Broken path references are mechanically detectable; a stale pasted snippet is not.
  - ⚠️ Reading a doc now often means opening the referenced file. Acceptable: a reference that sends you to the truth beats a copy that lies. Docs should quote a symbol name and describe behaviour so the reference is usually unnecessary.
  - ⚠️ Line numbers drift even when paths do not. Prefer `path/file.ts` plus a symbol name; use a line number when pointing at something a symbol name cannot locate.
  - ⚠️ Adopting this rule does not make the existing documentation compliant. The disposition of the superseded tree is a separate decision, recorded in the CHANGELOG when taken.
