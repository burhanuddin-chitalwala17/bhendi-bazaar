# Decisions — social-selling/whatsapp-contacts

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn"
> means [../decisions.md](../decisions.md); "audience Qn" means [../audience/decisions.md](../audience/decisions.md).
> Binding here from the parent: Q7, Q9, Q10, Q12, Q13, Q58, Q59, Q62, Q65, Q80.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What arrives from the shop's WhatsApp Business app? | Its contacts (name and phone), first as Meta's initial sync after a coexistence connect, then each add, edit or removal, from the `smb_app_state_sync` webhook. All arrive as Not yet (parent Q13) | Claude · reversible | 2026-11-06 | The webhook Meta documents for coexistence (INTEGRATIONS.md); parent Q9 | decided |
| Q2 | Does a contact removed in the app leave Bhendi Bazaar? | Only if it has no consent history and no conversation; otherwise it stays, marked "removed from your phone" | Claude · reversible | 2026-11-06 | A consent record must outlive a phone-book tidy-up; a contact with nothing behind it is just noise | decided |
| Q3 | Does a synced name overwrite one the shop typed or uploaded? | No. The phone-book name fills only an empty name | Claude · reversible | 2026-11-06 | The shop's own edit is the stronger fact; mirrors "a fill never overwrites" in channels | decided |
| Q4 | Which chat words opt in and stop? | Audience's lists (audience Q10, Q13). This subfeature only turns each inbound WhatsApp message into a neutral "message received" event audience reads; it adds no words of its own | Claude · reversible | 2026-11-06 | One home for the words, platform-free (parent Q7) | decided |
| Q5 | What does the confirming reply say, and in which language? | On YES: "You're in. <shop> will send you offers here. Reply STOP any time. Reply HINDI for Hindi." On STOP: "Done. <shop> won't send you offers. Reply YES to start again." Sent free inside the 24-hour window the inbound message opened; in Hindi when the contact prefers it | Claude · reversible | 2026-11-06 | Meta's 24-hour window makes the reply free; the HINDI offer is parent Q65's "every first message" | decided |
| Q6 | Does a reply typed in the Business app (an echo, `smb_message_echoes`) count as the buyer's YES? | No. Only an inbound message from the buyer counts. An echo is the shop's own words | Claude · reversible | 2026-11-06 | Consent must come from the person, never the sender | decided |
| Q7 | What if a YES arrives from a number never seen before? | A contact is made for it and opted in, source Chat, with the message as evidence | Claude · reversible | 2026-11-06 | Store-page opt-ins (parent Q59) arrive exactly like this | decided |
| Q8 | What if the confirming reply fails to send? | The consent change stands; the failure is logged, never retried past the 24-hour window | Claude · reversible | 2026-11-06 | The opt-in or stop is the buyer's act; our reply is a courtesy. A STOP must never wait on a send | decided |
| Q9 | How does a contact sync reach audience without audience knowing WhatsApp? | Channels' WhatsApp webhook (parent Q80) writes each event once and enqueues neutral jobs: `audience.contacts-synced` (shop, list of phone and name, removed flags) and `audience.message-received` (shop, phone, text, message id, channel). Audience handles both and never imports channels | Claude · reversible | 2026-11-06 | Parent Q7, Q80 | decided |
| Q10 | Is chat history imported on connect? | No (parent Q10, parked). Only contacts sync | Owner | 2026-11-06 | Parent decision | parked |
| Q11 | What if the initial sync never arrives (the shop declined, or Meta is slow)? | The Audience page shows "Contacts from your phone: waiting" for 24 hours after connecting, then "Not shared" with no action: contacts only arrive at connect, so a shop wanting them reconnects | Claude · reversible | 2026-11-06 | Meta shares app state only around onboarding; say what is true | decided |

## Parked (Later)
- Q10 — chat history (parent Q10).
