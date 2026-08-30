/**
 * The two rules about a banner's position, kept pure so they can be tested without a
 * database — the same shape as `server/promotions/targeting.ts`.
 */

/** Where a newly created banner lands: after everything, never at 0. */
export function nextBannerOrder(lastOrder: number | null | undefined): number {
  return (lastOrder ?? -1) + 1;
}

/**
 * A reorder rewrites every row, so the list has to name every banner exactly once.
 * A short list would leave the unnamed rows holding a position that now collides with
 * a named one; a repeated id would put two banners in the same place.
 */
export function isCompleteReorder(ids: string[], total: number): boolean {
  return ids.length === total && new Set(ids).size === ids.length;
}
