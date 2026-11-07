# Decisions — listing-model / attributes

- **Verified:** 2026-11-07

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Binding here: parent [decisions](../decisions.md) Q5, Q6, Q8–Q10, Q16, Q19, Q20, Q25, Q26, Q29, Q33.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What is this subfeature's one outcome? | One dictionary of attributes, answered once per product, with brand and shop filling theirs | Claude · reversible | 2026-11-07 | Parent Q14, step 3 | decided |
| Q2 | Does this subfeature have screens? | No; the form and brand page change in dynamic-form | Claude · reversible | 2026-11-07 | One outcome per subfeature (ADR-0061) | decided |
| Q3 | What becomes of today's 28 facts and 10 measurements? | Each becomes an attribute with the same key, so every map and answer carries across | Claude · reversible | 2026-11-07 | Same keys keep the move verifiable by count | decided |
| Q4 | Today's "strap" (detachable or not) and Amazon's strap type? | Two attributes: "Strap: detachable" keeps today's answers; "Strap type" (Adjustable, Cross-body, Shoulder…) is new and starts empty | Owner | 2026-11-07 | Parent Q25 | decided |
| Q5 | Is a brand's product link an attribute? | Yes, a reference attribute; empty means the shop's default brand | Claude · reversible | 2026-11-07 | Parent Q10; one way to read every value | decided |
| Q6 | Which attribute values does the shop's settings fill? | Country of origin (fallback after brand), GST % and HSN per category | Claude · reversible | 2026-11-07 | What OrgListingDefaults holds today; GST % finally used | decided |

## Parked (Later)
- None.
