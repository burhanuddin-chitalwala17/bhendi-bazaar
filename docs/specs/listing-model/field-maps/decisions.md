# Decisions — listing-model / field-maps

- **Verified:** 2026-11-07

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Binding here: parent [decisions](../decisions.md) Q5, Q7, Q20, Q23, Q24, Q32; [ADR-0070](../../../adr/0070-a-products-attributes-are-rows-mapped-to-each-channels-own-catalogue.md).

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What is this subfeature's one outcome? | Every channel field is filled from one known, checked source | Claude · reversible | 2026-11-07 | Parent Q14, step 2 | decided |
| Q2 | What sources can a map name? | A product attribute; a rule (a named function in code, e.g. department from audience); a core product field (name, SKU, weight, price, MRP, barcode, photos); the shop's settings (GST %, HSN); a fixed value; or "filled by the channel's adapter" | Claude · reversible | 2026-11-07 | Covers every field in the five channels' requirements read on 2026-11-06 | decided |
| Q3 | Who makes the default maps? | Claude, before release, from each channel's own documentation, each with source, date and reason | Owner | 2026-11-07 | Parent Q23 | decided |
| Q4 | What does the admin screen do? | Read and edit: every map of a channel type with its source and reason; change one; no confirm step | Owner | 2026-11-07 | Parent Q23; ux.md | decided |
| Q5 | How is a map's correctness proved? | One sample product per mapped type through Amazon's check-only create, and through Google's and Meta's feed validators, before release | Claude · reversible | 2026-11-07 | A refusal there means a wrong map, fixed before shipping | decided |
| Q6 | A shop's answer with no pair on the channel? | A gap on the listing ("Amazon has no match for 'Kiss-lock' closure"), raised as a request for the admin to pair | Claude · reversible | 2026-11-07 | Never dropped silently (today's `forwardAttributes` drops it) | decided |

## Parked (Later)
- None.
