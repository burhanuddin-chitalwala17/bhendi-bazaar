# Decisions — listing-model / field-maps

- **Verified:** 2026-11-08

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Binding here: parent [decisions](../decisions.md) Q5, Q7, Q20, Q23, Q24, Q32; [ADR-0070](../../../adr/0070-a-products-attributes-are-rows-mapped-to-each-channels-own-catalogue.md).

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What is this subfeature's one outcome? | Every channel field is filled from one known, checked source | Claude · reversible | 2026-11-07 | Parent Q14, step 2 | decided |
| Q2 | What sources can a map name? | A product attribute; a rule (a named function in code, e.g. department from audience); a core product field (name, SKU, weight, price, MRP, barcode, photos); the shop's settings (GST %, HSN); a fixed value; or "filled by the channel's adapter" | Claude · reversible | 2026-11-07 | Covers every field in the five channels' requirements read on 2026-11-06 | decided |
| Q3 | Who makes the default maps? | Claude, before release, from each channel's own documentation, each with source, date and reason | Owner | 2026-11-07 | Parent Q23 | decided |
| Q4 | What does the admin screen do? | Read and edit: every map of a channel type with its source and reason; change one; no confirm step | Owner | 2026-11-07 | Parent Q23; ux.md | decided |
| Q5 | How is a map's correctness proved? | One sample product per mapped type through Amazon's check-only create, and through Google's and Meta's feed validators, before release | Claude · reversible | 2026-11-07 | A refusal there means a wrong map, fixed before shipping | decided |
| Q6 | A shop's answer with no pair on the channel? | A gap on the listing ("Amazon has no match for 'Kiss-lock' closure"), raised as a request for the admin to pair | Claude · reversible | 2026-11-07 | Never dropped silently (today's `forwardAttributes` drops it) | implemented (unit 1) |
| Q7 | How is a map keyed, given Amazon's fields exist only after its first daily read? | By the channel's own names: channel, channel type, field path, and our type (blank = every one of our types that publishes there; a type's own row wins). No foreign key to the catalogue row | Claude · reversible | 2026-11-08 | Default maps ship by migration before Amazon is read in production, and a field the channel retires must not delete its map. Was: TRD D1's channelFieldId and kind | implemented (unit 1) |
| Q8 | One channel field filled in parts (Amazon `outer.material`, `item_dimensions.length`)? | A map's field is a path; its first segment is the catalogue field it covers, so `item_dimensions` is covered by its three part maps | Claude · reversible | 2026-11-08 | Amazon nests most attributes; one map per part keeps each part's source and unit explicit | implemented (unit 1) |
| Q9 | How is a built value shaped for Amazon? | From the type's own stored JSON Schema: each leaf gets the keys the schema's item declares (`value`, `unit`, `language_tag`, `marketplace_id`), numbers typed as it says; without a schema, today's text shape | Claude · reversible | 2026-11-08 | Amazon's shapes differ per attribute; reading the schema is exact where hand-written shapes drift | implemented (unit 1) |
| Q10 | An answer the map has no pair for? | Paired in order: the map's own pair; else the channel's allowed value of the same words (any case); else, for a free-text field, our label; else a gap "no match" | Claude · reversible | 2026-11-08 | Most of our words are Amazon's; an explicit pair is needed only where they differ (Q6) | implemented (unit 1) |
| Q11 | Are loaded maps cached per process (TRD D3's `mapsVersion`)? | Not yet: inputs are read once per batch, which answers the cost hazard; a cache waits for a measured need | Claude · reversible | 2026-11-08 | A cache keyed on a counter is one more thing to invalidate; batches already make it O(1) per call | implemented (unit 1) |

## Parked (Later)
- None.
