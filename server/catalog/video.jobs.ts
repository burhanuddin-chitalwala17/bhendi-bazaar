import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { MediaAssetKind, MediaAssetSource, MediaAssetState } from "@prisma/client";
import { registerJob } from "@server/shared/jobs/jobs.registry";
import { videoTranscodeSpec } from "@server/catalog/video.job";
import { DomainError } from "@server/shared/domain-error";
import { sha256Hex } from "@server/shared/hash";
import { mediaAssetRepository } from "@server/catalog/media-asset.repository";
import { deleteObject, getObject, publicUrlFor, putObject } from "@server/catalog/object-store";
import { VIDEO_TRANSFORM } from "@server/catalog/video";
import {
  assertWithinLimits,
  probeVideo,
  transcodeVideo,
  withTranscodeLock,
  type TranscodedFile,
} from "@server/catalog/video-transcode";
import { OUTBOUND_TIMEOUT_MS } from "@server/shared/deadline";


/** A derived asset's `transform`, as this job writes it: which rendition, or the poster. */
type VideoTransform = { kind: typeof VIDEO_TRANSFORM.RENDITION; key: string } | { kind: typeof VIDEO_TRANSFORM.POSTER };

function transformOf(value: unknown): VideoTransform | null {
  if (!value || typeof value !== "object" || !("kind" in value)) return null;
  const { kind } = value as { kind?: unknown; key?: unknown };
  if (kind === VIDEO_TRANSFORM.POSTER) return { kind };
  if (kind === VIDEO_TRANSFORM.RENDITION && "key" in value && typeof value.key === "string") {
    return { kind, key: value.key };
  }
  return null;
}

/** One string per distinct output, so "already made" is a set lookup. */
const outputKey = (transform: VideoTransform) =>
  transform.kind === VIDEO_TRANSFORM.RENDITION ? `${transform.kind}:${transform.key}` : transform.kind;

/**
 * Make one uploaded video playable (video-hosting trd D3, ADR-0039 D2): probe it, refuse it past
 * a limit, transcode it into the declared renditions plus a poster, store each as a DERIVED asset
 * pointing at the source, then mark the source READY with what the probe read.
 *
 * Idempotent on the asset, not the job (ADR-0038 D4): delivery is at least once, so a source that
 * is no longer PROCESSING is left alone, and a rendition that already exists for this source is
 * not made twice. Exported so the handler can be run without the lock in tests.
 */
export async function transcodeAsset(assetId: string, jobId: string): Promise<void> {
  const asset = await mediaAssetRepository.findById(assetId);
  if (!asset || asset.kind !== MediaAssetKind.VIDEO || asset.state !== MediaAssetState.PROCESSING || !asset.objectKey) {
    console.log(`[jobs] media.transcode ${jobId}: ${assetId} is not a video awaiting processing; nothing to do`);
    return;
  }
  const { objectKey } = asset;

  const dir = await mkdtemp(join(tmpdir(), "bb-transcode-"));
  try {
    const sourcePath = join(dir, `source${extname(objectKey) || ".bin"}`);
    // A source can be 200 MB (VIDEO_LIMITS); an image's 60 s would fail it the same way every retry.
    await writeFile(sourcePath, await getObject(objectKey, { timeoutMs: OUTBOUND_TIMEOUT_MS.bulk }));

    let probe;
    try {
      probe = await probeVideo(sourcePath);
      assertWithinLimits(probe);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      // Refused, not broken (spec R2, R7): the bytes go now rather than after the grace period,
      // because nothing may ever play them, and the record keeps the reason for the org member.
      await deleteObject(publicUrlFor(objectKey));
      await mediaAssetRepository.failProcessing(asset.id, error.message, { dropObject: true });
      console.log(`[jobs] media.transcode ${jobId}: ${assetId} refused — ${error.message}`);
      return;
    }

    const result = await transcodeVideo(sourcePath, dir, probe);
    const made = new Set(
      (await mediaAssetRepository.findDerivatives(asset.id))
        .map((row) => transformOf(row.transform))
        .filter((transform): transform is VideoTransform => transform !== null)
        .map(outputKey),
    );
    const base = objectKey.replace(/\.[^./]+$/, "");

    const store = async (file: TranscodedFile, pathname: string, kind: MediaAssetKind, transform: VideoTransform) => {
      if (made.has(outputKey(transform))) return;
      const bytes = await readFile(file.path);
      const ref = await putObject(pathname, bytes, file.mimeType);
      await mediaAssetRepository.createReady({
        kind,
        source: MediaAssetSource.DERIVED,
        derivedFromId: asset.id,
        transform,
        orgId: asset.orgId,
        uploaderId: asset.uploaderId,
        ref,
        objectKey: pathname,
        mimeType: file.mimeType,
        bytes: bytes.byteLength,
        width: file.width,
        height: file.height,
        durationMs: kind === MediaAssetKind.VIDEO ? probe.durationMs : null,
        contentHash: sha256Hex(bytes),
      });
    };

    for (const rendition of result.renditions) {
      await store(rendition, `${base}-${rendition.key}.mp4`, MediaAssetKind.VIDEO, {
        kind: VIDEO_TRANSFORM.RENDITION,
        key: rendition.key,
      });
    }
    await store(result.poster, `${base}-poster.jpg`, MediaAssetKind.IMAGE, { kind: VIDEO_TRANSFORM.POSTER });

    await mediaAssetRepository.finishProcessing(asset.id, {
      width: probe.width,
      height: probe.height,
      durationMs: probe.durationMs,
    });
    console.log(
      `[jobs] media.transcode ${jobId}: ${assetId} ready — ${result.renditions.map((r) => r.key).join(", ")} + poster`,
    );
  } catch (error) {
    // Anything else — the store refusing a GET or PUT, ffmpeg crashing — may be transient, so it
    // is the queue's to retry and, when spent, to park for an operator (worker-foundation R3).
    // The source stays PROCESSING with its bytes; nothing is written on the asset it might not
    // deserve. A refusal (above) is the only failure that is the org member's to read.
    console.error(`[jobs] media.transcode ${jobId}: ${assetId} failed, will retry`, error);
    throw error;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * The transcode, as the queue runs it (video-hosting trd D2, D3). Grouped by org so one org's
 * batch of clips does not starve another's, and serialised on the worker by the transcode lock,
 * because the free machine has the CPU for one encode.
 */
export const videoTranscodeJob = registerJob({
  ...videoTranscodeSpec,
  handler: ({ jobId, payload }) => withTranscodeLock(() => transcodeAsset(payload.assetId, jobId)),
});
