import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs";

export const videoTranscodePayload = z.object({
  assetId: z.string().trim().min(1).max(64),
  /** Null for a platform-owned upload; otherwise the org whose fairness bucket this counts against. */
  orgId: z.string().nullable(),
});
export type VideoTranscodePayload = z.infer<typeof videoTranscodePayload>;

/**
 * The transcode job as the web app enqueues it (video-hosting trd D2): name, payload, group.
 * The handler lives in video.jobs.ts, which only the worker imports, so confirming an upload
 * never loads ffmpeg plumbing into the web process and registers nothing there.
 */
export const videoTranscodeSpec: JobSpec<VideoTranscodePayload> = {
  type: "media.transcode",
  schema: videoTranscodePayload,
  group: (payload) => payload.orgId ?? undefined,
};
