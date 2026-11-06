# Decisions — social-selling/connect-whatsapp

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn"
> means [../decisions.md](../decisions.md). Binding here from the parent: Q1, Q2, Q4, Q7, Q8, Q10, Q12, Q13, Q14, Q15, Q29, Q30, Q34, Q38, Q46, Q79–Q81.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Does connecting also build the catalogue, sync contacts, bring chats or submit templates? | No. It ends at a healthy number subscribed to our webhooks. Catalogue, contacts, inbox and templates are their own subfeatures and start from the connected event | Claude · reversible | 2026-11-06 | One outcome per feature (ADR-0061) | decided |
| Q2 | Which signup is offered? | Meta's Embedded Signup (current version, v4 at checking), coexistence first: "Use my WhatsApp Business app number" as the default path, with Meta's own "new number" path left available inside the pop-up | Claude · reversible | 2026-11-06 | Parent Q12; Meta's pop-up already offers both, so no fork of ours | decided |
| Q3 | What does the connect screen say about coexistence? | A subtle line under the button, not a warning: "Your WhatsApp catalogue will then be managed from Bhendi Bazaar. Chats, broadcasts and Status stay in your app." | Claude · reversible | 2026-11-06 | Parent Q38 sets the tone; the words are ours | decided |
| Q4 | Is the pop-up pre-filled? | Yes: business name, email and website from the shop's profile | Claude · reversible | 2026-11-06 | Fewer fields for the shop; Meta supports it | decided |
| Q5 | What do we do after the pop-up returns? | Exchange the code for the business token, register the number for Cloud API, subscribe our app to the WhatsApp account's webhooks (incl. `smb_app_state_sync`, `smb_message_echoes`, `history`, `account_update`), read the number's display name, verified name status and quality, and read whether a payment method is set | Claude · reversible | 2026-11-06 | Meta's documented post-signup steps; research 2026-11-06 | decided |
| Q6 | Is chat history requested in the pop-up? | No (parent Q10, parked). The history webhook is subscribed only because Meta requires it for coexistence; its events are dropped | Claude · reversible | 2026-11-06 | Parent Q10 | decided |
| Q7 | Does the connection need renewing? | No: the business token does not expire on a clock. The daily pass checks it and the number's health; a lost token or a removed app sets Needs reconnecting | Claude · reversible | 2026-11-06 | INTEGRATIONS.md | decided |
| Q8 | What does a healthy card show? | Connected, the number (+91 98•••• 4321 masked except last four), its WhatsApp display name, quality (High, Medium, Low), whether payments are set up, who connected it and when, and last checked | Claude · reversible | 2026-11-06 | What the shop needs to trust it and to know whether it can send | decided |
| Q9 | What if no payment method is on the WhatsApp account? | Connected, with a line "Add a payment method in Meta to send messages. Replies within 24 hours are free." and a link to Meta's billing page. Never blocks connecting (ADR-0053) | Claude · reversible | 2026-11-06 | Parent Q8: the shop pays Meta directly | decided |
| Q10 | One number per shop? | Yes. One shop per number too: a number connected to another shop is refused | Claude · reversible | 2026-11-06 | One inbox and catalogue per shop; mirrors connect-instagram Q4 | decided |
| Q11 | A reconnect with a different number? | Refused; disconnect, then connect the new number | Claude · reversible | 2026-11-06 | One path to switch, as for every channel | decided |
| Q12 | What if Meta's new-shop limit is reached? | The card shows Full for now with "WhatsApp lets us add a limited number of new shops each week. Try again in a few days." The tap explains; nothing is queued | Claude · reversible | 2026-11-06 | Parent Q46; 10 per rolling 7 days until review, 200 after (research 2026-11-06) | decided |
| Q13 | What happens on disconnect? | Confirmed in a dialog. We unsubscribe our app from the WhatsApp account and delete the token; the number stays in the shop's Business app and keeps working there; the record is kept as disconnected | Claude · reversible | 2026-11-06 | Coexistence means the number is the shop's, not ours | decided |
| Q14 | What if quality drops to Low or the number is flagged? | The card shows the quality chip in amber or red with "WhatsApp rates your number Low. Sending marketing may be limited." and the dashboard line once | Claude · reversible | 2026-11-06 | Shop must see the risk before campaigns fail | decided |
| Q15 | Where is acceptance verified before approval? | Embedded Signup with Meta's sandbox account (returns real ids, cannot send) and our own business's number with an app role; real third-party onboarding after approval (going-live.md) | Claude · reversible | 2026-11-06 | Parent Q81; research 2026-11-06 | decided |
| Q16 | Is coexistence available in India, and what if a number cannot use it? | Parent Q84: coexistence, verified on day one on the owner's number; a number that cannot use it may move fully to Bhendi Bazaar, the portal inbox being its WhatsApp | Owner | 2026-11-06 | Owner chose from researched options | decided |

## Parked (Later)
None beyond the parent's (Q10 chat history).
