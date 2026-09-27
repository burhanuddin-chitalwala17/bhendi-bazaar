/**
 * What a hosted video is allowed to be, declared once (video-hosting trd D4, ADR-0039): the
 * presign reads the size and the content types, the worker reads the duration and the renditions,
 * and the copy that names a limit reads it from here.
 */
export const VIDEO_LIMITS = {
  /** Instagram Reels' ceiling; a product clip past it is a different kind of content (spec R2). */
  maxDurationMs: 90_000,
  maxUploadBytes: 200 * 1024 * 1024,
} as const;

export const VIDEO_CONTENT_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];

export interface VideoRendition {
  key: string;
  /** Output height; width follows the source's aspect, rounded to an even number for H.264. */
  height: number;
  videoKbps: number;
}

/** Largest first. A rendition taller than the source is skipped, but the smallest is always made. */
export const VIDEO_RENDITIONS: readonly VideoRendition[] = [
  { key: "1080p", height: 1080, videoKbps: 4500 },
  { key: "720p", height: 720, videoKbps: 2200 },
];

/** Where the poster frame is taken: past the first frame, which is often black or a hand. */
export const VIDEO_POSTER_AT_MS = 1000;

export const VIDEO_TRANSFORM = { RENDITION: "rendition", POSTER: "poster" } as const;

export function describeDurationLimit(): string {
  return `at most ${Math.round(VIDEO_LIMITS.maxDurationMs / 1000)} seconds`;
}

export function describeSizeLimit(): string {
  return `at most ${Math.round(VIDEO_LIMITS.maxUploadBytes / (1024 * 1024))} MB`;
}
