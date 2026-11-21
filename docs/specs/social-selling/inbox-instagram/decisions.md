# Decisions — social-selling/inbox-instagram

- **Verified:** 2026-11-21

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q2, Q7, Q34, Q36, Q63.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q2 | What is an Instagram conversation, and what appears in it? | A DM thread is one conversation; each top-level comment with its replies is another, grouped under its post with the post's thumbnail and caption start. Comments come from every post and reel of the account, however published, but only while the account is public (Meta sends no comment webhooks for a private account, and the tab says so). The shop's own replies made in the Instagram app arrive as echoes and show as "From the Instagram app" | Claude · reversible | 2026-11-06 | Matches inbox-core Q2; a shop answers comments one by one | decided |
| Q9 | What happens to the inbox when the account is disconnected or removes our app? | Conversations stay readable; replies say Reconnect; the 90-day retention clock starts at disconnect (parent Q34) and stops if the same account reconnects | Claude · reversible | 2026-11-06 | Parent Q34 | decided |

## Parked (Later)
- Story mentions and story replies as their own kind (parent Q36).
- Live comments (parent Q36).

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q1 → parent Q36 · Q3 → parent Q36 · Q4 → parent Q36 · Q5 → parent Q36 · Q6 → parent Q2 · Q7 → Q2 · Q8 → Q2 · Q10 → Q2
