# Decisions — social-selling/instagram-publishing

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn"
> means [../decisions.md](../decisions.md). Binding here from the parent: Q2, Q3, Q7, Q11, Q18, Q48, Q51, Q52, Q81.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Who holds the schedule? | We do. Instagram's API has no scheduling, so post-scheduling's worker calls this plug at the post's time; the plug publishes immediately | Claude · reversible | 2026-11-06 | Instagram offers no scheduled publish (INTEGRATIONS.md) | decided |
| Q2 | When is the Instagram container made? | At publish time, not at scheduling: a container expires after 24 hours, and a post may be scheduled up to 60 days ahead | Claude · reversible | 2026-11-06 | Containers expire in 24h; making one early would fail most scheduled posts | decided |
| Q3 | What address does Instagram fetch the picture from? | A public JPEG rendition of the library asset, made at publish time on our object store, sized for the destination (feed square or 4:5, story 9:16) | Claude · reversible | 2026-11-06 | Instagram needs a public URL and accepts JPEG only for images; the media library stores WebP | decided |
| Q4 | What about video (reels, video stories)? | The library's transcoded MP4 rendition, at its public address. A video Instagram refuses (length, ratio) fails with Instagram's reason in plain words | Claude · reversible | 2026-11-06 | product-video already transcodes to MP4 (ADR-0039) | decided |
| Q5 | How is the daily publishing limit handled? | Before each publish the plug reads the account's remaining quota; at zero the destination fails at once with "Instagram's daily limit reached; try after <time>" and Publish now. Not retried automatically | Claude · reversible | 2026-11-06 | Meta's own figure is 50 or 100 per 24h depending on the page; reading it beats guessing | decided |
| Q6 | What counts as a temporary failure? | Network failure, a timeout, Instagram 5xx or rate limiting, and a container still processing after 5 minutes. Everything else (refused media, refused caption) fails at once with the reason; a revoked token fails at once with Reconnect | Claude · reversible | 2026-11-06 | Parent Q52's retries only help what can change by itself | decided |
| Q7 | How is a double publish prevented? | The destination row is claimed before the first call and records the container id; a retry reuses the container and checks its status before publishing again; a container already published is recorded as published | Claude · reversible | 2026-11-06 | A retry after a lost answer must not post twice | decided |
| Q8 | What does a published destination show? | "Published · <time>" and "View on Instagram", the permalink Instagram returns | Claude · reversible | 2026-11-06 | Proof it landed; insights are Later (parent Q48) | decided |
| Q9 | Are @mentions, user tags and collaborators offered? | Captions may contain @mentions as typed. User tags, collaborators, location and stickers are not offered | Claude · reversible | 2026-11-06 | Mentions cost nothing; the rest is a new form no acceptance needs, and stickers cannot be published by API | decided |
| Q10 | Where is it accepted before Meta's review? | On the owner's own professional account on dev, with an app role (connect-instagram Q12); the screencast for `instagram_business_content_publish` is recorded from it (going-live.md) | Claude · reversible | 2026-11-06 | App roles get every permission without review (parent Q81) | decided |

## Parked (Later)
None beyond the parent's (insights, parent Q48).
