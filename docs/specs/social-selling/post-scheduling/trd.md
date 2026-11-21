# TRD — social-selling/post-scheduling

- **Status:** Draft
- **Domain:** social (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md) (Draft), [decisions.md](decisions.md), parent [decisions](../decisions.md), [ADR-0012](../../../adr/0012-modules-are-vertical-slices-by-domain.md), [ADR-0033](../../../adr/0033-a-domain-is-reached-through-its-public-surface.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0058](../../../adr/0058-media-is-one-aggregate-a-derivative-is-lineage-not-a-use-and-usage-is-derived.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> Screens, states and copy are ux.md's; this says how they are built.

## Approach
A new `server/social/` domain owns posts and their destinations. It knows no platform: it declares
a `Publisher` port (one verb, `publish(destination, post)`, answering `published`, `retry`, `failed`
with a reason code; whatsapp-status-kit D1 adds `ready`, handed to a person) and a registry keyed by destination. `channels` registers the Instagram plug
(instagram-publishing); social registers its own Status plug (whatsapp-status-kit) and a fake for
tests and dev. The schedule lives in our database; a minute tick on the worker claims due
destinations and publishes each as its own job.

## Prior art
- **Schedulers** (Buffer, Later, Meta Business Suite) keep one post with a row per network
  ("profile"), each with its own status and error; a failed network never fails the others. We
  follow that (parent Q51). Buffer retries transient errors a few times then emails; we do the same (parent Q51).
- **Due-work claiming** is the transactional outbox/claim pattern: `UPDATE … SET state = publishing
  WHERE state = scheduled AND due ≤ now RETURNING`, so two workers never take one row. Our worker
  already claims this way (`listing-publish.service.ts`, marketplace-publish D3); followed.
- **Ports and adapters** (Cockburn) for the plug: the tool owns the interface, the platform
  implements it. Parent Q7 requires it.

## Technical decisions
- **D1 — Domain `server/social/`.** Public surface: `post.service` as `socialPostService` (create,
  update, cancel, duplicate, list; `ruleFor(orgId, platform, postExternalId)` → products, keyword, DM
  text, paused, for comment-automations D4; `recordProgress(destinationId, attempt, externalIds)` for
  a plug's container ids, instagram-publishing D3) and `post.types`; `publisher.port` (the port and
  `registerPublisher`). Repository `post.repository.ts` writes `Post`
  and `PostDestination` (one aggregate).
- **D2 — Media by asset id, never URL.** A post item stores the library asset id and its order;
  the plug asks content's renditions for the address it needs at publish time (ADR-0058: usage is a
  query). Media are referenced, so the library's "used in" reads posts too.
- **D3 — A destination is claimed, then published outside the transaction.** The tick
  (`social.publish-due`, every 60s, a queued singleton) claims due rows to `PUBLISHING` with an
  attempt count and enqueues `social.publish` per destination keyed on (destination, attempt). The
  plug is called with no transaction open; its answer is written only while the row is still
  `PUBLISHING` at that attempt.
- **D4 — Edits compare on version.** A save sends the version it read; a row past `SCHEDULED`
  refuses with `POST_LOCKED`. The claim bumps the version, so a save racing the tick loses cleanly.
- **D5 — Retries are ours, not the queue's.** A `retry` answer sets the row back to `SCHEDULED` at
  now + 5, 10, 15 minutes (three tries, ~30 minutes, parent Q51); a fourth `retry` or any `failed`
  sets `FAILED` with the reason code and emits `social.post-failed` to notifications in the same
  transaction. A `NEEDS_RECONNECT` reason is never retried.
- **D6 — Time is UTC in the database, IST at the edges.** Pickers send a local IST time;
  `india-time.ts` converts both ways. Due is `scheduledAt ≤ now()` in Postgres, never JS clocks.
- **D7 — A missing asset fails the destination** with `MEDIA_GONE` at publish; scheduling checks the
  assets are live and the shapes valid (Q4) through a pure `post-rules.ts`.
