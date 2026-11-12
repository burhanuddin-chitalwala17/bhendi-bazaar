# ADR-0071: A TRD and a UX document are as long as they need; only the spec is capped

- **Date:** 2026-11-12
- **Status:** Accepted
- **Context:** [ADR-0010](0010-spec-convention.md) decision 4 capped `spec.md` and `trd.md` at 100 readable lines, because a document past a certain size stops being reviewed, and an unreviewed TRD is where a bad technical decision hides. [ADR-0061](0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md) decision 3 gave `ux.md` the same cap on prose. The TRD is now read by Claude while building and by `/bb-review` in a fresh context, not by the owner; the owner meets the UX through its prototype and signs that off. On 2026-11-12, writing subscriptions/feature-access, the TRD reached 140 readable lines and was cut to 100 by dropping rationale and enforcement detail a builder needs, not by splitting the feature. The owner then said: "i dont want it to have a restriction of 100 lines anymore since i am not reading a trd anymore it can be of whatever size it needs to be", and next: "You can drop the UX line cap as well."
- **Decision:**
  1. **`trd.md` has no line cap.** It holds every technical decision with its reason, every enforcement point and the test plan, at whatever length that takes.
  2. **`ux.md` has no line cap.** Every journey, state and line of copy the owner signs off belongs in it.
  3. **Every other rule stands:** the TRD is technical approach only, no code, references to existing code by path (ADR-0010 decisions 2–3); `ux.md` still holds journeys, screens, a state matrix per screen, the copy and the dated sign-off (ADR-0061 decision 3).
  4. **`spec.md` keeps the 100-readable-line cap.** It is what forces a feature to be cut to one outcome (ADR-0010 consequences).
- **Alternatives considered:**
  - *Raise the caps (say 200)* — rejected. The cap existed for a reader who no longer reads the TRD; any number is arbitrary and forces the same trimming one feature later.
  - *Drop the spec's cap too* — rejected. The owner reads the spec, and an over-long spec is the sign of a feature that is more than one outcome.
  - *Keep the caps and split the feature* — rejected when the length comes from enforcement detail or states rather than scope: subscriptions/feature-access is one outcome with many call sites, and splitting it would separate the lock from where it is enforced.
- **Consequences:**
  - ✅ A TRD keeps the reasoning a builder and a reviewer need; a UX keeps every state, instead of losing either to a count.
  - ✅ `/bb-sdlc` counts only the spec; `/bb-review` flags only a long spec.
  - ⚠️ Nothing now bounds a TRD or UX's growth. The check that remains is the spec's cap: a feature whose spec fits in 100 lines is one outcome, however long its TRD.
  - ⚠️ ADR-0010 decision 4 and ADR-0061 decision 3 are amended; each Status line points here.
