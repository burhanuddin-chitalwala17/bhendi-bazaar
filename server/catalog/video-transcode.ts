import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { stat } from "node:fs/promises";
import { DomainError } from "@server/shared/domain-error";
import {
  VIDEO_LIMITS,
  VIDEO_POSTER_AT_MS,
  VIDEO_RENDITION_MIME_TYPE,
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

interface ProbeStream {
  width?: number;
  height?: number;
  /** Newer ffmpeg reports the display matrix here; older files carry a `rotate` tag instead. */
  side_data_list?: Array<{ rotation?: number }>;
  tags?: { rotate?: string };
}

/**
 * Whether the picture is turned a quarter of the way round. A phone films in landscape and writes
 * a display matrix saying "turn this"; the stream's own width and height are the untuned ones, so
 * a portrait clip reads as landscape unless this is asked.
 */
export function isQuarterTurned(stream: { side_data_list?: Array<{ rotation?: number }>; tags?: { rotate?: string } }): boolean {
  const fromMatrix = stream.side_data_list?.find((entry) => typeof entry.rotation === "number")?.rotation;
  const degrees = fromMatrix ?? Number(stream.tags?.rotate ?? 0);
  if (!Number.isFinite(degrees)) return false;
  return Math.abs(((degrees % 360) + 360) % 360 - 90) < 1 || Math.abs(((degrees % 360) + 360) % 360 - 270) < 1;
}

export async function probeVideo(path: string): Promise<VideoProbe> {
  const { stdout } = await run(FFPROBE, [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height:stream_side_data=rotation:stream_tags=rotate:format=duration",
    "-of", "json",
    path,
  ]);
  const parsed = JSON.parse(stdout) as { streams?: ProbeStream[]; format?: { duration?: string } };
  const stream = parsed.streams?.[0];
  const seconds = Number(parsed.format?.duration);
  if (!stream?.width || !stream.height || !Number.isFinite(seconds)) {
    throw new DomainError("This file has no video we can read");
  }
  // Reported as the picture will be shown, which is what every later number is measured against:
  // the renditions that fit, the poster's shape, and what the library says the video is.
  const turned = isQuarterTurned(stream);
  return {
    durationMs: Math.round(seconds * 1000),
    width: turned ? stream.height : stream.width,
    height: turned ? stream.width : stream.height,
  };
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
    renditions.push({ key: rendition.key, path, width: made.width, height: made.height, bytes: (await stat(path)).size, mimeType: VIDEO_RENDITION_MIME_TYPE });
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
