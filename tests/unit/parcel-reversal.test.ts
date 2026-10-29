// A parcel reverses only its own goods (offers-hardening R1, D2). The property that matters: however
// a line is split across parcels, the parts sum to the sale exactly — a paisa lost per split is a
// paisa the org is paid for goods that came back, or charged for goods it kept.
import { describe, expect, it } from "vitest";
import {
  computeParcelReversal,
  proRataHeader,
  reversedQuantity,
  type ReversibleLine,
} from "@server/payouts/commission";
import { applyBps } from "@server/promotions/allocation";

/** Deterministic, so a failure reproduces. */
function rng(seed: number) {
  let s = seed >>> 0;
  return (max: number) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s % (max + 1);
  };
}

function randomLine(rand: (max: number) => number, quantity: number): ReversibleLine {
  const unit = 1 + rand(500_000);
  const gross = unit * quantity;
  const discount = rand(gross);
  const orgFunded = rand(discount);
  const base = gross - orgFunded;
  const rateBps = rand(10_000);
  return {
    orderItemId: "i1",
    quantity,
    orgFundedPaise: orgFunded,
    platformFundedPaise: discount - orgFunded,
    basePaise: base,
    rateBps,
    commissionPaise: applyBps(base, rateBps),
  };
}

function randomSplit(rand: (max: number) => number, total: number): number[] {
  const parts: number[] = [];
  let left = total;
  while (left > 0) {
    const q = 1 + rand(left - 1);
    parts.push(q);
    left -= q;
  }
  return parts;
}

describe("a split line reverses to exactly its sale (spec A2)", () => {
  it("for random quantities, splits and figures, the parts sum to the whole and never go negative", () => {
    const rand = rng(20261030);
    for (let run = 0; run < 2_000; run++) {
      const Q = 1 + rand(19);
      const line = randomLine(rand, Q);
      const gross = line.basePaise + line.orgFundedPaise;
      const sum = { gross: 0, org: 0, platform: 0, base: 0, commission: 0, payable: 0, qty: 0 };

      let from = 0;
      for (const q of randomSplit(rand, Q)) {
        const r = computeParcelReversal([{ line, reversedQuantity: from, parcelQuantity: q }]);
        expect(r).not.toBeNull();
        for (const part of [
          r!.grossItemsPaise, r!.orgFundedDiscountPaise, r!.platformFundedDiscountPaise,
          r!.commissionBasePaise, r!.commissionPaise,
        ]) expect(part).toBeGreaterThanOrEqual(0);
        expect(r!.commissionBasePaise).toBe(r!.grossItemsPaise - r!.orgFundedDiscountPaise);
        expect(r!.payablePaise).toBe(r!.commissionBasePaise - r!.commissionPaise);

        sum.gross += r!.grossItemsPaise;
        sum.org += r!.orgFundedDiscountPaise;
        sum.platform += r!.platformFundedDiscountPaise;
        sum.base += r!.commissionBasePaise;
        sum.commission += r!.commissionPaise;
        sum.payable += r!.payablePaise;
        sum.qty += r!.lines[0].quantity;
        expect(sum.gross).toBeLessThanOrEqual(gross);
        expect(sum.commission).toBeLessThanOrEqual(line.commissionPaise);
        from += q;
      }

      expect(sum).toEqual({
        gross,
        org: line.orgFundedPaise,
        platform: line.platformFundedPaise,
        base: line.basePaise,
        commission: line.commissionPaise,
        payable: line.basePaise - line.commissionPaise,
        qty: Q,
      });
    }
  });

  it("clamps a parcel that would reverse more than was sold, and reverses nothing past it", () => {
    const line = randomLine(rng(7), 5);
    const first = computeParcelReversal([{ line, reversedQuantity: 3, parcelQuantity: 4 }]);
    expect(first!.lines[0].quantity).toBe(2);
    expect(computeParcelReversal([{ line, reversedQuantity: 5, parcelQuantity: 1 }])).toBeNull();
  });

  it("keeps the line's rate as sold", () => {
    const line = randomLine(rng(11), 4);
    const r = computeParcelReversal([{ line, reversedQuantity: 0, parcelQuantity: 1 }]);
    expect(r!.lines[0].rateBps).toBe(line.rateBps);
  });
});

describe("an order-wide reversal written before parcels counts as the whole line (Q6)", () => {
  it("a legacy line with no quantity leaves nothing for a parcel to reverse", () => {
    expect(reversedQuantity(5, [null])).toBe(5);
    const line = randomLine(rng(3), 5);
    const r = computeParcelReversal([
      { line, reversedQuantity: reversedQuantity(5, [null]), parcelQuantity: 2 },
    ]);
    expect(r).toBeNull();
  });

  it("sums parcel quantities, and never past the line", () => {
    expect(reversedQuantity(5, [])).toBe(0);
    expect(reversedQuantity(5, [2, 1])).toBe(3);
    expect(reversedQuantity(5, [4, 4])).toBe(5);
  });
});

describe("a manually edited sale reverses its edited header, pro rata (Q12)", () => {
  it("over any split of two lines, the parts sum to the edited header exactly", () => {
    const rand = rng(1212);
    for (let run = 0; run < 1_000; run++) {
      const lines = [randomLine(rand, 1 + rand(9)), { ...randomLine(rand, 1 + rand(9)), orderItemId: "i2" }];
      const gross = rand(1_000_000);
      const orgFunded = rand(gross);
      const header = {
        grossItemsPaise: gross, orgFundedDiscountPaise: orgFunded,
        platformFundedDiscountPaise: rand(10_000), commissionBasePaise: gross - orgFunded,
        commissionPaise: rand(100_000), payablePaise: rand(1_000_000) - 50_000,
      };
      const sum = { ...header };
      for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] = 0;

      // Parcels, each taking some units of each line, until both are fully returned.
      const done = [0, 0];
      while (done[0] < lines[0].quantity || done[1] < lines[1].quantity) {
        const spans = lines.map((line, i) => {
          const from = done[i];
          const to = Math.min(line.quantity, from + rand(line.quantity - from));
          return { line, from, to };
        });
        // Always move: the generator's low bits cycle, and a parcel that takes nothing is no parcel.
        const open = spans.find((sp) => sp.to < sp.line.quantity);
        if (spans.every((sp, i) => sp.to === done[i]) && open) open.to += 1;
        const part = proRataHeader(header, spans);
        expect(part.commissionBasePaise).toBe(part.grossItemsPaise - part.orgFundedDiscountPaise);
        for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += part[k];
        spans.forEach((s, i) => (done[i] = s.to));
      }
      expect(sum).toEqual(header);
    }
  });
});
