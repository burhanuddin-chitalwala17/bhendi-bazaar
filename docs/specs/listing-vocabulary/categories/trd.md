# TRD — listing vocabulary / categories

- **Summary:** Categories and facts declared in code, permitted answers held as data, measurements stored and labels derived
- **Status:** 📝 Draft
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-02
- **References:** [spec.md](spec.md), [parent trd](../trd.md), [ADR-0047](../../../adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md), [ADR-0045](../../../adr/0045-channel-mappings-are-versioned-data.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

A category is a declaration: the kinds it holds, the facts it asks, the permitted answers for
those that have them, and the axis its members vary on. One declaration renders the form,
validates the write and answers readiness, so those three cannot disagree.

## Prior art

The parent's [Prior art](../trd.md) covers where variable facts live and that category-specific
field sets are the universal shape. One thing is specific to this part.

**Declaring the size scale.** Flipkart's `trouser` node resolves a size through Ideal For, then a
`Qualifier` naming the scale — Regular letters, Number, Euro, UK, US, Kids age bands — then the
allowed value. So a platform already treats "which scale" as its own field rather than assuming
one. **We follow the principle and simplify it**: storing the measurement makes the scale a
presentation choice rather than stored data. The templates support this directly — thirteen of
Meesho's nineteen nodes require a measurement, six require none, and **none requires a size label
without also requiring measurements**.

## Technical decisions

- **D1 — The nine categories and their kinds are declared in code.** A tenth is a declaration to
  add. A kind is a value on the product rather than a category of its own, because the platforms
  disagree about which it is: Flipkart holds abaya, burqa and niqab as one node separated by a
  field, Meesho as four categories. Storing the distinction as a fact lets each adapter decide.
- **D2 — The declaration is one object per category, and it is what renders the form.** It names
  each fact, its type, its permitted values and the words shown to a shop. This is the shape
  `server/catalog/shot-list.ts` already proves for gallery slots, so following it means one
  pattern in the codebase rather than two.
- **D3 — Facts are declared in code; permitted answers are held as data.** Which facts exist
  changes with a release. Which colours exist grows the first time a shop sells one, and waiting
  for a deploy to add one is the friction this phase exists to remove.
- **D4 — An answer from a list is stored by its key, never its label.** Renaming a colour must
  not rewrite products, and two shops must not disagree about what maroon is.
- **D5 — A value list is global with per-category availability, not a list per category.**
  Flipkart's own colour list differs per node, so a list per category would copy thirty-five
  colours eleven times and let them drift. One list, and each category says which of it applies.
- **D6 — Measurements are stored; labels are derived.** Length, bust and waist for a garment,
  length and width for a mat, capacity for an attar, diameter for a ring. The unit is fixed per
  category rather than chosen per product, because a free unit is how centimetres and inches end
  up in one column.
- **D7 — Derivation is a pure function with no stored result.** A label computed and also stored
  is two facts that can disagree, and the stored one always wins by accident.
- **D8 — An answer matching no list is kept as free text, flagged.** A shop's data is not ours to
  discard for not fitting a list written afterwards, and the flagged leftovers are the queue of
  answers the lists are missing.

## Packages

None.

## UI approach

The form leads with category, then kind, because those decide every question after them. The facts
follow in three visual groups — what everything needs, what most categories need, what this
category adds — so the form reads as short even where it is not. Measurements are a numeric group
with the unit shown as fixed text. Mobile-first per
[ADR-0015](../../../adr/0015-mobile-first-design.md): one column, the category picker a full-width
control, no horizontal scroll at 360px.

## Data model

[MIGRATION]. New tables for the permitted answers and their per-category availability. `Product`
gains `category`, `kind`, the common-fact columns, the measurement columns, and one indexed JSON
column for the category tail.

## API / contract changes

[CONTRACT]. Product DTOs gain category, kind, measurements and the category tail.

## Test plan

Each category's declaration is checked to name only facts that exist and only permitted values
that resolve — the check that stops a declaration drifting from the form it renders. Label
derivation is a table: each scale, a measurement with no label, a label with no measurement.
D7 is a guard test: no derived label is persisted anywhere. The free-text fallback is tested over
a fixture of the real messy colour values, asserting nothing is lost and every leftover is
flagged.

## Delivery (PRs)

1. The declarations, the permitted answers and their availability — pure, no schema change.
2. Label derivation from measurements — pure.
3. The schema: category, kind, common facts, measurements, the JSON tail.
4. The form's category-led layout.

## Open questions

- **How rich the colour list should be — the data now answers the hard half.** Measured on
  2026-10-02 from the templates: for an abaya, sixteen of Flipkart's seventeen colours appear on
  Meesho **spelled identically**, and across all nodes thirty-one values are common and identical.
  The platforms do not disagree about what to call a colour. They disagree about how many exist:
  Flipkart publishes 35 distinct values, Meesho 185.

  So the choice is granularity, not vocabulary. Flipkart's 35 alone means a shop cannot record
  "Navy Blue" at all, which is a colour it sells. Meesho's 185 alone means 154 values have no
  Flipkart equivalent. **The recommendation is the union, with a per-platform mapping decided once
  per value and shown to the shop** — "our Navy Blue goes to Flipkart as Dark Blue" is then a
  deliberate statement the shop made, not a guess the system made, which is what keeps every
  published value exact ([ADR-0045](../../../adr/0045-channel-mappings-are-versioned-data.md)).
  It stays an open question because it commits the shop to a one-off mapping session, and that is
  the owner's time.
- **Meesho's `Brand` is a per-category registry, not free text.** It is optional, so it does not
  block listing, but a shop's own brand must be enrolled with Meesho before it can be named. Not a
  decision for this subfeature; recorded here because the brand facts in
  [inherited-facts](../inherited-facts/) assume a brand is something the shop simply states.
