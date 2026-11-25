# TRD — social-selling/post-composer

- **Status:** Accepted
- **Domain:** social (new), reading catalog (media, products) through its public surface
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md), [instagram-publishing TRD](../instagram-publishing/trd.md), [whatsapp-status-kit TRD](../whatsapp-status-kit/trd.md), [ADR-0032](../../../adr/0032-records-people-authored-are-retired-not-deleted.md), [ADR-0058](../../../adr/0058-media-is-one-aggregate-a-derivative-is-lineage-not-a-use-and-usage-is-derived.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
A post is an authored record with destinations. The composer knows nothing about any platform: a
destination is a plug (`PostDestinationPlug`) that instagram-publishing and whatsapp-status-kit
implement, declaring which shapes it takes, its extra fields and how it publishes. Scheduling uses
the queue's `startAfter` with a version guard (A-D10); each destination is a claimed row (A-D8),
so the post's line is a function of its destinations' states.

## Prior art
- **Buffer, Hootsuite and Later** model a post with per-network "updates", each with its own status
  and error, and a composer that hides network-specific fields until the network is picked. We
  follow the shape; our plugs are those per-network halves.
- **Drafts autosaved by version** (Google Docs, Notion): a save carries the version it edited and a
  stale one is refused, which is also our listing editor's pattern. Followed.

## Technical decisions
- **D1 — Model.** `Post(id, orgId, version, state DRAFT|SCHEDULED|SAVED|PUBLISHING|DONE|CANCELLED,
  caption, mediaIds ordered, productIds (≤10), scheduledAt nullable, createdById, timestamps)` and
  `PostDestination(id, postId, kind IG_FEED|IG_STORY|WA_STATUS, state, fields JSON (the plug's own,
  Zod-checked by the plug), platformId, permalink, errorCode, errorText, attempts, publishedAt,
  markedById)`. Shape is derived, never stored (spec R2, ux "never asks the shape").
- **D2 — Plugs.** `social/destinations.ts` registry: `{ kind, accepts(shape), fieldsSchema,
  connectionNeeded(orgId), publish(destination) }`. `connectionNeeded` is how Q13 works: a
  destination whose platform is not connected is created `WAITING` instead of `SCHEDULED`.
- **D3 — Save and schedule (R3, R7, R10, Q13).** One route per verb: `PUT …/posts/[id]` (draft
  autosave, version-checked, 409 on stale, the composer re-reading the newer draft (Q15)), `POST …/schedule` (now or
  at a time ≤ 60 days, IST input stored as UTC), `POST …/cancel`, `POST …/duplicate`. Schedule
  validates the whole post with the plugs' schemas, then in one transaction sets destinations
  `QUEUED` (connected) or `WAITING` (not), bumps the version and enqueues `social.publish-due`
  with `startAfter = scheduledAt` and the version. Edit is allowed while every destination is
  `QUEUED` or `WAITING`; the first `CLAIMED` locks it.
- **D4 — Publishing (R7, R8).** `social.publish-due(postId, version)`: stale version ends; else
  each `QUEUED` destination's plug runs on its platform lane. Retries per A-D8 (3 over about 30
  minutes for temporary failures). The post's displayed state is the worst destination's,
  computed in the read model.
- **D5 — Waiting for a connection (Q13).** A connect (connect-* emits `connection ready`) lists
  the shop's `WAITING` destinations for that platform and raises "N posts waiting" on the card,
  Home and the Saved tab. Nothing is published until the shop picks Post now or a time
  (`POST …/release` with destination ids, bulk through `SelectionBar`).
- **D6 — Stale price hold (ai-images Q47).** Before claiming, a destination whose post has a drafted
  caption asks content's `captionStillTrue(postId)`; false → `HELD_PRICE`, notification "A post is
  held", released by Update price (content rewrites the number) or Publish as is.
- **D7 — Media safety (hazard).** Library assets used by a scheduled post are referenced by id;
  catalog's delete of a used asset is refused with "Used by a scheduled post" (catalog's usage is
  derived, ADR-0058); a replaced asset's derivative lineage keeps the post pointing at the version it
  had. At publish the plug re-reads the asset; a missing one fails with a reason, not a crash.
- **D8 — Worker down (hazard).** A due post found by the sweep (A-D10) more than 6 hours late is
  held for the shop (`LATE`), as campaigns do; under 6 hours it goes.
- **D9 — Read model.** `social/posts.read.ts`: tabs Saved, Scheduled, Published, Failed by keyset on
  `(orgId, tab, sortTime, id)`; tab counts by partial index; Published grouped by IST week in the
  query.

## Packages
None.

## UI approach
ux.md: Posts page (server component; tabs as `PageTabs` routes), composer as a full page on a phone
and `TaskDialog` from `lg:` with the live preview beside it; leaves: `post-composer.tsx` (form state
in `usePostDraft`, autosave debounced 800 ms through `postsApiClient.ts`), library and product
pickers (existing `ResponsivePicker`s, multi-select added to the library picker), when picker
sheet. Destination plugs contribute their fields components (`IgFields`, `StatusFields`) by kind.
Pending buttons per ux-patterns §3. Words in `social-copy.ts`.

## Gates touched
New domain `social` (`PUBLIC_SURFACE`, its `CLAUDE.md`); routes and their callers; `MAY_USE_SHEET`
for the when and cancel sheets; one repository each for `Post`, `PostDestination`.

## Data model
[MIGRATION] `Post`, `PostDestination` (D1); indexes `(orgId, state, scheduledAt)`,
`(postId)`, partial `(orgId) WHERE state IN ('FAILED')` on destinations for the count.

## API / contract changes
[CONTRACT] `PostDestinationPlug` (social ↔ channels and status kit).

## Test plan
- Schedule validation per plug; 60-day bound; IST conversion at a DST-free offset (unit).
- Version guard: an edit after scheduling leaves the old job a no-op (integration).
- Claim race: two `publish-due` jobs, one publish per destination.
- Waiting: nothing connected → Saved; connecting lists them; nothing publishes until released (A5).
- Price hold released both ways.
- Asset delete refused while scheduled.

## Delivery
1. **independent** — Model, drafts, autosave (behaviour: drafts).
2. **after U1** (meta-foundation's `publish` lane and `social.sweep`, which it uses, are done) — Plugs registry, schedule, publish-due, read model (behaviour: scheduling).
3. **after U2, ai-images/social-posts U3 (`captionStillTrue` for the price hold), notifications-core U1 ("A post is held"), connect-instagram U2 and connect-whatsapp U2 (the flows that emit `connection ready`)** — Waiting, release, late hold; adds the `connection ready` event, emitted from connect-instagram's and connect-whatsapp's existing flows when a connection becomes healthy (Q14).
4. **after U3** — Posts page and composer (UI).

## Open questions
None.
