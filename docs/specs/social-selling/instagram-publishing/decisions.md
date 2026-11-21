# Decisions — social-selling/instagram-publishing

- **Verified:** 2026-11-21

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q1, Q2, Q3, Q7, Q18, Q21, Q51.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q2 | How does a post reach Instagram? | We hold the schedule, Instagram's API having none: post-scheduling's worker calls this plug at the post's time and it publishes at once. The container is made at publish time, since it expires after 24 hours and a post may be scheduled 60 days ahead. Instagram fetches a public JPEG rendition of the library asset made then, sized for the destination (feed square or 4:5, story 9:16), or the library's transcoded MP4. A double publish is prevented by claiming the destination before the first call and recording the container id: a retry reuses the container and checks its status, and one already published is recorded as published | Claude · reversible | 2026-11-06 | Containers expire in 24h; making one early would fail most scheduled posts | decided |
| Q5 | What are Instagram's limits and failures, and how are they handled? | Before each publish the plug reads the account's remaining daily quota; at zero the destination fails at once with "Instagram's daily limit reached; try after <time>" and Publish now, not retried. Network failures, timeouts, Instagram 5xx, rate limiting and a container still processing after 5 minutes count as temporary and are retried; refused media or caption fails at once with Instagram's reason in plain words, and a revoked token with Reconnect | Claude · reversible | 2026-11-06 | Meta's own figure is 50 or 100 per 24h depending on the page; reading it beats guessing | decided |
| Q9 | Which of Instagram's post features are offered? | Everything Instagram's publishing API allows: @mentions and hashtags in the caption (2,200 characters, 30 hashtags), people tagged on feed images and on stories, up to three collaborators on a feed post or reel, and a location where the API accepts one. Stickers (link, poll, location sticker) and music cannot be published by API and are not offered | Owner | 2026-11-21 | The owner asked for whatever Instagram provides. was: @mentions as typed; user tags, collaborators, location and stickers not offered | decided |

## Parked (Later)
None beyond the parent's (insights, parent Q21).

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q1 → Q2 · Q3 → Q2 · Q4 → Q2 · Q6 → Q5 · Q7 → Q2 · Q8 → parent Q51 · Q10 → parent Q2
