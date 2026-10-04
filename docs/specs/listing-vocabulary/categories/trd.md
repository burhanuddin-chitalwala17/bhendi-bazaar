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

- **D1 — The nine product types and their kinds are declared in code.** A tenth is a declaration
  to add. A kind is a value on the product rather than a type of its own, because the platforms
  disagree about which it is: Flipkart holds abaya, burqa and niqab as one node separated by a
  field, Meesho as four categories. Storing the distinction as a fact lets each adapter decide.
- **D1a — A product type attaches to a browsing category and is inherited down the tree**, exactly
  as `shotList` already is (`server/catalog/shot-list.ts`, `resolveShotList`). `Category` gains a
  nullable product type; a category that sets none takes its nearest ancestor's. Following the
  proven shape means one pattern rather than two, and the tree walk already handles the cycle a
  self-referencing tree makes possible.
- **D1b — The resolved type is stored on the product on save, not read through the category.**
  Merchandising moves categories; a product's questions and stored answers must not move with
  them (spec A1a). It also keeps the parent's D4 true — a product read is one row. Re-pointing a
  category then becomes an explicit migration of its products, which is spec R7 and reuses
  [inherited-facts](../inherited-facts/) D5.
- **D1c — `productType` is the field's name, because it is the field's name.** Amazon calls this
  exact concept `product_type` and it decides which attributes apply; Flipkart calls it a vertical
  and Meesho a category. Naming ours after the dominant published vocabulary costs nothing and
  makes every adapter's mapping read as a mapping ([ADR-0046](../../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md)).
- **D2 — The declaration is one object per type, and it is what renders the form.** It names each
  fact, how it is answered, its permitted values and the words shown to a shop — the shape
  `server/catalog/shot-list.ts` already proves for gallery slots.
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
- **D6a — Only the discriminators earn columns; every answer lives in JSON with its origin.**
  Checked against the code rather than assumed: nothing filters, sorts or searches on `sizes` or
  `colors` today — they are selected and written and never appear in a `where`. So the parent's
  D2 admits far fewer columns than it reads as. `productType` is a column because it says how to
  interpret the rest of the row, and `kind` because the channel mapping resolves a platform node
  from the pair. Colour, material and pattern are answers like any other. A column added for a
  filter nobody has written is a second place for a value to live, and
  [categories D7](#technical-decisions) is the same argument applied to labels.
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

[MIGRATION]. `Category` gains a nullable `productType`. `Product` gains `productType` and `kind`
as columns, and `facts` and `measurements` as indexed JSON, each entry holding its value and the
level that supplied it. `ListingValue` holds the permitted answers — list, key, label, order —
with the product types it applies to, empty meaning every type that asks for that list, and a
nullable `orgId` so a shop's own addition is visible to that shop without a later migration.

## API / contract changes

[CONTRACT]. Product DTOs gain category, kind, measurements and the category tail.

## Test plan

Each product type's declaration is checked to name only facts that exist and only permitted
values that resolve — the check that stops a declaration drifting from the form it renders.
Resolution up the category tree is tested for the inherited case, the unset-everywhere case and a
cycle, mirroring `resolveShotList`'s own table. Label
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

None.

**Closed 2026-10-03 — how rich the colour list should be.** The union, which is what shipped: 188
values with the 31 both platforms spell identically sorted first. Flipkart publishes 35 and
Meesho 185, and they disagree about how *many* colours exist rather than what to call one, so the
narrow list would leave a colour the shop genuinely sells unrecordable while the wide one costs
only a mapping.

The concern that held this open was that the wide list commits somebody to mapping 154 values
onto Flipkart's vocabulary. That was overstated twice over: only the colours a shop actually uses
ever need mapping, which is tens rather than hundreds, and
[ADR-0045](../../../adr/0045-channel-mappings-are-versioned-data.md) decision 3 already has them
decided **lazily** — an unmapped value fails readiness and the shop is asked to choose at the
moment it first blocks a publish, never upfront.

**Meesho's `Brand` is a per-category registry, not free text.** It is optional, so it does not
block listing, but a shop's own brand must be enrolled with Meesho before it can be named. Not a
decision for this subfeature; recorded here because the brand facts in
[inherited-facts](../inherited-facts/) assume a brand is something the shop simply states.
