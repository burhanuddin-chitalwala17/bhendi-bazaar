# Decisions — notification-hub/notifications-core

- **Verified:** 2026-11-25

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Ids here are this subfeature's own; "hub Qn" means [../decisions.md](../decisions.md),
> "social-selling Qn" means [../../social-selling/decisions.md](../../social-selling/decisions.md).
> Binding: hub Q1, Q3; social-selling Q9, Q18, Q27, Q40, Q66.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q2 | Which shop events reach members, and how? | Conversation waiting, post failed, connection needs you and post due for Status (social-selling Q18, Q66), each to every member of the shop. The unread badge shows at once; one daily email at 9am IST lists what is still waiting (conversations unanswered over 4 hours, failed posts, connections needing attention, Status posts due), and nothing waiting means no email. Each member may turn the daily email off on the shop's notification settings; the badge always shows | Claude · reversible | 2026-11-06 | social-selling Q66; a digest beats an email per message | decided |
| Q7 | How long are delivery rows kept, and who sees them? | 13 months, then deleted by a monthly pass. Message bodies are never stored: only the kind, a recipient reference, the channel, the outcome and the facts' ids. No admin screen in this subfeature; the rows are shaped so one can query them later, and failures are logged without bodies | Claude · reversible | 2026-11-06 | Enough for a year's cap and dispute look-back; DPDP holds only what is needed | decided |
| Q9 | Does the event row keep its audience? | Yes: `NotificationEvent` also stores `audience` (TRD D1 lists eventKey, kind, orgId, facts, createdAt), so a delivery job and the later digest know how its recipient was resolved without re-deriving it from the kind | Claude · reversible | 2026-11-25 | Found while building unit 1; parcel notices (unit 2) carry buyer and shop audiences under kinds that do not fix one | implemented (unit 1) |
| Q10 | How does the hub learn whether a badge item is still open? | Each emitting unit calls `notificationsService.registerStillOpen(kind, check)` from one registration module that the bell route (unit 3) imports, so no check depends on which modules a request happened to load. A kind with no check, or whose check throws, keeps its items: never hide work unasked | Claude · reversible | 2026-11-25 | TRD D3 says each kind declares `stillOpen`; found in unit 1's review that a side-effect registration is lost if nothing imports it | decided |

## Parked (Later)
- Q7 — admin delivery screen.

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q1 → Q2 · Q3 → Q2 · Q4 → Q6 · Q8 → Q7 · Q5 → hub-marketing Q1 · Q6 → hub-marketing Q2 (moved 2026-11-22)
