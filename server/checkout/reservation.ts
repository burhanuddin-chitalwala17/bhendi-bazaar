/**
 * The reservation plan for an order (Invariant 6, ADR-0007): which products, how
 * many, in what order. Pure, so the merging and ordering rules are unit-testable —
 * the decrement itself is a conditional write whose correctness lives in the
 * database.
 */

/**
 * Total quantity per product across every shipping group, sorted by product id.
 *
 * Merged because the same product can appear in two groups, and two decrements of
 * the same row inside one transaction would make the second guard check a number the
 * first already changed. Sorted because two concurrent orders locking the same rows
 * in different sequence is a deadlock — a deterministic order means they queue
 * instead.
 */
export function aggregateReservation(
  groups: Array<{ items: Array<{ productId: string; quantity: number }> }>
): Array<{ productId: string; quantity: number }> {
  const totals = new Map<string, number>();
  for (const group of groups) {
    for (const { productId, quantity } of group.items) {
      totals.set(productId, (totals.get(productId) ?? 0) + quantity);
    }
  }
  return [...totals.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
}
