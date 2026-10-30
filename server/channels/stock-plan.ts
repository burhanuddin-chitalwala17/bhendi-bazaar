import type { LocationCount } from "./providers/stock";

/**
 * What a marketplace listing should show (inventory-sync D3), pure: each marketplace location gets
 * the count of the shop's location matched to it (Q3); one marked "not used" gets 0 (Q16); an archived
 * product is 0 everywhere (Q6). An account with a location still unmatched sends nothing (Q16); one
 * matched to a shop location since closed gets 0 until it is matched again, so it never oversells.
 */
export function countsFor(
  locations: ReadonlyArray<{ externalId: string; orgAddressId: string | null; notUsed: boolean; goneAt: Date | null; closed?: boolean }>,
  product: { archived: boolean; stock: ReadonlyArray<{ orgAddressId: string; quantity: number }> },
): LocationCount[] | null {
  const live = locations.filter((l) => l.goneAt === null);
  if (live.length === 0 || live.some((l) => !l.orgAddressId && !l.notUsed)) return null;
  return live.map((l) => ({
    externalId: l.externalId,
    quantity: l.notUsed || l.closed || product.archived ? 0 : Math.max(0, product.stock.find((s) => s.orgAddressId === l.orgAddressId)?.quantity ?? 0),
  }));
}

/**
 * The counts last sent, read defensively; a listing the marketplace stocks itself is `held`, and one
 * whose last send it turned down is `refused` (sent again on the next change).
 */
export function lastSent(value: unknown): { counts: LocationCount[] | null; held: boolean; refused: boolean } {
  const v = value && typeof value === "object" ? (value as { counts?: unknown; heldByMarketplace?: unknown; refused?: unknown }) : {};
  const counts = Array.isArray(v.counts)
    ? v.counts.flatMap((c) => (c && typeof c.externalId === "string" && typeof c.quantity === "number" ? [{ externalId: c.externalId, quantity: c.quantity }] : []))
    : null;
  return { counts, held: v.heldByMarketplace === true, refused: v.refused === true };
}

/** Same counts at the same locations: nothing to send. */
export function sameCounts(a: readonly LocationCount[] | null, b: readonly LocationCount[]): boolean {
  if (!a || a.length !== b.length) return false;
  return b.every((x) => a.some((y) => y.externalId === x.externalId && y.quantity === x.quantity));
}
