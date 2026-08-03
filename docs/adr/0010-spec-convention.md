# ADR-0010: Spec layout — feature folders, spec/TRD split, ≤100 readable lines

- **Date:** 2026-08-03
- **Status:** Accepted
- **Context:** There was no spec convention and no specs — work went from idea straight to code, which shows up in a commit history of broad, undescribed changes where it is not recoverable what a given change was *meant* to touch. Stating intent before implementing is the cheapest way to catch a change that has quietly grown beyond its purpose.

  Separately, the documentation that did exist had no length discipline, with single files reaching well over a thousand lines. Past a certain size a document stops being reviewed and is only skimmed, so errors in it survive indefinitely — which makes a length cap a correctness mechanism, not a style preference.

  A sibling project (`ums-soul`) had already iterated through numbered flat spec files and rejected them in favour of feature folders with a product/technical split and a hard line cap. This adopts that conclusion rather than rediscovering it.
- **Decision:**
  1. **Feature folders, no numbering.** Each feature is a `kebab-case` folder under `docs/specs/`, named for the feature. One feature per folder. Numbering a feature's requirements carries no information and creates false ordering.
  2. **`spec.md` = requirements and product approach only.** What the feature must do and why, in product terms. No technical approach, package choices, data-model or algorithm decisions.
  3. **`trd.md` = technical approach and decisions, and no code.** At most references to *existing* code (`path` + symbol) to justify a decision — never the code we intend to write. Per [ADR-0009](0009-docs-reference-code-never-copy-it.md).
  4. **≤100 readable lines each.** *Readable content* = body prose (sentences, bullets). **Excluded:** front-matter, headings, table rows and separators, fenced blocks, link-only lines, blanks. Over the cap → **split into subfeatures**: nested subfolders each with their own `spec.md`, plus a short overview `spec.md` in the parent.
  5. **Supporting artifacts live in the feature folder**, named for their purpose (`rate-comparison.md`, `migration-plan.md`). Never named `spec` or `trd`; not line-capped.
  6. **Lightweight header on each:** `Status · Domain · Verified · References`. `Domain` names the owning bounded context from `CLAUDE.md`, or `cross-domain`.
  7. **Cross-reference by relative path and feature name.** Numbering is never used for reference.
- **Alternatives considered:**
  - *Numbered flat spec files (`SPEC-01-checkout.md`)* — rejected, having already been tried and abandoned in the sibling project. Numbers imply a sequence that does not exist, collide when work is parallel, and give supporting artifacts no home.
  - *One combined spec+TRD per feature* — rejected. The product/technical split lets requirements be validated without wading through technical choices, and keeps each document short enough to actually review. A combined file grows unbounded, which is how a 1,660-line doc happens.
  - *Cap only the spec, leave the TRD unbounded* — rejected. The review-quality argument applies equally; an unreviewed TRD is where a bad technical decision hides.
  - *GitHub Issues instead of spec files* — rejected as the primary home. Issues are good for tracking and discussion but poor as durable reasoning: they are not diffable alongside the code, not versioned with the branch, and not readable by an agent session. Issues track *status*; specs hold *content*.
  - *No cap, rely on judgement* — rejected. Judgement produced 1,660 lines. A cap is what forces decomposition, and decomposition is the actual goal.
- **Consequences:**
  - ✅ Folders are self-describing and supporting artifacts are co-located.
  - ✅ Short single-concern documents get genuinely reviewed.
  - ✅ The cap forces feature decomposition, which is the real benefit — a feature that cannot be described in 100 lines is usually more than one feature.
  - ✅ Scope collisions like `6b34cbf` become visible, because the spec states what the change is meant to touch.
  - ⚠️ Counting "readable lines" is fiddly by hand. `/bb-sdlc` computes it; without that, judge by eye and accept approximate compliance rather than litigating the count.
  - ⚠️ A genuinely large feature becomes several folders plus an overview, which is more navigation. That is the intended trade.
