# Decisions — social-selling/connect-instagram

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn"
> means [../decisions.md](../decisions.md). Binding here from the parent: Q1, Q2, Q3, Q7, Q11, Q14–Q18.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Does connecting also publish, read comments or read DMs? | No. This subfeature ends at a healthy connection; publishing is instagram-publishing, comments and DMs are inbox-instagram | Claude · reversible | 2026-11-06 | One outcome per feature (ADR-0061); mirrors channel-connectors Q1 | decided |
| Q2 | Which permissions does the connect ask for? | Every Instagram permission the single review covers: basic, content publishing, comments, messages. Nothing else | Claude · reversible | 2026-11-06 | One review (parent Q2) means all are in use by submission time; asking now spares every shop a reconnect when publishing and the inbox arrive. Unused extras are a rejection reason, so none beyond these | decided |
| Q3 | What may connect? | A professional account, business or creator (parent Q11). A personal account connects nothing and is shown the steps to switch for free in the Instagram app, then a way to try again | Claude · reversible | 2026-11-06 | Instagram's API serves only professional accounts | decided |
| Q4 | Can one Instagram account serve two shops? | No: one shop per account. An account already connected to another shop is refused at once, with the reason | Claude · reversible | 2026-11-06 | The Instagram id arrives with the token, so it is checkable at once; mirrors the owner's rule for marketplaces (marketplace-integration Q8) | decided |
| Q5 | What if a reconnect consents with a different Instagram account? | Refused; to switch, disconnect then connect the new one | Claude · reversible | 2026-11-06 | Same single path the owner chose for marketplaces (channel-connectors Q8) | decided |
| Q6 | Does the connection need renewing? | Yes. Instagram's long-lived token lasts 60 days and is renewed by us, with nobody doing anything; if renewal fails or the shop removed our app, the card says Needs reconnecting | Claude · reversible | 2026-11-06 | Instagram's own login, unlike WhatsApp's system-user token, expires; checked against Meta's business-login page 2026-11-06 and recorded in INTEGRATIONS.md | decided |
| Q7 | What does a healthy card show? | Connected, the Instagram username, business or creator, who connected it and when, and when we last checked it | Claude · reversible | 2026-11-06 | Enough to trust it is the right account; nothing to act on. No profile photo: Instagram's image links expire | decided |
| Q8 | What happens on disconnect? | Confirmed in a dialog. Credentials deleted; the record kept as disconnected with who connected it and when; the dialog says how to remove Bhendi Bazaar in Instagram's settings too | Claude · reversible | 2026-11-06 | Records people authored are retired, not deleted (ADR-0032); mirrors channel-connectors Q4, Q9 | decided |
| Q9 | What if the shop removes our app inside Instagram? | The connection shows Needs reconnecting at the next check, and the dashboard says so once | Claude · reversible | 2026-11-06 | A state of what is In, not a new feature; how Instagram tells us is the TRD's | decided |
| Q10 | What if a person asks Meta to delete the data we hold about them? | We delete that connection's credentials and Instagram details, and answer Meta with a confirmation the person can check | Claude · reversible | 2026-11-06 | Meta requires a data-deletion answer of every app before review (parent Q14); this is the first subfeature holding Meta user data | decided |
| Q11 | Who can connect, and when is it open? | Any member of a shop, as for marketplaces. The card is Coming soon wherever the one switch (`CHANNELS_CONNECT`) does not list Instagram; before the review only accounts with a role on our Meta app can finish the login, so the switch stays off in production until the review passes | Claude · reversible | 2026-11-06 | One switch, no new flags (channel-connectors Q10); a shop with no role would hit an error on Instagram's page we cannot explain | decided |
| Q12 | Where is A1 verified? | On the owner's own Instagram professional account, on dev, with the owner's account given a role on the Meta app | Claude · reversible | 2026-11-06 | Advanced Access is not needed for accounts with a role on the app; it is how parent Q2 means "works on our own accounts" | decided |
| Q13 | How does the Instagram card sit beside the "Meta (Facebook & Instagram)" feed card? | Open for ux-start: the two must not read as the same thing | — | 2026-11-06 | A copy and layout question for the UX stage | open |
| Q14 | Is Instagram a new channel in the closed set, or part of Meta? | For the TRD, with the ADR superseding ADR-0041 for Meta (parent Q15) | — | 2026-11-06 | Technical; spec states only what the shop sees | open |

## Parked (Later)
None yet. Publishing, comments, DMs and insights are already later subfeatures of the parent (instagram-publishing, inbox-instagram, comment-automations), not parked items of this one.
