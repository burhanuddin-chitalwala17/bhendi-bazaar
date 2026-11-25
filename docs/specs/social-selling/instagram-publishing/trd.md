# TRD — social-selling/instagram-publishing

- **Status:** Accepted
- **Domain:** channels (the Instagram plug), with social's plug contract
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md), [post-composer TRD](../post-composer/trd.md), `server/channels/listing-photos-out.ts`

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
The Instagram plug publishes a destination through Instagram's two-step content API: create a
container (or children and a carousel container), wait until it is `FINISHED`, then
`media_publish` it. The container is made at publish time, never at scheduling, because containers
expire in 24 hours and a post may wait 60 days.

## Prior art
- **Meta's content publishing guide**: containers, `status_code` polled once a minute for at most 5
  minutes, `media_publish`, and `content_publishing_limit` for the rolling 24-hour quota (100 posts,
  carousels counting one; Meta's pages also mention 25 and 50, so the quota is read, not assumed).
  Followed.

## Technical decisions
- **D1 — Containers (R3, Q2).** Images go as a public JPEG rendition at Instagram's sizes (feed
  1080 wide at 1:1 or 4:5; story 1080×1920 fitted on a blurred fill of itself, never cropped off the
  product, per ux), made by the existing renditions service and served from the object store's
  public URL for the duration of the publish. Video goes as the stored rendition; Instagram's own
  refusal reason is mapped to our words.
- **D2 — Publish once (R2, A-D8).** The destination row stores `containerId` and `containerAt`; a
  retry within 24 hours reuses it, after that makes a new one. `media_publish` is called once per
  container; an "already published" answer resolves to the existing media id. A timeout after
  `media_publish` reads the account's latest media for the container's caption hash before deciding
  `UNCERTAIN`, so a published post is recognised, not repeated.
- **D3 — Waiting (Q2).** The container status is polled inside the job every 20 s up to 5 minutes
  (the job renews its lane lease); still processing → temporary failure, retried by the queue.
- **D4 — Quota (R5, Q5).** `content_publishing_limit` read before each publish; zero → `FAILED`
  with `IG_DAILY_LIMIT` and the time quota frees (from the endpoint's window), not retried.
- **D5 — Fields (R4, Q9).** The plug's schema: `userTags` (handle, x, y per image; not on reels),
  `collaborators` (≤3 handles), `locationId` (from Instagram's place search, proxied through a
  rate-limited route). Handles are validated at publish by Instagram's answer, failing with the
  handle named.
- **D6 — Results (R6, R7).** Success stores the media id and permalink; failures map per A-D4.
  A lost connection at due time is `WAITING` (post-composer Q13), not Failed.
- **D7 — AI disclosure (R8, Q10).** The composer's note is computed from the media tags. The spike
  checks whether the publishing API accepts an AI label; if it does, the plug sets it, and the
  note's wording switches to "we'll add its AI info label".

## Packages
None.

## UI approach
ux.md's "More for Instagram" fold, tag-people sheet and preview tabs, as the plug's field components
inside the composer; place search through `postsApiClient.ts`. Words in `social-copy.ts`.

## Gates touched
Route place-search (rate-limited per shop); none else.

## Data model
`PostDestination.fields` (plug-owned JSON, Zod-checked), `containerId`, `containerAt`.

## API / contract changes
None beyond the plug contract.

## Test plan
- Container build per shape: image, carousel (2–10), reel, story; story fitted not cropped.
- Retry reuse inside 24 h, new container after; a duplicate `media_publish` resolves without a
  second post (A4).
- Quota zero → failed with time, not retried (A5).
- Refusals mapped to ux's sentences; no Meta text logged.

## Delivery
1. **after post-composer U1 (builds from a post and its destination kinds; content's renditions service is done)** — Container builders and renditions (pure + renditions).
2. **after U1 and post-composer U2 (the plug registry and `publish-due`)** — Publish with quota, polling, reuse (behaviour).
3. **after U2 and post-composer U4 (the fields render in the composer's fold)** — Fields, place search, AI note.

## Open questions
None.
