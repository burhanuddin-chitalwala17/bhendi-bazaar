/**
 * What to call a banner that has no heading, wherever one has to be named — a list
 * row, a screen-reader label, a delete confirmation. Declared once because it is the
 * same banner in every one of those places and they must not drift apart.
 *
 * Display only. It is never written to the column: an untitled banner is untitled,
 * and a placeholder stored as data would end up laid over the artwork.
 */
export const UNTITLED_BANNER = "Untitled banner";

export function bannerLabel(title: string | null | undefined): string {
  return title?.trim() || UNTITLED_BANNER;
}
