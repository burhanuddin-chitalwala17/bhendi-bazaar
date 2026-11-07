# Decisions — listing-model / channel-catalogue

- **Verified:** 2026-11-07

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Binding here: parent [decisions](../decisions.md) Q1, Q2, Q3, Q11; [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md).

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What is this subfeature's one outcome? | Each channel's types and fields are stored, with required flags, allowed values and units, so a product's readiness for a channel says exactly which required fields are missing before anything is sent | Claude · reversible | 2026-11-07 | Parent Q14, step 1. Today readiness reads only our own map rows, all marked not required, so it never says an Amazon listing is incomplete | implemented (units 1, 2) |
| Q2 | Which channel types are loaded? | The ones any BB type maps to today: every Amazon type a BB type publishes to (read daily), Flipkart's 12 template nodes, Meesho's 19 exported categories, and the 11 Google categories Google and Meta map to | Owner | 2026-11-07 | What the shops sell now; a new type joins when a BB type is mapped to it. Google and Meta added by the owner (parent Q32). Counts corrected to the files when built (Claude, 2026-11-07). Was: the three marketplaces only; Amazon's 10 template types, Meesho's 21 | implemented (units 1, 2) |
| Q3 | How is "required" decided for Amazon, where it varies by type and by listing? | Per type, for one standalone seller-shipped listing from India: the rule Amazon's template encodes, which reproduced the 13 fields of the 2026-11-06 refusal exactly. Conditional fields that apply only to a parent or certain variation themes are stored as conditional | Claude · reversible | 2026-11-07 | Verified against a real refusal; the API returns the same schema | implemented (units 1, 2) |
| Q4 | What does a field record carry? | Channel, channel type, the channel's own name and label, required / conditional / optional, its value kind (choice, text, number, measure with unit, yes/no), allowed values, allowed units, and when and from where it was read | Claude · reversible | 2026-11-07 | Enough for readiness now and for field maps (subfeature 2) to convert values and units | implemented (units 1, 2) |
| Q5 | Fields a create always sends (identity, offer, compliance plumbing)? | Stored like any other field, marked as filled by the channel's adapter, so readiness never asks the shop for them | Claude · reversible | 2026-11-07 | One list per channel instead of a hidden `SENT_BY_CREATE` in code | implemented (units 1, 2) |
| Q6 | What does the shop see in this subfeature? | Readiness on the product and listing names each required field of the channel type that has no value and no map: "Amazon needs 13 more: Style, Inner material…". No new screen | Claude · reversible | 2026-11-07 | The outcome is visible where readiness already shows; the form changes in dynamic-form | implemented (units 1, 2) |
| Q7 | How often is Amazon re-read? | Daily, through the home brand, for every Amazon type a BB type maps to; a change is recorded with its date | Owner | 2026-11-07 | Parent Q11 | implemented (units 1, 2) |

## Parked (Later)
- None.
