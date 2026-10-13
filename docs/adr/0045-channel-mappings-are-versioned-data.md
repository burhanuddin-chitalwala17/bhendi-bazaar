# ADR-0045: Channel mappings are versioned data, not code

- **Date:** 2026-09-29
- **Status:** Accepted (D3 superseded by [ADR-0053](0053-readiness-advises-and-never-gates.md); D2, D5 amended by [ADR-0054](0054-a-channel-mapping-carries-a-checked-date-and-source-and-required-ness-is-data.md))

## Context

Publishing one product to many platforms needs three translations, and only the first is easy.
Field names map nearly one to one, because every platform wants a title, a brand and a weight.
The other two do not. Amazon, Flipkart and Meesho each keep their own category tree, so "Abaya"
has a different home in each. Each keeps its own permitted values, so a colour written "Maroon"
is accepted by one, rejected by another and silently coerced by a third.

None of this is stable. A platform re-organises its browse nodes or adds a permitted value
without telling anyone, and the first sign is a rejected listing — or worse, an accepted one
under the wrong category, where nobody searching will find it.

The codebase already holds rules of this kind as data rather than code: `CHANNEL_IMAGE_RULES`
declares each channel's image requirements in a table, and `shotList` holds a per-category
template as validated JSON. Both were written for the same reason.

## Decision

1. **Three mapping layers, all held as data.** Category to category, attribute to attribute per
   platform category, and value to value. None of them is a `switch`.
2. **Every mapping carries a version and the date it was checked.** A mapping is a claim about
   somebody else's system on a particular day, and one with no date cannot be audited or
   expired.
3. **An unmapped value fails the readiness gate; it is never guessed.** Passing "Maroon" to a
   platform that has never heard of it, and hoping, is how a listing goes live in the wrong
   colour. The shop is told which value has no mapping and is asked to choose.
4. **A mapping is testable without the network.** Given a product and a channel, the payload is a
   pure function of the mappings, so the hard cases — a value that maps to nothing, a category
   whose required attributes changed — are unit tests rather than an account and a rejection.
5. **Mappings are editable by the platform owner, not only by deploy.** A platform adding a
   colour on a Tuesday should not need a release, and the shop's blocked listing should not wait
   for one.

## Alternatives considered

- **Map in code, one adapter function per channel.** The conventional answer, the fastest to
  write, and what most integrations look like at first. Rejected because the thing most likely
  to change is the thing hardest to change: a colour list in a TypeScript file means a
  deploy per platform whim, and there will be many. It also hides the size of the problem — a
  thousand value mappings as data is obviously a data set, and as code it is obviously a mess.
- **Derive mappings automatically by fuzzy-matching names.** Attractive for bootstrapping and
  genuinely useful as a *suggestion*. Rejected as the source of truth: fuzzy matching is
  confidently wrong on exactly the cases that matter — "Maroon" against "Marone" and "Maroon
  Red" — and a wrong category is not a visible failure, it is a listing nobody finds.
- **Fetch the platform's taxonomy live at publish time.** The most current answer. Rejected
  because it makes publishing depend on a third party being up, makes the payload untestable
  offline, and still leaves the value mapping unanswered — knowing Amazon's colour list does not
  tell us which of them "Maroon" is.
- **One mapping table shared across platforms.** Rejected: it assumes the platforms agree about
  what a colour is, which is the assumption this whole decision exists to refuse.

## Consequences

- ✅ A platform changing under us is a data edit with a date on it, not a release.
- ✅ The payload for any product and channel is a pure function, so the failure cases are unit
  tests and the adapters stay thin.
- ✅ An unmapped value surfaces as a named, fixable gap in readiness rather than as a rejection
  from somebody else's system in their words.
- ⚠️ Mappings are a data set that has to be populated and maintained, and the first load for a
  platform is real work that nothing automates. This is the ongoing tax of multi-channel selling
  and this decision makes it visible rather than smaller.
- ⚠️ Data that is editable at runtime is data that can be edited wrongly. A bad category mapping
  publishes correctly-formed listings into the wrong place, so the edit path needs the same care
  as a deploy would have had.
