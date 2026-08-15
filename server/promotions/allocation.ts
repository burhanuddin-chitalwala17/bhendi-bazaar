/**
 * Spreading one amount across lines without losing a paise (ADR-0019 decision 2).
 *
 * Proportional-then-round drifts: shares computed independently and rounded
 * independently do not add back up. Under ADR-0004 a total that fails to reconcile is
 * a defect, not a tolerance — and here it would mean an order whose line discounts
 * disagree with the discount the buyer was charged.
 */

/**
 * Largest-remainder apportionment. Returns shares that sum to exactly `total`.
 *
 * Each line gets the floor of its exact share; the paise left over go to the lines
 * with the largest discarded fractions, ties broken by position so the result is
 * deterministic — the same basket must allocate the same way in the preview and in
 * the transaction, or the displayed-total guard fires on a difference nobody made.
 */
export function allocateLargestRemainder(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  if (total === 0) return weights.map(() => 0);

  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum <= 0) return weights.map(() => 0);

  // Integer arithmetic throughout: `total * weight` can be large but stays exact well
  // inside a double's 2^53, since both are paise on one order.
  const shares = weights.map((weight) => Math.floor((total * weight) / weightSum));
  let remainder = total - shares.reduce((sum, s) => sum + s, 0);

  if (remainder > 0) {
    // Rank by the discarded fraction, compared as integers to avoid float ties
    // resolving differently on different inputs.
    const ranked = weights
      .map((weight, index) => ({
        index,
        fraction: total * weight - shares[index] * weightSum,
      }))
      .sort((a, b) => (b.fraction - a.fraction) || (a.index - b.index));

    for (const { index } of ranked) {
      if (remainder === 0) break;
      shares[index] += 1;
      remainder -= 1;
    }
  }

  return shares;
}

/**
 * A percentage of an amount, in integer paise.
 *
 * Rates are basis points so nothing on the money path is a float (ADR-0004), and the
 * result floors — a discount that rounded up would charge less than the offer says.
 */
export function applyBps(amountPaise: number, bps: number): number {
  return Math.floor((amountPaise * bps) / 10_000);
}