- **D8 — Events, not imports, to notifications.** `social.post-failed` (orgId, postId, destination,
  reason) is a job spec in `server/shared/jobs/`, handled by hub-core (parent Q66); whatsapp-status-kit
  D3 adds `social.post-due` the same way. Social never imports notifications.
- **D9 — The comment DM text** is stored as the shop wrote it; the default is built once at
  creation from `ROUTES` product links (no stored URL host, `appUrl()` at send).

## Packages
None.

## UI approach
Screens, states and copy: ux.md. Rules: src/components/CLAUDE.md.
- **Per form factor:** phone first, one column: tabs, list of post rows, a docked "New post" button.
  The composer is a full-screen page on phone; `md:` shows the list and composer side by side;
  `lg:` adds a preview column. Media picker reuses the library's picker sheet.
- **Rendering:** `/org/[orgId]/posts` and `/posts/new`, `/posts/[postId]` are server pages through a
  `posts.dal.ts`; client leaves: `PostComposer` (`useServerForm`, Zod schema from
  a new `post` schema in the validation schemas folder), `PostRowActions` (`useMutation`).
- **Behaviour:** `postsApiClient` (create, update, cancel, duplicate, publish-now). DTOs:
  `PostSummaryDTO`, `PostDetailDTO`, `DestinationDTO`.
- **Surfaces:** existing `Tabs`, `StatusBadge`, `FormDialog` for Cancel confirm, library picker
  sheet; words in a new `posts-copy.ts` in a `social` components folder. No new token.

## Gates touched
- `module-boundaries` — `social` in `PUBLIC_SURFACE` with `publisher.port`; channels imports it.
- `docs-integrity` — the new social `CLAUDE.md` in `LIVING_DOCS`; root CLAUDE.md domain table.
- `route-reachability`, `portal-boundary` — new `/api/org/[orgId]/posts/**` routes under `withOrg`.
- `request-body-parsing` — the post schema; `one-repository` — `Post`, `PostDestination`.
- `file-cohesion` — `post.service` reaches catalog (assets) and content (renditions) only.
- Rate-limit registry — the new routes classified as portal writes.

## Data model [MIGRATION]
`Post`: shop, kind (image, carousel, reel, story), caption, products (ids, 0–10), keyword, DM text,
created-by, version, cancelled-at/by. `PostItem`: post, asset id, position. `PostDestination`: post,
destination (closed set `DESTINATION`: instagram-feed, instagram-story, whatsapp-status), state
(`SCHEDULED`, `PUBLISHING`, `READY`, `PUBLISHED`, `FAILED`, `CANCELLED`), scheduledAt (UTC), attempt,
external id, permalink, reason code, published-at. Index (state, scheduledAt). No cascade from a
shop (ADR-0020).

## API / contract changes [CONTRACT]
`PostSummaryDTO`, `PostDetailDTO`, `DestinationDTO`, `DESTINATION`, `POST_REASON`; the `Publisher`
port; `socialPostService.ruleFor` and `recordProgress`; the `social.post-failed` job spec. CONTRACTS.md gains a "Posts" section.

## Test plan
- Unit: `post-rules` (carousel 2–10, no video in carousel, caption 2,200 and 30 hashtags, story
  single item, 60-day horizon); IST↔UTC at midnight; retry schedule; reason → copy mapping.
- Integration: two ticks claim one row once; a save racing the claim refuses; a fake `retry` thrice
  then `FAILED` with one event; a failed destination leaves its sibling published; an archived asset
  fails with `MEDIA_GONE`; cancel keeps the row.
- Manual: ux.md's matrices at 360px, through the fake publisher.

## Delivery (units)
1. Schema, repository, `post-rules`, the port and the fake — no route.
2. Service and routes: create, update, cancel, duplicate — behaviour-changing.
3. The tick, the publish job, retries and the failed event.
4. Posts pages, composer, sidebar item.

## Open questions
None.
