# TRD — social-selling/instagram-publishing

- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md) (Draft), [decisions.md](decisions.md), parent [decisions](../decisions.md), [post-scheduling trd](../post-scheduling/trd.md), [connect-instagram](../connect-instagram/), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), [ADR-0028](../../../adr/0028-images-live-in-cloudflare-r2.md), [ADR-0039](../../../adr/0039-video-is-stored-in-our-object-store-and-transcoded-by-the-worker.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
An Instagram provider in `server/channels/providers/instagram/` implements social's `Publisher`
port for `instagram-feed` and `instagram-story`, registered at worker start. It gets a valid token
from connect-instagram's connection (never leaves channels), asks content for a public rendition of
each item, makes the container(s) at publish time, waits for them to finish, publishes, and reads
back the permalink. Every Instagram answer maps to social's `published`, `retry` or `failed` with a
reason code.

## Prior art
- **Meta's documented two-step publish** (`POST /<IG_ID>/media` → poll `status_code` →
  `POST /<IG_ID>/media_publish`; carousels: child containers then a parent with `children`). Followed
  exactly; there is no other route.
- **Idempotency by remembered external id**, as Stripe's idempotency keys and our marketplace publish
  (marketplace-publish D4: claimed state, call outside the transaction, answer written only while
  still claimed). Instagram has no idempotency key, so the container id is ours (Q7).
- **Buffer and Later** generate the public media URL at publish time from their own storage and
  check `content_publishing_limit` before publishing. Followed (Q3, Q5).

## Technical decisions
- **D1 — The plug.** `instagram.publish.ts` implements `Publisher`; registered from
  `channels.jobs.ts` beside the other handlers. No Instagram code in `server/social/`.
- **D2 — Media.** Images: content's `renditionUrl` with two new surfaces, `instagramFeed`
  (1080×1350 inside, JPEG) and `instagramStory` (1080×1920 inside, JPEG, flattened on white), so
  nothing is cropped without the shop's crop. Video: the asset's 1080p MP4 rendition's public
  address. Addresses are R2's public host (`publicUrlFor`), long random keys, never signed short
  links Instagram might fetch late.
- **D3 — Containers at publish, remembered.** Before the first call the plug stores the container
  id(s) on the destination (through social's `recordProgress` command). A retry with a stored
  container reads its `status_code`: `FINISHED` → publish; `PUBLISHED` → read the media id and
  answer published; `EXPIRED`/`ERROR` → make new ones. A carousel stores child ids as made, so a
  retry only makes what is missing.
- **D4 — Waiting.** Poll `status_code` every 5 seconds for up to 60 seconds inside the job; still
  `IN_PROGRESS` → `retry` (video often needs longer; the next attempt resumes the same container).
- **D5 — Limit first.** `GET /<IG_ID>/content_publishing_limit` before making containers; zero →
  `failed` `IG_DAILY_LIMIT` with the window's reset time. Not retried (Q5).
- **D6 — Error mapping, in one pure table** (`instagram-errors.ts`): network, timeout, 5xx, code 4/17/
  32/613 (rate) → `retry`; 190 or 10 (token or permission) → `failed` `NEEDS_RECONNECT` and the
  connection marked through `channel-connection.service`; 9004/2207xxx media and caption codes →
  `failed` with the matching `POST_REASON`. Bodies never logged; only code and subcode.
- **D7 — Permalink.** After publish, `GET /<media-id>?fields=permalink`; stored on the destination.
  A missing permalink still counts as published (story permalinks can be absent).
- **D8 — Graph version pinned** in the provider, one constant, as Amazon's `version=beta` is (Q16
  of channel-connectors): changed by edit, with INTEGRATIONS.md.

## Packages
None. Plain `fetch` with a 10-second timeout, as the other providers.

## UI approach
None of its own. The reasons and the "View on Instagram" link are post-scheduling's destination
row; their copy is in ux.md and `posts-copy.ts`.

## Gates touched
- `module-boundaries` — channels imports social's `publisher.port` (declared public) and content's
  renditions service (already public).
- `file-cohesion` — `instagram.publish.ts` reaches social and content: two domains, at the limit.
- `one-repository` — no new table; progress written through social's command.

## Data model
None beyond post-scheduling's `PostDestination` (external id, container ids, permalink), and two
`MEDIA_SURFACES` entries.

## API / contract changes
`POST_REASON` gains `IG_DAILY_LIMIT`, `IG_MEDIA_REFUSED`, `IG_CAPTION_REFUSED`, `IG_VIDEO_REFUSED`,
`NEEDS_RECONNECT` (shared with other plugs). CONTRACTS.md's "Posts" section lists them.

## Test plan
- Unit: error table for every listed code; rendition surface sizes; container-resume decisions per
  `status_code`.
- Integration (fetch stubbed): single image publishes once; answer dropped after `media_publish` then
  retried → one publish, status read; carousel with one child refused → failed, no parent made;
  limit zero → failed without containers; 190 → `NEEDS_RECONNECT` and the connection updated.
- Manual (Q10): the owner's account on dev — image, carousel, reel, story; the screencast for review.

## Delivery (units)
1. Rendition surfaces and the error table — no behaviour.
2. The provider and registration; image and story publish — behaviour-changing.
3. Carousel and reel, with container resume.
4. Owner's account walk-through and the review screencast (going-live.md).

## Open questions
None.
