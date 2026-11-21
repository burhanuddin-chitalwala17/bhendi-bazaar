# Decisions — social-selling/whatsapp-contacts

- **Verified:** 2026-11-21

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md); "audience Qn" means
> [../audience/decisions.md](../audience/decisions.md). Binding here from the parent: Q7, Q9, Q12,
> Q37.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What arrives from the shop's Business app, and how is it kept? | The Business app's contacts (name and phone): first Meta's initial sync after a coexistence connect, then each add, edit or removal from the `smb_app_state_sync` webhook, all arriving as Not yet (parent Q9). A synced phone-book name fills only an empty name, never overwriting one the shop typed or uploaded. A contact removed on the phone leaves only if it has no consent history and no conversation; otherwise it stays, marked "removed from your phone". The Audience page shows "Contacts from your phone: waiting" for 24 hours after connecting, then "Not shared": contacts only arrive at connect, so a shop wanting them later reconnects | Claude · reversible | 2026-11-06 | The webhook Meta documents for coexistence (INTEGRATIONS.md); parent Q9 | decided |
| Q5 | How do opt-in and STOP work in a chat? | Audience owns the words (audience Q10, Q13); this subfeature only turns each inbound WhatsApp message into a neutral "message received" event. Only the buyer's own message counts, never an echo of the shop's. A YES from a number never seen makes a contact opted in, source Chat, with the message as evidence. Each change gets one free reply inside the 24-hour window, in Hindi when preferred: on YES "You're in. <shop> will send you offers here. Reply STOP any time. Reply HINDI for Hindi.", on STOP "Done. <shop> won't send you offers. Reply YES to start again." If that reply fails, the consent change stands and the failure is logged, never retried past the window | Claude · reversible | 2026-11-06 | Meta's 24-hour window makes the reply free; the HINDI offer is parent Q37's "every first message" | decided |

## Parked (Later)
- parent Q12 — chat history (parent Q12).

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q2 → Q1 · Q3 → Q1 · Q4 → Q5 · Q6 → Q5 · Q7 → Q5 · Q8 → Q5 · Q9 → parent Q7 · Q10 → parent Q12 · Q11 → Q1
