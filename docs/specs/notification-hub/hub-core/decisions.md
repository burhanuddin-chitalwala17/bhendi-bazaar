# Decisions — notification-hub/hub-core

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Ids here are this subfeature's own; "hub Qn" means [../decisions.md](../decisions.md), "social-selling Qn"
> means [../../social-selling/decisions.md](../../social-selling/decisions.md). Binding: hub Q1–Q4;
> social-selling Q27, Q41, Q62, Q66–Q70, Q73, Q74.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Which shop events does hub-core deliver at launch? | Conversation waiting, post failed, connection needs you, post due for Status (social-selling Q41, Q67), each to every member of the shop | Claude · reversible | 2026-11-06 | Social selling is the first user | decided |
| Q2 | How do shop events reach members? | The unread badge at once; one daily email at 9am IST listing what is still waiting (conversations unanswered over 4 hours, failed posts, connections needing them, Status posts due). Nothing waiting, no email | Claude · reversible | 2026-11-06 | social-selling Q41; a digest beats an email per message | decided |
| Q3 | Can a member turn the daily email off? | Yes, per member, on the shop's notification settings; the badge always shows | Claude · reversible | 2026-11-06 | An email a person did not want is spam to them | decided |
| Q4 | Where are the global cap and channel order set? | On one shop settings page, Notifications, under Shop in the menu: the global marketing cap (default 3 a day) and, read-only, the channels the shop has connected | Claude · reversible | 2026-11-06 | social-selling Q70; one place for the shop | decided |
| Q5 | What does a marketing email's unsubscribe do? | One tap, no sign-in: withdraws that buyer's email consent for that sender only, recorded, and shows "You won't get offers from <shop> by email." WhatsApp consent is untouched | Claude · reversible | 2026-11-06 | social-selling Q27, Q62: per sender, per channel | decided |
| Q6 | What counts against the global cap? | Every marketing delivery to a buyer from that shop across all channels, in the IST calendar day; a skipped send counts nothing and is recorded as skipped with its reason | Claude · reversible | 2026-11-06 | social-selling Q74; a day must mean the shop's day | decided |
| Q7 | How long are delivery rows kept? | 13 months, then deleted by a monthly pass; message bodies are not stored, only kind, recipient reference, channel, outcome and the facts' ids | Claude · reversible | 2026-11-06 | Enough for a year's cap and dispute look-back; DPDP holds only what is needed | decided |
| Q8 | Where do platform staff see delivery health? | Not in this subfeature: delivery rows are queryable later by an admin screen; failures are logged without bodies | Claude · reversible | 2026-11-06 | No acceptance needs a screen | parked |

## Parked (Later)
- Q8 — admin delivery screen.
