# Decisions — listing-model / retire-old-paths

- **Verified:** 2026-11-07

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Binding here: parent [decisions](../decisions.md) Q19, Q30, Q31, Q33.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What is this subfeature's one outcome? | One model left | Claude · reversible | 2026-11-07 | Parent Q14, step 5 | decided |
| Q2 | When does removal run? | In the same release as dynamic-form, after the full comparison is clean | Owner | 2026-11-07 | Parent Q30, Q31 | decided |
| Q3 | Who confirms the dropped data is disposable? | The comparison (every product, zero mismatches) and the owner's release approval, both named in the migration's header | Claude · reversible | 2026-11-07 | `migration-drops` test requires the confirmation in the header | decided |

## Parked (Later)
- None.
