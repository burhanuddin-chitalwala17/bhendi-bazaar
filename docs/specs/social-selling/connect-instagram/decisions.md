# Decisions — social-selling/connect-instagram

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q1, Q2, Q3, Q7, Q8, Q14, Q18, Q34,
> Q36, Q66.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q2 | What does connecting ask for, and where does it stop? | Every Instagram permission the single review covers, and nothing else: `instagram_business_basic`, `_content_publish`, `_manage_comments`, `_manage_messages`, plus the human-agent feature (parent Q36); insights are Later (parent Q21). Connecting ends at a healthy connection: publishing is instagram-publishing's, comments and DMs inbox-instagram's | Claude · reversible | 2026-11-06 | One review (parent Q2) means all are in use by submission time; asking now spares every shop a reconnect. Unused extras are a rejection reason | decided |
| Q4 | Can an account serve two shops, or be swapped on reconnect? | No: one shop per account. An account already connected to another shop is refused at once, with the reason, and a reconnect that consents with a different account is refused too; to switch, the shop disconnects and connects the new one | Claude · reversible | 2026-11-06 | The Instagram id arrives with the token, so it is checkable at once; mirrors marketplace-integration Q8 | decided |
| Q6 | Does the connection need renewing? | Yes. Instagram's long-lived token lasts 60 days; we renew it with nobody acting, from the daily pass, once it is older than 7 days. If renewal fails or the shop removed our app, the card says Needs reconnecting | Claude · reversible | 2026-11-06 | Instagram's own login expires, unlike WhatsApp's system-user token; Meta's business-login page, 2026-11-06 | decided |
| Q8 | What does the card show, and how does a connection end? | A healthy card shows Connected, `@username`, Business or Creator, who connected it and when, and when we last checked. Disconnecting is confirmed in a dialog that also says how to remove Bhendi Bazaar in Instagram's settings; credentials are deleted and the record kept as disconnected, inbox messages following parent Q34. If the shop removes our app inside Instagram, the connection turns Needs reconnecting when Meta's deauthorize call arrives, or at the next daily check if it never does, and the dashboard says so once | Claude · reversible | 2026-11-06 | Records people authored are retired (ADR-0032); mirrors channel-connectors Q4, Q9 | decided |
| Q13 | How does the Instagram card sit beside the "Meta (Facebook & Instagram)" feed card? | The feed card is renamed "Meta catalogue" with the line "Your products in Facebook and Instagram shops, from your catalogue feed." The new card is "Instagram" with "Post, reply to comments and answer DMs from here." The Instagram card sits in Where you sell, directly after Meta catalogue | Claude · reversible | 2026-11-06 | The feed shows products; the connection acts for the account. Two names for two jobs | decided |
| Q14 | Where does Instagram sit in the channel set? | A new key `instagram` in `CHANNEL`, of a new kind `social` (ADR-0068): connected, published to, with no order or stock; `meta` stays the shopfront feed. Its callback is `appUrl()` + `/api/channels/instagram/callback`, registered for www production and dev, as the marketplaces' are | Claude · reversible | 2026-11-06 | Its own connection, token and card (parent Q1); a social channel is not where a product is listed | decided |
| Q16 | How does the shop learn to allow message access, and how do we know it is on? | The three taps are shown right after connecting and stay on the card until the first message arrives, since Instagram may not expose the toggle itself. Where Meta answers a read or a send with "access off", the card says so. The TRD's spike confirms what Meta exposes | Claude · reversible | 2026-11-22 | Without access no DM arrives and nothing else tells the shop why (parent Q1); showing the steps costs nothing if they turn out to be detectable | decided |

## Parked (Later)
None. Publishing, comments, DMs and insights are other parent subfeatures or parent Qs, not parked here.

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q1 → Q2 · Q3 → parent Q1 · Q5 → Q4 · Q7 → Q8 · Q9 → Q8 · Q11 → parent Q2 · Q12 → parent Q2 · Q15 → Q14 · Q10 → meta-foundation Q1 (moved 2026-11-22)
