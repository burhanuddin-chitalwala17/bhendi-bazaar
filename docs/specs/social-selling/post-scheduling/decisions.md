# Decisions — social-selling/post-scheduling

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn"
> means [../decisions.md](../decisions.md). Binding here from the parent: Q3, Q7, Q26, Q30, Q51–Q53, Q64, Q66, Q67, Q79.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Where does a post's media come from? | The shop's media library only: an upload lands in the library first, then is picked. Anything a future generator makes reaches posting the same way, as a library asset plus plain caption text (parent Q26) | Claude · reversible | 2026-11-06 | One source, one rendition path, and posting never learns how a picture was made | decided |
| Q2 | Does this subfeature publish anywhere real? | No. It publishes through a fake publisher that records what it was handed; Instagram is the instagram-publishing plug, WhatsApp Status the whatsapp-status-kit plug | Claude · reversible | 2026-11-06 | Buildable and testable before any Meta access (parent Q81) | decided |
| Q3 | Which destinations can a post pick? | Instagram feed, Instagram story, WhatsApp Status; any combination, scheduled once (parent Q64). A destination shows only for a connected platform; WhatsApp Status needs no connection | Claude · reversible | 2026-11-06 | Status is a handoff to the phone (parent Q19, Q67) and needs no grant | decided |
| Q4 | Which shapes does a post take? | Image (one), carousel (2–10 images, no video inside, as Instagram allows), reel (one video from the library), story (one image or one video). Feed + story on the same post use the first item for the story | Claude · reversible | 2026-11-06 | Parent Q51; Instagram's own limits, so nothing is accepted that cannot publish | decided |
| Q5 | How far ahead, and how precisely, can a post be scheduled? | Now, or any minute up to 60 days ahead, in IST; shown to the minute. A post publishes within two minutes of its time | Claude · reversible | 2026-11-06 | 60 days covers festival planning; the worker's scheduler is per-minute | decided |
| Q6 | What does a post remember for comment-automations? | The product(s) it is about (0–10) and a keyword (default SHOP) and a DM text pre-filled with the product links; stored on the post, read by comment-automations through social's public surface | Claude · reversible | 2026-11-06 | Parent Q53: the shop picks products and keyword when scheduling, and may rewrite the DM | decided |
| Q7 | Can a scheduled post be edited or cancelled? | Yes, until its publish starts: edit anything, or Cancel (kept as cancelled, not deleted). Once publishing, it is locked; once published, it is read-only with a link | Claude · reversible | 2026-11-06 | A post is authored; retired not deleted (ADR-0032). Instagram has no edit-after-publish for media | decided |
| Q8 | How are failures retried? | A temporary error retries three times over about 30 minutes, per destination; then that destination is Failed with the reason, Publish now and a "post failed" event to notifications. A dead connection fails at once with Reconnect | Owner (parent Q52) | 2026-11-06 | Restates the parent decision for this tool | decided |
| Q9 | Does one failed destination fail the post? | No. Each destination has its own state; the post's line shows the worst one ("1 of 2 failed") | Claude · reversible | 2026-11-06 | Instagram failing must not undo a Status handoff that worked | decided |
| Q10 | Can a post be duplicated? | Yes: Duplicate opens a new draft with the same media, caption, products and keyword | Claude · reversible | 2026-11-06 | The common way a shop reposts; a state of what is In | decided |
| Q11 | Is there a calendar view? | No. A list in three tabs: Scheduled (soonest first), Published (newest first), Failed. A calendar is Later | Claude · reversible | 2026-11-06 | A list serves the phone; a calendar is a new screen no acceptance needs | parked |
| Q12 | How long is a caption allowed? | 2,200 characters and 30 hashtags, Instagram's limits, counted as typed; over the limit the field says so and Schedule explains on tap (never disabled) | Claude · reversible | 2026-11-06 | Instagram refuses longer captions; ADR-0053 | decided |
| Q13 | Where in the shop menu? | A new item "Posts" directly under Channels | Claude · reversible | 2026-11-06 | Beside where Instagram is connected; one item for every destination | decided |

## Parked (Later)
- Q11 — a calendar view of scheduled posts.
