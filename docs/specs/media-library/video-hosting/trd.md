# TRD — video-hosting

- **Status:** 🔨 In progress — PR-180, PR-181 (1 of 2); accepted 2026-09-27 with the defaults 90 s, 200 MB, 1080p and 720p
- **Domain:** catalog (assets), content (renditions)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-09-27
- **References:** [spec.md](spec.md), [../trd.md](../trd.md) (media-library), [../renditions/trd.md](../renditions/trd.md), [ADR-0039](../../../adr/0039-video-is-stored-in-our-object-store-and-transcoded-by-the-worker.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [worker-foundation trd](../../worker-foundation/trd.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

A video is one more kind of `MediaAsset`, entering by the register-before-sign path photographs use, with one difference: confirming the upload enqueues a transcode in the same transaction, and the asset is not ready until the worker has produced its renditions. The renditions and the poster are derived assets pointing at the original, exactly as an image crop is, so the library, the sweep, deduplication and "where is this used" already know how to treat them.

## Technical decisions

- **D1 — `MediaAssetKind` gains `VIDEO`; `MediaAssetState` gains `PROCESSING` and `FAILED`.** An upload is `PENDING` at presign, `PROCESSING` from confirm until the worker finishes, `READY` after, `FAILED` with a stored reason if the file is unreadable or over the limit. `ProductMedia.kind` gains `VIDEO`, with `ref` the original's URL, so a gallery row names the source and the player resolves renditions from it. `VIDEO_EMBED` and `YOUTUBE` stay for links (spec R6).
- **D2 — The presign accepts `video/mp4`, `video/quicktime` and `video/webm` up to the declared size**, in one PUT, and registers the pending row as a `VIDEO`; the confirm records what the store holds, moves the row to `PROCESSING` and enqueues `media.transcode` with the asset id and org, in the transaction that moves the state — a confirm that moves nothing enqueues nothing. Duration cannot be known before the bytes land, so it is the worker's check (spec R2). The confirm response says which state the asset is now in.
- **D3 — The worker transcodes with ffmpeg, one job at a time.** `ffprobe` reads duration and dimensions and fails the asset past the limit — the refused bytes are deleted at once and the reason kept; `ffmpeg` writes 1080p and 720p H.264/AAC MP4 with `faststart`, skipping a rendition larger than the source, and a poster JPEG from the first second. Each output is put to the store beside the source and recorded as a `DERIVED` asset with its rendition, or `poster`, named in `transform`; the original stays `UPLOAD` and becomes `READY` last. A re-run makes only what is not already made, so at-least-once delivery adds nothing. Any other failure marks the asset `FAILED` with the reason and keeps the source bytes for an operator. Transcodes hold an in-process lock of one, because the free machine has the CPU for one encode; other job types are unaffected. ffmpeg enters the worker image as an OS package ([OPERATIONS.md](../../../OPERATIONS.md)), not an npm dependency.
- **D4 — Limits and renditions are declared once**, beside the image ceilings in `server/catalog/media.ts`'s neighbour for video, and read by the presign, the worker and the copy that names them.
- **D5 — Playback is a native `<video>` behind the poster.** The player component takes the source asset and its derivatives, offers 720p on viewports under the desktop breakpoint and 1080p above, lets the viewer switch, and mounts the element only on tap (ADR-0017 decision 3, kept). The poster is the derived poster asset, or a photograph the seller chose instead (spec R8), and is delivered through the optimizer like any image.
- **D6 — Deduplication, retirement and the sweep apply unchanged.** The browser hashes the file before the presign (media-library D11), and a video still processing counts as held — the same clip sent twice in a minute is one video — while a failed one does not, so a retry gets a fresh attempt. A failed video is retired the way a ready one is; a retired video's original and derivatives lose their objects after the grace period through the existing sweep, which already walks derivatives.
- **D7 — The gallery shows the state.** A processing video is a poster-less tile marked as processing; a failed one shows the reason and a remove action; neither can be the cover (product-video R12 holds: the cover is a photograph). The library lists processing and failed videos beside ready assets, so a failure has somewhere to be read. The gallery editor learns a video's state from the saved gallery it was opened with — a row uploaded in the session is processing until the product is saved and reopened. A gallery row links to a video from confirm on, not only once ready, so a product saved during the transcode still names its asset.

## Packages

None in the application. `ffmpeg` and `ffprobe` are installed in the worker image; their version is pinned there.

## UI approach

Phone first. "Upload photos" becomes "Upload photos or a video" in the gallery editor and the library; a video tile carries a duration badge. On the product page the video slide shows the poster with the play control the YouTube embed already uses, and on tap the native player fills the slide with a rendition switch in its corner. Processing and failed states are a badge on the tile, never a modal. Every control through the primitives ([ADR-0031](../../../adr/0031-one-components-home-organised-by-domain.md)).

## Data model

[MIGRATION] `MediaAssetKind` adds `VIDEO`; `MediaAssetState` adds `PROCESSING`, `FAILED`; `MediaAsset` gains `durationMs Int?` and `failureReason String?`; `MediaKind` (on `ProductMedia`) adds `VIDEO`. Additive.

## API / contract changes

[CONTRACT] `ProductMediaDto.kind` gains `VIDEO`, and every item carries `poster`, `durationMs`, `renditions` (key, URL, width, height — largest first) and `state` (`processing` / `ready` / `failed`, null for a photograph or a link). `MediaAssetDto` gains `poster`, `durationMs`, `failureReason`. The upload token accepts the video content types with the video size limit; the confirm response gains `state`. [CONTRACTS.md](../../../CONTRACTS.md) moves in lockstep.

## Test plan

Per [TESTING.md](../../../TESTING.md): unit — limit declarations read by presign and worker are the same constants, rendition selection by viewport, state transitions (confirm → processing, worker → ready or failed with reason), a failed video never becomes a cover; integration — confirm enqueues the transcode in the same transaction and a rollback leaves no job; worker — the handler against a real ffmpeg on a fixture clip produces two renditions and a poster with the declared dimensions, and a 91-second fixture fails with the limit named.

## Delivery (PRs)

1. Schema, limits, presign and confirm for video, the transcode job, ffmpeg in the image; the editor uploads a video, the library and picker tiles show poster and state, the product page shows the poster. Behaviour change: a video uploads and becomes ready; no player yet.
2. The player, poster replacement. Behaviour change: video plays on the product page.

## Open questions

None. The owner confirmed the defaults on 2026-09-27: 90 seconds (Instagram Reels' ceiling; a product clip past it is a different kind of content), 200 MB, 1080p and 720p.
