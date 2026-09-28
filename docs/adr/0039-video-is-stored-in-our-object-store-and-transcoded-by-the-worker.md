# ADR-0039: Video is stored in our own object store and transcoded by the worker

- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** [ADR-0017](0017-video-is-embedded-not-hosted.md) kept video off our storage on two premises: the storage tier metered transfer per account and could withdraw it, and object storage serves one bitrate to a buyer on a weak connection. The first premise died with [ADR-0028](0028-images-live-in-cloudflare-r2.md) — R2 charges nothing for egress. The second was a property of having no compute, and [ADR-0038](0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md) gave the platform an always-on worker whose stated first jobs include exactly this. Meanwhile the sellers this store is built for shoot a product on a phone and have no YouTube channel to put it on, and the Instagram publishing to come needs a video file we hold, not a link to someone else's player. The owner chose to host on the 27th, naming the worker as the reason it was built early.
- **Decision:**
  1. **A video file may be stored in our object store**, through the same asset seam as a photograph: registered before the bytes move, confirmed after, retired never deleted, deduplicated by content within an org.
  2. **Every upload is transcoded by the worker**, never served as uploaded: declared renditions — 1080p and 720p H.264/AAC MP4 with the index up front — and a poster frame, each a derived asset pointing at the original, which is kept as the source and never streamed.
  3. **Playback is a native `<video>` against the poster, click to play, no third-party script.** The player picks the rendition by viewport and can be switched by hand.
  4. **Limits are declared once**, in code, and enforced at the presign (size) and in the worker (duration): the spec names them.
  5. **A YouTube link stays supported as an embed.** ADR-0017's decisions 2 and 3 — a provider-tagged reference, click-to-play — remain for embeds; its decisions 1 and 4 are superseded.
  6. **Every future video surface uses this asset.** A new surface does not re-open the storage question.
- **Alternatives considered:**
  - *Cloudflare Stream or Mux* — the conventional answer and the one ADR-0017 itself named: transcoding, adaptive delivery and a player for a few hundred rupees a month at this scale. Rejected by the owner because the worker exists to do this work, a second video provider is a second bill and a second account for a marketplace that already runs its own store, and per-minute pricing grows with the very success the store wants.
  - *Keep YouTube only* — no build at all. Rejected: resellers have no channel, an unlisted upload still processes and is governed by someone else's terms, and Instagram publishing cannot take a YouTube link.
  - *Store the upload and serve it as-is, one MP4* — the simplest hosting. Rejected: the second premise of ADR-0017 still holds; a phone-shot 4K clip served to a phone on a weak connection buffers, and a phone upload is often a container the browser will not play inline.
  - *HLS adaptive streaming from ffmpeg* — the fuller answer to bitrate. Deferred, not rejected: two MP4s split phone from wide screen, which is the choice that matters here; HLS adds segment packaging and a JavaScript player on most browsers. Revisit if buffering shows on real connections.
- **Consequences:**
  - ✅ A seller uploads a video from the phone exactly as a photograph, and it plays inline on the product page without any third-party script.
  - ✅ Instagram and the marketplaces get a file the platform holds, in the size each asks for, from the same derivation path as images.
  - ✅ Egress is free, and the storage is the only recurring cost: about 60–120 MB per video after transcoding, on ten free gigabytes and then $0.015 per gigabyte-month.
  - ⚠️ The worker does real CPU work for the first time: a 90-second clip is a minute or three of ffmpeg on the free machine, so transcodes run one at a time and every other job waits behind one — the queue makes that visible rather than silent.
  - ⚠️ ffmpeg joins the worker image, which grows by around a hundred megabytes, and a video has a processing state the editor and the gallery must show honestly.
  - ⚠️ A malformed or over-long upload is refused after the bytes have landed, which costs the seller a wait; the presign refuses only what it can know, the size.
