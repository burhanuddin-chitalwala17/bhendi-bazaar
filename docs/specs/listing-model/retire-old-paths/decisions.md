# Decisions — listing-model / retire-old-paths

- **Verified:** 2026-11-07

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Binding here: parent [decisions](../decisions.md) Q19, Q30, Q31, Q33.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What is this subfeature's one outcome? | One model left | Claude · reversible | 2026-11-07 | Parent Q14, step 5 | decided |
| Q2 | When does removal run? | In the same release as dynamic-form, after the full comparison is clean | Owner | 2026-11-07 | Parent Q30, Q31 | decided |
| Q4 | What is removed in this release, given what still reads the old parts? | **Now:** `Product.facts`/`measurements` (archived whole in `ProductAnswersArchive`, dropped behind an in-migration gate), the compare script, ADR-0051 superseded, ADR-0070 accepted, the programme's HANDOFF. **Not yet, each still live:** `ChannelCategoryMap` (publish, feeds and readiness route types through it; the TRD's `TypeMap` was never built), `ChannelAttributeMap`/`ChannelAttributeFill`/`ChannelValueMap` (readiness and channel setup beside the field maps), `ListingValue` (the form's answer lists), `FACT_DECLARATIONS`/`fill-facts` (the form and the save), `Product.weight` (shipping and checkout price delivery from it). Each moves to the new tables in its own unit after the owner's publish test | Claude · reversible | 2026-11-08 | The TRD's D3 list assumed those were replaced; on reading the code they are not, and dropping them would break publish, checkout or the form. The owner wants to test publish next: moving publish's routing first would put new risk under that test. The data rule (nothing lost) holds: the dropped columns are archived | implemented (columns); rest parked |
| Q3 | Who confirms the dropped data is disposable? | The comparison (every product, zero mismatches) and the owner's release approval, both named in the migration's header | Claude · reversible | 2026-11-07 | `migration-drops` test requires the confirmation in the header | decided |

## Parked (Later)
- Q4's "not yet" list: move publish/feeds/readiness from `ChannelCategoryMap` and the attribute, fill and value maps to `ChannelType`/`FieldMap`/`FieldValueMap`; `ListingValue` to `AttributeOption`; facts declared as `Attribute` rows; then drop each table behind its own backup.
