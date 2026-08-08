// The billing rule for a parcel's weight (product-weight-and-rates, decided
// 2026-08-10): sum real weights, round UP to whole kilograms, floor 1 kg. The
// gram-settling step is what makes float sums safe — without it, adding decimals
// can land 0.0000000004 above a slab boundary and bill an extra kilogram.
import { describe, expect, it } from "vitest";
import { billableWeightKg } from "@server/shipping/billable-weight";

describe("billableWeightKg", () => {
  it("rounds up to the next whole kilogram", () => {
    expect(billableWeightKg(0.6)).toBe(1);
    expect(billableWeightKg(1.1)).toBe(2);
    expect(billableWeightKg(1.4)).toBe(2);
    expect(billableWeightKg(2.4)).toBe(3);
  });

  it("an exact whole number stays itself", () => {
    expect(billableWeightKg(2)).toBe(2);
  });

  it("floors at 1 kg — a featherweight parcel is still a parcel", () => {
    expect(billableWeightKg(0.05)).toBe(1);
    expect(billableWeightKg(0)).toBe(1);
    expect(billableWeightKg(NaN)).toBe(1);
  });

  it("float dust from summing decimals cannot move a parcel into the wrong slab", () => {
    // 0.1 + 0.2 style residue, on both sides of a boundary
    expect(billableWeightKg(2.9999999996)).toBe(3);
    expect(billableWeightKg(3.0000000004)).toBe(3);
  });

  it("gram precision is honoured: 3.001 kg is genuinely over the line", () => {
    expect(billableWeightKg(3.001)).toBe(4);
  });
});
