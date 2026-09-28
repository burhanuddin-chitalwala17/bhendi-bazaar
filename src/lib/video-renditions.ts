import type { ProductMediaRendition } from "@server/catalog/media";

/** The rendition each kind of screen starts on (video-hosting D5, spec A3); a switch is the viewer's. */
export const WIDE_RENDITION_KEY = "1080p";
export const NARROW_RENDITION_KEY = "720p";

/**
 * Which file to play first: 1080p on a wide screen, 720p on a phone, and otherwise the largest of
 * whatever the worker made — a source shorter than 1080 has no 1080p, and the smallest is always
 * made. Pure, so the choice can be tested without a viewport; the caller reads the viewport once.
 */
export function pickRendition(renditions: readonly ProductMediaRendition[], wide: boolean): ProductMediaRendition | null {
  if (renditions.length === 0) return null;
  const wanted = wide ? WIDE_RENDITION_KEY : NARROW_RENDITION_KEY;
  const preferred = renditions.find((rendition) => rendition.key === wanted);
  if (preferred) return preferred;
  return [...renditions].sort((a, b) => b.height - a.height)[0];
}
