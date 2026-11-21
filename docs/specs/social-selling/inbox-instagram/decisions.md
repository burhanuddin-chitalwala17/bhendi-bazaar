# Decisions — social-selling/inbox-instagram

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn"
> means [../decisions.md](../decisions.md). Binding here from the parent: Q2, Q7, Q34, Q36, Q49, Q63, Q80, Q81.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Which Instagram events reach the inbox? | DMs (`messages`), story replies and story mentions (which arrive as DMs), and comments on the shop's own posts and reels (`comments`, which also carries @mentions in a comment). Not live comments, reactions or seen receipts | Owner | 2026-11-21 | Story replies are where buyers ask "price?" (parent Q95). was: DMs and comments only; not story mentions (Claude · reversible, 2026-11-06) | decided |
| Q2 | Is a comment its own conversation? | Each top-level comment and its replies is one conversation, grouped under its post (thumbnail and caption start shown on the thread) | Claude · reversible | 2026-11-06 | Matches inbox-core Q2; a shop answers comments one by one | decided |
| Q3 | Can the shop answer a comment privately from the inbox? | Yes, "Reply by DM" on a comment thread: Meta's private reply, one per comment within 7 days. The DM then continues in its own DM conversation | Claude · reversible | 2026-11-06 | The permission is already asked (connect-instagram Q2); the same call comment-automations uses | decided |
| Q4 | Which reply window does a DM report? | Open within 24 hours of the person's last message; human-agent from 24 hours to 7 days (parent Q36), sent with the `HUMAN_AGENT` tag; shut after 7 days | Claude · reversible | 2026-11-06 | Meta's messaging rules, checked 2026-11-06 | decided |
| Q5 | What does a public comment reply do? | Posts a reply under the comment on Instagram, visible to everyone; the reply box on a comment thread says "Reply publicly" | Claude · reversible | 2026-11-06 | The shop must know a comment reply is public | decided |
| Q6 | What if the connection is not live yet for comment and DM webhooks (before Meta's review)? | Built and accepted on recorded webhook payloads replayed through the real route; the live check is in going-live.md (parent Q81) | Claude · reversible | 2026-11-06 | Meta says Instagram Login webhooks need Advanced Access; unconfirmed, tested on day one | decided |
| Q7 | Are comments on posts made outside Bhendi Bazaar included? | Yes: every post and reel of the connected account, however it was published | Claude · reversible | 2026-11-06 | The buyer does not know where a post was made | decided |
| Q8 | Are the shop's own replies made in the Instagram app shown? | Yes: Meta sends them as echoes; they show as "From the Instagram app" | Claude · reversible | 2026-11-06 | Otherwise the thread looks unanswered | decided |
| Q9 | What happens to the inbox when the account is disconnected or removes our app? | Conversations stay readable; replies say Reconnect; the 90-day retention clock starts at disconnect (parent Q34) and stops if the same account reconnects | Claude · reversible | 2026-11-06 | Parent Q34 | decided |
| Q10 | Does a comment from a private account appear? | Meta sends comment webhooks only for a public professional account's media; a shop whose account is private gets no comments, and the Instagram tab says so | Claude · reversible | 2026-11-06 | Meta's rule, checked 2026-11-06 | decided |

## Parked (Later)
- Story mentions and story replies as their own kind (Q1).
- Live comments (Q1).
