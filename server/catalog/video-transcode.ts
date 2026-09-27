import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { stat } from "node:fs/promises";
import { DomainError } from "@server/shared/domain-error";
import {
  VIDEO_LIMITS,
  VIDEO_POSTER_AT_MS,
  VIDEO_RENDITIONS,
  describeDurationLimit,
  type VideoRendition,
} from "@server/catalog/video";

const run = promisify(execFile);

/** The binaries come from the machine, not npm (video-hosting trd D3); a deployment may point elsewhere. */
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";

export interface VideoProbe {
  durationMs: number;
  width: number;
  height: number;
}

/** Whether the machine can transcode at all — the test suite skips where it cannot. */
export async function hasTranscoder(): Promise<boolean> {
  try {
    await run(FFMPEG, ["-version"]);
    await run(FFPROBE, ["-version"]);
    return true;
  } catch {
    return false;
  }
}

export async function probeVideo(path: string): Promise<VideoProbe> {
  const { stdout } = await run(FFPROBE, [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration",
    "-of", "json",
    path,
  ]);
  const parsed = JSON.parse(stdout) as { streams?: Array<{ width?: number; height?: number }>; format?: { duration?: string } };
  const stream = parsed.streams?.[0];
  const seconds = Number(parsed.format?.duration);
  if (!stream?.width || !stream.height || !Number.isFinite(seconds)) {
    throw new DomainError("This file has no video we can read");
  }
  return { durationMs: Math.round(seconds * 1000), width: stream.width, height: stream.height };
}

/** The worker's check: a clip past the limit is refused with the limit named (spec R2, R7). */
export function assertWithinLimits(probe: VideoProbe): void {
  if (probe.durationMs > VIDEO_LIMITS.maxDurationMs) {
    throw new DomainError(`This video is ${Math.round(probe.durationMs / 1000)} seconds long; a product video is ${describeDurationLimit()}`);
  }
}

/** The renditions a source gets: none taller than it, and always the smallest (video.ts). */
export function renditionsFor(sourceHeight: number, all: readonly VideoRendition[] = VIDEO_RENDITIONS): VideoRendition[] {
  const fitting = all.filter((rendition) => rendition.height <= sourceHeight);
  if (fitting.length > 0) return fitting;
  const smallest = [...all].sort((a, b) => a.height - b.height)[0];
  return smallest ? [smallest] : [];
}

export interface TranscodedFile {
  key: string;
  path: string;
  width: number;
  height: number;
  bytes: number;
  mimeType: string;
}

export interface TranscodeResult {
  renditions: TranscodedFile[];
  poster: TranscodedFile;
}

/**
 * H.264/AAC MP4 with the index up front, one file per rendition, plus a JPEG poster
 * (video-hosting trd D3). Width follows the source's aspect; `-2` keeps it even for the encoder.
 */
export async function transcodeVideo(sourcePath: string, outDir: string, probe: VideoProbe): Promise<TranscodeResult> {
  const renditions: TranscodedFile[] = [];
  for (const rendition of renditionsFor(probe.height)) {
    const path = join(outDir, `${rendition.key}.mp4`);
    await run(FFMPEG, [
      "-y", "-v", "error",
      "-i", sourcePath,
      "-vf", `scale=-2:${rendition.height}`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-maxrate", `${rendition.videoKbps}k`, "-bufsize", `${rendition.videoKbps * 2}k`,
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      path,
    ]);
    const made = await probeVideo(path);
    renditions.push({ key: rendition.key, path, width: made.width, height: made.height, bytes: (await stat(path)).size, mimeType: "video/mp4" });
  }

  const posterPath = join(outDir, "poster.jpg");
  const at = Math.min(VIDEO_POSTER_AT_MS, Math.max(0, probe.durationMs - 100)) / 1000;
  await run(FFMPEG, ["-y", "-v", "error", "-ss", String(at), "-i", sourcePath, "-frames:v", "1", "-q:v", "3", posterPath]);
  const posterProbe = await run(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", posterPath]);
  const posterStream = (JSON.parse(posterProbe.stdout) as { streams?: Array<{ width?: number; height?: number }> }).streams?.[0];
  const poster: TranscodedFile = {
    key: "poster",
    path: posterPath,
    width: posterStream?.width ?? probe.width,
    height: posterStream?.height ?? probe.height,
    bytes: (await stat(posterPath)).size,
    mimeType: "image/jpeg",
  };
  return { renditions, poster };
}

let busy: Promise<unknown> = Promise.resolve();

/**
 * One encode at a time on the worker (trd D3): the free machine has the CPU for one, and two at
 * once finish later than one after the other. Other job types are not held by this.
 */
export function withTranscodeLock<T>(work: () => Promise<T>): Promise<T> {
  const next = busy.then(work, work);
  busy = next.catch(() => undefined);
  return next;
}
