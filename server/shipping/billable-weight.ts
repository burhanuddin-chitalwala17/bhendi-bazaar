/**
 * What a parcel is billed as (product-weight-and-rates, decided 2026-08-10): the
 * real weights of its contents are summed, then rounded UP to the next whole
 * kilogram, floor 1 kg — how couriers themselves bill, so a quote never
 * undercharges shipping. Weights are entered in kilograms with gram precision
 * (0.6 = 600 g); the sum is settled to grams before the ceiling so float dust
 * from adding decimals (2.9999999996, 3.0000000004) cannot move a parcel into
 * the wrong slab.
 */
export function billableWeightKg(actualKg: number): number {
  if (!Number.isFinite(actualKg) || actualKg <= 0) return 1;
  const grams = Math.round(actualKg * 1000);
  return Math.max(1, Math.ceil(grams / 1000));
}
