# TRD — social-selling/whatsapp-status-kit

- **Status:** Draft
- **Domain:** social
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md), [post-composer TRD](../post-composer/trd.md), [notifications-core TRD](../../notification-hub/notifications-core/trd.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
A destination plug with no platform call: at the due time the destination turns `READY` and the
shop is told; the handoff page gives the phone a 9:16 JPEG and the caption through the Web Share
API, with copy-to-clipboard first and a download and QR fallback.

## Prior art
- **Web Share API Level 2** (`navigator.share({ files, text })`, gated by `navigator.canShare`) is
  how a web app hands a file to WhatsApp on Android and iOS; some targets drop `text` when files are
  shared, which is why the caption is copied first (Q2). Followed.

## Technical decisions
- **D1 — Plug (R1, Q7).** `connectionNeeded` is false: Status is always available. Due →
  `READY` and an at-once `post due` event (notifications-core, email for now, Q9).
- **D2 — The image (Q2).** At due time a 1080×1920 JPEG rendition is made (fitted on a plain
  background when not portrait) and stored as a derivative of the asset; the handoff page links it
  with a short-lived signed URL.
- **D3 — Handoff page.** `/org/[orgId]/posts/[postId]/status`: server component reading the
  destination; client leaf with Share (fetch the image as a `File`, `canShare` check, copy caption,
  `share`), Copy caption, Download, and a QR of the page URL drawn as an inline SVG generated on the
  server (a small encoder in `shared/qr.ts`, no dependency: QR generation is ~200 lines and fixed).
- **D4 — Done and missed (R5, R6, Q4).** "I've posted it" → `PUBLISHED` with `markedById`; Mark as
  skipped → `SKIPPED`; after 24 h `READY` reads Not posted (derived from time, not a job).

## Packages
None (the QR encoder is written once, tested against the standard's sample vectors).

## UI approach
ux.md's handoff page: phone full page with the buttons at the thumb; desktop a `HandoffSheet` with
the QR first. Pending and toasts per ux-patterns. Words in `social-copy.ts`.

## Gates touched
Route mark-posted/skipped; the page route; `MAY_USE_SHEET`.

## Data model
None beyond `PostDestination` (kind `WA_STATUS`, `renditionId`).

## API / contract changes
None.

## Test plan
- Due → READY and one event; missed after 24 h derived.
- Share leaf: `canShare` false → Download and QR shown (component test).
- QR encoder against the ISO sample vectors.

## Delivery
1. Plug, rendition, events (behaviour).
2. Handoff page and QR (UI).

## Open questions
None.
