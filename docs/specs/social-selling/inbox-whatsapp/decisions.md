# Decisions — social-selling/inbox-whatsapp

- **Verified:** 2026-11-21

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q2, Q7, Q8, Q12, Q34, Q37, Q63.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Which WhatsApp events reach the inbox, and what does a thread show? | Inbound messages (`messages`), the shop's own sends from the Business app (`smb_message_echoes`) and statuses for messages sent from the inbox. The shop's messages show Sent, Delivered, Read or Failed; a template is stored rendered with its values, so the thread reads as the person saw it. Group chats never appear: the Cloud API does not deliver them | Claude · reversible | 2026-11-06 | What a two-way chat needs; contacts sync is whatsapp-contacts' | decided |
| Q9 | How is the person shown? | The name WhatsApp gives (profile name), with the number formatted when Meta gives it; otherwise the username, the person being keyed by Meta's business-scoped id (parent Q96). A number is contact data (ADR-0024) | Claude · reversible | 2026-11-21 | Meta may withhold the number. was: the profile name and the number, always | decided |

## Parked (Later)
None.

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q2 → parent Q12 · Q3 → parent Q37 · Q4 → parent Q8 · Q5 → parent Q8 · Q6 → Q1 · Q7 → parent Q12 · Q8 → Q1 · Q10 → Q1 · Q11 → parent Q8
