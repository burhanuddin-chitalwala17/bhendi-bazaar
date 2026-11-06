# TRD — social-selling/whatsapp-status-kit

- **Status:** Draft
- **Domain:** social
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md) (Draft), [decisions.md](decisions.md), parent [decisions](../decisions.md), [post-scheduling trd](../post-scheduling/trd.md), [notification-hub](../../notification-hub/spec.md), [ADR-0034](../../../adr/0034-render-on-the-server-by-default.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
A Status plug inside `server/social/` implements the `Publisher` port for `whatsapp-status`. It
calls nothing external: at the post's time it makes the 9:16 picture, sets the destination to
`READY`, and the post's due tick emits one `social.post-due` event. The handoff is browser-side:
a client leaf on the post page uses the Web Share API with files, falling back to download and copy.
The shop's "I've posted it" closes the destination.

## Prior art
- **Later and Planoly's "notification publishing"** for what an API cannot post (Instagram personal
  accounts, TikTok drafts): at the time, a push with media ready and a one-tap share; the user
  confirms it was posted. Followed, with notifications instead of push (parent Q41, Q67).
- **Web Share API Level 2** (`navigator.canShare({ files })`, W3C) is the only standard way a web
  page hands a file to WhatsApp; supported on Android Chrome and iOS Safari 15+. Fallback is a
  download link and clipboard, as MDN recommends.

## Technical decisions
- **D1 — The plug is social's own.** `status.publisher.ts` registers for `whatsapp-status`; its
  `publish` makes the rendition and answers `ready` (a fourth answer added to the port, meaning
  "handed to a person"). No WhatsApp or Meta code; nothing in channels.
- **D2 — The picture.** A new `MEDIA_SURFACES.status` (1080×1920, `inside`, JPEG, flattened on white)
  through content's renditions; video uses the 720p MP4 rendition (WhatsApp Status trims to 60s and
  prefers small files). Made at `ready`, not when sharing, so the tap is instant.
- **D3 — One event per post.** The publish job, when it sets the last of a post's due Status
  destinations `READY`, enqueues `social.post-due` keyed on (post, scheduledAt) in the same
  transaction; a redelivered job finds the key and adds nothing.
- **D4 — Share leaf.** `StatusShareButton` (`"use client"`): fetches the rendition as a blob from its
  public address, copies the caption, then `navigator.share({ files, text })`. `canShare` false →
  renders Download image and Copy caption instead. A rejected share (user cancelled) changes nothing.
- **D5 — Closing.** `POST …/destinations/[id]/posted` and `…/skipped` move `READY` to `PUBLISHED`
  or `CANCELLED` (skipped reason), comparing on version. "Not posted" after 24h is derived on read,
  never stored.
- **D6 — Address.** The rendition's R2 key is random and long; the post page is behind the portal,
  so only members see it. No signed URL: the share fetch must not expire mid-tap.

## Packages
None.

## UI approach
Screens, states and copy: ux.md. On the post detail page (post-scheduling), the WhatsApp Status
destination row gains the share block when `READY`: preview, Share to Status (primary), Copy
caption, I've posted it, Mark as skipped. Phone-first; on `md:`/`lg:` the same block shows the
download fallback because desktops rarely share files. Words in `posts-copy.ts`.

## Gates touched
- `rendering-strategy` — one client leaf; the page stays a server component.
- `route-reachability`, `portal-boundary` — the two close routes under `withOrg`.
- `request-body-parsing` — the close routes take only the version.

## Data model
None beyond post-scheduling's `READY` state and one `MEDIA_SURFACES` entry.

## API / contract changes
`Publisher` answer `ready`; `social.post-due` job spec (in post-scheduling's CONTRACTS.md section).

## Test plan
- Unit: due-after-24h derivation; the share leaf chooses share vs fallback by `canShare`.
- Integration: two Status destinations on one post → one `post-due`; redelivered job → still one;
  posted and skipped close only from `READY` at the read version.
- Manual: A2 on Android (WhatsApp Business), A3 on iPhone, A4 on desktop.

## Delivery (units)
1. The plug, the surface, the `ready` answer and the due event — behaviour-changing.
2. The share block and close routes.

## Open questions
None.
