# ADR-0046: A new model is checked against the field before the codebase

- **Date:** 2026-09-29
- **Status:** Accepted

## Context

Drafting [listing-vocabulary](../specs/listing-vocabulary/) produced a design for storing a
product's variable facts as one row per attribute. The reasoning was internally sound and
consistent with this codebase, which already holds shapes like `shotList` and `social` as
validated data.

It was also a well-known anti-pattern. Entity-attribute-value storage is what Magento built its
product model on and what the PostgreSQL community advises against by name; measured comparisons
put a JSON column at a fraction of the storage and a large multiple of the read speed. The
established answer — frequently queried facts as columns, the rare tail in one JSON column with
an index — is *also* what this codebase already does eighteen times over. Consistency with the
house pattern would have produced the wrong answer, because the house pattern had been read at
the wrong level of abstraction.

Nothing caught it. It was caught because the owner asked whether it was standard. Every gate here
checks the code against our own rules; none of them checks our rules against anyone else's
experience.

## Decision

1. **A TRD that introduces a new persistence shape, data model or integration pattern states the
   established approach and says whether it follows it.** Named, with a source. Not "we
   considered alternatives" — what the field does, and whether we are doing that.
2. **Departing is allowed and must be argued.** A reason specific to this project beats a
   general one, and "our existing code does it this way" is not a reason on its own.
3. **An existing pattern in this repository is evidence, not authority.** Consistency is a reason
   to match and never a reason not to check. This is the exact failure above: the pattern was
   consistent and wrong.
4. **A wrong pattern found already in the code is written down, not quietly avoided.** Either it
   is fixed in that change, or it is recorded as drift with the reason it was left. Working
   around a known-bad pattern while leaving it unremarked is how the next person copies it.
5. **The scope is a new model, not every line.** A new table, a new stored shape, a new external
   protocol, a new concurrency or caching strategy. Ordinary code follows the house style without
   ceremony.
6. **`/bb-brainstorm`'s "verify, don't recall" extends to design.** It already requires checking
   an external service's current documentation rather than remembering it. The same obligation
   now covers the shape of a solution.

## Alternatives considered

- **Rely on review to catch it.** What we had, and it caught nothing — the reviewer and the
  author were the same party, working from the same codebase, and the codebase agreed with the
  mistake. [ADR-0033](0033-a-domain-is-reached-through-its-public-surface.md) already records the
  general form of this: a rule someone must remember is not a control.
- **A gate test, like the other conventions here.** The preferred shape in this project and not
  available: no test can know that a schema resembles an anti-pattern, and one that tried would
  encode a fixed list of bad ideas and go stale. This is a judgement, so the control is a
  required section rather than an assertion.
- **Require prior art for every change.** Rejected as ceremony that would be dropped within a
  month. Confined to new models, where the cost of being wrong is a migration rather than an
  edit.
- **Trust that following the established pattern is always right.** Rejected because it is how
  this failure happened in the other direction: the wrong answer was arrived at by consistency.
  The field's consensus is evidence too, not authority, and a project with a genuine reason to
  depart should depart and say so.

## Consequences

- ✅ The question gets asked at the moment a model is chosen, which is the only moment it is
  cheap to answer.
- ✅ A departure becomes a stated decision with a reason, so a later reader can tell a considered
  choice from an unexamined one.
- ✅ Bad patterns already in the code stop being invisible, because finding one now obliges
  recording it.
- ⚠️ Research time on every new model, some of which will confirm what we would have done anyway.
  That is the cost of the one time in five that it does not.
- ⚠️ A required prose section is a weaker control than a test, and will be skipped by whoever is
  in a hurry. Nothing here prevents that; the section's presence in the template is the whole of
  the enforcement.
