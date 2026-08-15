// Spreading one discount across lines without losing a paise (ADR-0019 decision 2).
// These are the arithmetic guarantees the whole settlement path leans on: if a
// per-line share fails to sum back to the total, an order's lines disagree with what
// the buyer was charged, and every figure downstream inherits the gap.
import { describe, expect, it } from "vitest";
import { allocateLargestRemainder, applyBps } from "@server/promotions/allocation";

describe("allocateLargestRemainder", () => {
  it("sums to exactly the total for a clean division", () => {
    const shares = allocateLargestRemainder(70000, [200000, 150000]);
    expect(shares).toEqual([40000, 30000]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(70000);
  });

  it("sums to exactly the total when the division is awkward", () => {
    const shares = allocateLargestRemainder(100, [1, 1, 1]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    expect(shares).toEqual([34, 33, 33]);
  });

  it("places a single stray paise deterministically", () => {
    const shares = allocateLargestRemainder(1, [1, 1]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1);
    expect(shares).toEqual([1, 0]);
  });

  it("gives the remainder to the largest discarded fractions, not the largest weights", () => {
    // Exact shares are 3.75 and 5.25: the smaller line has the bigger fraction.
    const shares = allocateLargestRemainder(9, [5, 7]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(9);
    expect(shares).toEqual([4, 5]);
  });

  it("never drifts, over many awkward totals and weightings", () => {
    for (let total = 0; total < 400; total += 7) {
      for (const weights of [[3, 5, 11], [1, 1, 1, 1], [999, 1], [17, 17, 17, 17, 17]]) {
        const shares = allocateLargestRemainder(total, weights);
        expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
        expect(shares.every((s) => s >= 0)).toBe(true);
      }
    }
  });

  it("is deterministic — the preview and the transaction must allocate identically", () => {
    const once = allocateLargestRemainder(1237, [419, 733, 91]);
    const again = allocateLargestRemainder(1237, [419, 733, 91]);
    expect(once).toEqual(again);
  });

  it("returns zeros rather than dividing by nothing", () => {
    expect(allocateLargestRemainder(500, [])).toEqual([]);
    expect(allocateLargestRemainder(500, [0, 0])).toEqual([0, 0]);
    expect(allocateLargestRemainder(0, [5, 5])).toEqual([0, 0]);
  });
});

describe("applyBps", () => {
  it("computes a percentage in integer paise", () => {
    expect(applyBps(200000, 2000)).toBe(40000); // 20% of ₹2,000
    expect(applyBps(150000, 1500)).toBe(22500); // 15% of ₹1,500
  });

  it("floors rather than rounding, so a discount never exceeds what the offer says", () => {
    expect(applyBps(999, 2000)).toBe(199); // 199.8 → 199
    expect(applyBps(1, 5000)).toBe(0);
  });

  it("handles the boundaries", () => {
    expect(applyBps(12345, 0)).toBe(0);
    expect(applyBps(12345, 10000)).toBe(12345);
  });
});
