# Spec — video-hosting

- **Summary:** A seller uploads a short video from the phone as they would a photograph; the platform stores it, makes it playable everywhere, and treats it as an image is treated
- **Status:** Draft — defaults (length, size, renditions) pending the owner
- **Domain:** catalog (assets), content (renditions)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-09-27
- **References:** [../spec.md](../spec.md) (media-library), [trd.md](trd.md), [ADR-0039](../../../adr/0039-video-is-stored-in-our-object-store-and-transcoded-by-the-worker.md), [ADR-0017](../../../adr/0017-video-is-embedded-not-hosted.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

A product video shot on a phone goes into the library like a photograph and plays on the product page, in the library and, later, on Instagram and the marketplaces, without the seller owning a YouTube channel or the buyer loading anyone else's player. The platform keeps the original, makes the sizes that play well on a phone and on a wide screen, and picks a frame to stand in for the video until it is played.

## Why

The sellers this store is built for have a phone and a product, not a channel. A YouTube link asks them to make an account, upload somewhere else, wait, and paste a link — and hands the video to terms and a player that are not ours. Instagram publishing, two specs on, needs a file we hold. The worker was pulled forward so that this kind of work had somewhere to run ([ADR-0039](../../../adr/0039-video-is-stored-in-our-object-store-and-transcoded-by-the-worker.md)).

## Requirements

- **R1** — A seller adds a video to a gallery, or to the library, by choosing a file on the phone or desktop, exactly as a photograph is added. No account anywhere else is needed.
- **R2** — A video is at most ninety seconds and two hundred megabytes as uploaded. A longer or larger file is refused with the limit named, before upload where the limit can be known and after it where it cannot.
- **R3** — While the platform is making the video playable, the seller sees that it is being processed, and the product page shows the poster with no play control. Processing never blocks saving the product.
- **R4** — Once ready, the video plays inline on the product page, click to play against its poster, in a size suited to the screen, and can be watched in full screen. No third-party script is loaded to play it.
- **R5** — A video is an image's peer in the library: it has an owner, a record of where it is used, dimensions and duration, a hash so the same file is one video within an organisation, and it is retired rather than deleted with its files removed only after the grace period.
- **R6** — A YouTube link continues to work as it does today, as an embedded reference. Nothing a seller pasted before this ships changes.
- **R7** — A video that cannot be processed — a file no decoder reads, a clip over the limit — is reported to the seller in the library and the gallery with the reason, and takes up no place in a slot.
- **R8** — The frame chosen as the poster can be replaced by the seller with any photograph in the library.
- **R9** — Everything here works on a ~360px phone, upload included, and every file passes through the one image seam ([ADR-0028](../../../adr/0028-images-live-in-cloudflare-r2.md)).

## Product acceptance

- **A1** — A seller picks a 45-second clip on the phone; the gallery shows it processing, then playing, within three minutes, and the product was saveable throughout.
- **A2** — A 3-minute clip is refused with "at most 90 seconds" after upload; a 300 MB file is refused before upload with "at most 200 MB".
- **A3** — On a phone the 720p rendition plays; on a laptop the 1080p one does; both show the same poster first and neither loads a script from another host.
- **A4** — The library shows the video with its duration and uses; uploading the same file again adds nothing; retiring it is refused while a product carries it.
- **A5** — A product with a YouTube link from before this feature renders exactly as before.
- **A6** — The original file is byte-identical to what was uploaded, and is never the file a buyer's browser downloads.

## Out of scope (this feature)

- Publishing the video anywhere — [instagram-publish](../../instagram-publish/), [channel-files](../../channel-files/); this feature gives them a file.
- Trimming, captions, or any editing of the video. The seller trims on the phone.
- Adaptive streaming (HLS). Two renditions split phone from wide screen; more is a decision for when buffering is observed ([ADR-0039](../../../adr/0039-video-is-stored-in-our-object-store-and-transcoded-by-the-worker.md)).
- Video in reviews, category heroes or banners. Each is its own surface and inherits this asset when it wants one.
