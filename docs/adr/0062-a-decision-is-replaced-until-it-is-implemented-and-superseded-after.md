# ADR-0062: A decision is replaced until it is implemented, and superseded after

- **Date:** 2026-10-20
- **Status:** Accepted
- **Context:** [ADR-0061](0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md) D2 made every feature's `decisions.md` append-only, so a changed answer was kept as a superseded row beside its replacement. During planning that is mostly noise. On 2026-10-20 the owner changed two channel-connectors answers within an hour of making them; the log gained two dead rows and two new ids, and every document citing the old ids had to follow a chain. Nothing had been built on the old answers, so the history protected no one. History matters once code, tests or other features depend on an answer, because then the record of why it changed is what stops someone restoring the old behaviour.
- **Decision:**
  1. **A decision that is not yet implemented is replaced in place.** Its answer, decider, date and why are overwritten, and the why ends with `was: <old answer>`, so the change is visible without a second row. Its id stays the same, so every citation stays correct.
  2. **A decision that is implemented is superseded, never edited.** A new row carries the new answer; the old row's State becomes `superseded by Qn`. Code, tests or a merged feature depending on it is what counts as implemented.
  3. **States:** `open`, `decided`, `implemented`, `superseded by Qn`, `parked`. `/bb-build` moves a Q from `decided` to `implemented` in the unit that ships it, naming the unit. `decided` and `implemented` bind; `superseded` defers to the Q it names; `open` blocks; `parked` is out of scope.
  4. ADR-0061 D2 is amended to this; the rest of ADR-0061 stands.
- **Alternatives considered:**
  - *Append-only always, as ADR-0061 had it* — rejected. It treats a planning conversation like shipped code. The log fills with dead rows, ids multiply, and citations chain, which makes decisions harder to find, the problem ADR-0061 set out to solve.
  - *Edit in place always* — rejected. Once an answer is in code, silently changing it removes the only record of why the code is the way it is, and a later reader cannot tell which version the code followed.
  - *Replace until the spec is Accepted* — rejected. Acceptance is a document milestone; what makes history worth keeping is something depending on the answer, and parts of an accepted spec may still be unbuilt.
- **Consequences:**
  - ✅ A planning log stays one row per question, and ids never chain before anything is built.
  - ✅ History is kept exactly where it protects something.
  - ⚠️ `/bb-build` must mark Qs `implemented` as it ships them. A missed mark lets a built decision be replaced in place; `/bb-review` checks for it.
