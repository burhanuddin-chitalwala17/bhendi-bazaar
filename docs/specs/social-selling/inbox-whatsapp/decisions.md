# Decisions — social-selling/inbox-whatsapp

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn"
> means [../decisions.md](../decisions.md). Binding here from the parent: Q7, Q8, Q10, Q12, Q30, Q34, Q63, Q76, Q80, Q81.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Which WhatsApp events reach the inbox? | Inbound messages (`messages`), the shop's own sends from the Business app (`smb_message_echoes`, coexistence), and delivery and read statuses for messages sent from the inbox | Claude · reversible | 2026-11-06 | What a two-way chat needs; contacts sync is whatsapp-contacts' | decided |
| Q2 | Is past chat history brought in? | No: the inbox starts on the day of connecting (parent Q10) | Owner | 2026-11-06 | Parent Q10 | decided |
| Q3 | Which reply window does a chat report? | Open within 24 hours of the person's last message (free-form, free of charge); after that only a template, offered with its cost (parent Q76). WhatsApp has no human-agent extension | Claude · reversible | 2026-11-06 | Meta's rule, checked 2026-11-06 | decided |
| Q4 | Who pays for a template sent from the inbox? | The shop, from its own WhatsApp account (parent Q8). The picker shows the cost from whatsapp-templates' rates before Send; the send is recorded with its cost in paise and who sent it | Owner | 2026-11-06 | Parent Q8, Q30 | decided |
| Q5 | Does a template sent from the inbox count against the spend cap? | Yes: every paid WhatsApp send counts (parent Q32). A reply past the cap is refused with the reason and a way to raise the cap. Each send is recorded as an inbox reply, so the shop can see what spent where | Owner | 2026-11-06 | The shop audits one number it chose. was: no, shown and recorded only | decided |
| Q6 | Are delivery and read ticks shown? | Yes, on the shop's own messages sent from the inbox: Sent, Delivered, Read, Failed | Claude · reversible | 2026-11-06 | Meta sends them free; a shop asks "did they see it?" | decided |
| Q7 | Does a message sent from the inbox also appear in the shop's WhatsApp Business app? | Yes, Meta mirrors it under coexistence (parent Q12); nothing to build | Claude · reversible | 2026-11-06 | Meta's coexistence behaviour | decided |
| Q8 | Are WhatsApp chats from groups shown? | No; the Cloud API does not deliver the app's group chats, and the tab says nothing about groups | Claude · reversible | 2026-11-06 | Not available; parent Q20 | decided |
| Q9 | What does the inbox show for a person's number? | The name WhatsApp gives (profile name) and the number, formatted; the number is contact data (ADR-0024) | Claude · reversible | 2026-11-06 | inbox-core Q15 | decided |
| Q10 | Is a template's message text stored in the inbox? | Yes, rendered with its filled values, so the thread reads as the person saw it | Claude · reversible | 2026-11-06 | The thread must be complete | decided |
| Q11 | What if the shop has no payment method on its WhatsApp account? | A template send is refused by Meta; the bubble says "Not sent · Add a payment method in WhatsApp Manager" with a link. Free replies in the 24-hour window still work | Claude · reversible | 2026-11-06 | Meta requires it for paid messages; connect-whatsapp's daily check already reads it | decided |

## Parked (Later)
None.
