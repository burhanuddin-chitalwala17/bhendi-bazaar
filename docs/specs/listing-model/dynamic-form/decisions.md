# Decisions — listing-model / dynamic-form

- **Verified:** 2026-11-08

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Binding here: parent [decisions](../decisions.md) Q3, Q4, Q10, Q17, Q22, Q27–Q29, Q34.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What is this subfeature's one outcome? | One form that asks everything any channel needs, honest about which matter now | Claude · reversible | 2026-11-07 | Parent Q14, step 4 | decided |
| Q2 | Where does per-channel completeness show? | On the product page and the form's channel strip, on the listing screen, and as counts on the products list's channel filter | Claude · reversible | 2026-11-07 | Where readiness shows today | decided |
| Q3 | Is a prototype built? | No; ux.md is signed off instead | Owner | 2026-11-07 | Parent Q34 | decided |
| Q4 | Bulk fill after connecting a channel? | Today's fix page, one attribute at a time across many products, extended to any attribute | Claude · reversible | 2026-11-07 | readiness-fix already does this for facts | decided |
| Q5 | How does the form ask parent Q26's new questions? | As facts with the same keys as their attribute rows, through the form's own path (fact fields, the parsed save, readiness, the field maps, the value sync), until the switch moves writes to values | Claude · reversible | 2026-11-08 | One write path for every answer; a second path for new questions only would give the same product two ways to save. retire-old-paths removes the code list with the rest | implemented (unit 1) |
| Q6 | How does the form know which channel needs which question? | Computed on the server for every type the form can switch to, from the shop's channels, the channel maps, the field maps and each channel's own requirements; a rule's field badges the question it reads (audience); a fixed default only "helps" | Claude · reversible | 2026-11-08 | The form switches type on the client; one read per page load (D1) | implemented (unit 1) |
| Q7 | A type whose kinds publish to different channel types (a tote, a backpack)? | The badges follow the kind the form is showing; a kind with no channel type of its own reads the type's | Claude · reversible | 2026-11-08 | Otherwise a field only a backpack needs reads "Required now" on a tote, as readiness picks by kind | implemented (unit 1) |
| Q8 | Which questions are "Required now"? | The store's own required measurements, badged "This store", and what a channel the shop sells on requires; every other question, measurements included, sits under "Also helps on…", collapsed, opened when it holds an error | Claude · reversible | 2026-11-08 | The ux state matrix ("Required now holds BB's questions"); a hidden refusal would read as a save that did nothing | implemented (unit 1) |

## Parked (Later)
- None.
