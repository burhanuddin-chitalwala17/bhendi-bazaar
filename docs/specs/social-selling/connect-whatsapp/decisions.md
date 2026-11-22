# Decisions — social-selling/connect-whatsapp

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q1, Q2, Q4, Q7, Q8, Q9, Q12, Q14,
> Q34.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q5 | What happens after the pop-up returns, and where does connecting stop? | Exchange the code for the business token, register the number for Cloud API, subscribe our app to the WhatsApp account's webhooks (`smb_app_state_sync`, `smb_message_echoes`, `history`, `account_update` among them), and read the number's display name, verified-name status, quality and whether a payment method is set. Connecting stops at a healthy number subscribed to our webhooks; catalogue, contacts, inbox and templates are their own subfeatures, started by the connected event | Claude · reversible | 2026-11-06 | Meta's documented post-signup steps; research 2026-11-06 | decided |
| Q8 | How is a number's health kept and shown? | The business token does not expire on a clock, so nothing is renewed; the daily pass checks the token and the number's health, and a lost token or a removed app sets Needs reconnecting. The card shows the masked number (+91 98•••• 4321), display name, quality, whether payments are set up, who connected it and when, and when last checked. No payment method never blocks connecting (ADR-0053): the card says "Add a payment method in Meta to send messages. Replies within 24 hours are free." with a link. Quality Low shows the chip in amber or red, "WhatsApp rates your number Low. Sending marketing may be limited.", and the dashboard line once | Claude · reversible | 2026-11-06 | What the shop needs to trust it and to know whether it can send | decided |
| Q10 | Can a number serve two shops, or be swapped on reconnect? | One number per shop, and one shop per number: a number connected to another shop is refused, and a reconnect with a different number is refused too; to switch, the shop disconnects and connects the new number | Claude · reversible | 2026-11-06 | One inbox and catalogue per shop; mirrors connect-instagram Q4 | decided |
| Q13 | What happens on disconnect? | Confirmed in a dialog. We unsubscribe our app from the WhatsApp account and delete the token; the number stays in the shop's Business app and keeps working there; the record is kept as disconnected | Claude · reversible | 2026-11-06 | Coexistence means the number is the shop's, not ours | decided |
| Q17 | What does connecting start that other subfeatures finish? | Two things. The one contact sync Meta allows (within 24 hours of connecting) is started here, and its contacts are kept by consent-core. The spend-cap step that ends connecting (parent Q8) belongs to whatsapp-sending and joins this flow when that is built. Both are in place before any outside shop connects, since none can before the review (parent Q2); our own test number simply reconnects | Claude · reversible | 2026-11-22 | Connect stays free of what it does not own (parent Q7, Q108), and nothing is lost for a real shop | decided |

## Parked (Later)
None beyond the parent's (Q10 chat history).

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q1 → Q5 · Q2 → parent Q12 · Q3 → parent Q12 · Q4 → parent Q12 · Q6 → parent Q12 · Q7 → Q8 · Q9 → Q8 · Q11 → Q10 · Q12 → parent Q2 · Q14 → Q8 · Q15 → parent Q2 · Q16 → parent Q12
