/**
 * Phase derivation and bid arithmetic.
 *
 * These are pinned hard because the whole feature rests on them: the stored status
 * records only what the clock cannot decide, so if this derivation is wrong there is no
 * second source of truth to fall back on — no job wrote a status anyone could check
 * against (bidding D3).
 *
 * The boundary cases are the point. A bid at exactly `endAt` must be refused, and it
 * must be refused for the same reason the database refuses it, or the page and the
 * server disagree about whether an auction is still running.
 */
import { describe, expect, it } from "vitest";
import {
  allowedBidRangePaise,
  biddingPhase,
  isAcceptingBids,
  minimumIncreasePaise,
  offerableQuickBidsPaise,
  suspendsPurchase,
} from "@server/bidding/bidding-window";

const START = new Date("2026-09-10T10:00:00.000Z");
const END = new Date("2026-09-12T10:00:00.000Z");
const OPEN = { status: "OPEN" as const, startAt: START, endAt: END };

describe("biddingPhase", () => {
  it("is SCHEDULED before the window opens", () => {
    expect(biddingPhase(OPEN, new Date("2026-09-10T09:59:59.999Z"))).toBe("SCHEDULED");
  });

  it("is LIVE at exactly the opening instant", () => {
    // `startAt <= now` in the accept guard, so the first tick of the window is biddable.
    expect(biddingPhase(OPEN, START)).toBe("LIVE");
  });

  it("is LIVE inside the window", () => {
    expect(biddingPhase(OPEN, new Date("2026-09-11T00:00:00.000Z"))).toBe("LIVE");
  });

  it("is ENDED at exactly the closing instant", () => {
    // The guard requires `endAt > now`, so `now === endAt` is over. Spec R26 depends on
    // this agreeing with the database rather than being a second opinion.
    expect(biddingPhase(OPEN, END)).toBe("ENDED");
  });

  it("is ENDED after the window", () => {
    expect(biddingPhase(OPEN, new Date("2026-09-13T00:00:00.000Z"))).toBe("ENDED");
  });

  it("lets a recorded outcome override the clock entirely", () => {
    const midWindow = new Date("2026-09-11T00:00:00.000Z");
    expect(biddingPhase({ ...OPEN, status: "SOLD" }, midWindow)).toBe("SOLD");
    expect(biddingPhase({ ...OPEN, status: "UNSOLD" }, midWindow)).toBe("UNSOLD");
    expect(biddingPhase({ ...OPEN, status: "CANCELLED" }, midWindow)).toBe("CANCELLED");
  });

  it("accepts bids only while LIVE", () => {
    expect(isAcceptingBids(OPEN, START)).toBe(true);
    expect(isAcceptingBids(OPEN, END)).toBe(false);
    expect(isAcceptingBids({ ...OPEN, status: "CANCELLED" }, START)).toBe(false);
  });
});

describe("suspendsPurchase", () => {
  const during = new Date("2026-09-11T00:00:00.000Z");
  const after = new Date("2026-09-13T00:00:00.000Z");

  it("holds the product while the event is running, bids or not", () => {
    expect(suspendsPurchase({ ...OPEN, bidCount: 0 }, during)).toBe(true);
    expect(suspendsPurchase({ ...OPEN, bidCount: 3 }, during)).toBe(true);
  });

  it("releases an expired event that drew no bids, with nothing to clean up", () => {
    // This is why spec R33 needs no scheduled job: the product frees itself.
    expect(suspendsPurchase({ ...OPEN, bidCount: 0 }, after)).toBe(false);
  });

  it("keeps holding an expired event that drew bids, until an outcome is recorded", () => {
    expect(suspendsPurchase({ ...OPEN, bidCount: 1 }, after)).toBe(true);
  });

  it("releases the product once any outcome is recorded", () => {
    for (const status of ["SOLD", "UNSOLD", "CANCELLED"] as const) {
      expect(suspendsPurchase({ ...OPEN, status, bidCount: 5 }, during)).toBe(false);
    }
  });
});

describe("bid arithmetic", () => {
  const ladder = {
    startingBidPaise: 200_000,
    maxIncreasePaise: 100_000,
    quickBidsPaise: [5_000, 10_000],
    highestBidPaise: null as number | null,
  };

  it("takes the smallest quick-bid amount as the minimum increase", () => {
    expect(minimumIncreasePaise({ quickBidsPaise: [10_000, 5_000] })).toBe(5_000);
  });

  it("admits exactly the starting bid when nothing has been bid", () => {
    // Spec R13/R14: with no current high there is no increase to make.
    expect(allowedBidRangePaise(ladder)).toEqual({ min: 200_000, max: 200_000 });
  });

  it("bounds a later bid by the smallest button and the org's cap", () => {
    const range = allowedBidRangePaise({ ...ladder, highestBidPaise: 250_000 });
    expect(range).toEqual({ min: 255_000, max: 350_000 });
  });

  it("offers no quick buttons on the opening bid", () => {
    expect(offerableQuickBidsPaise(ladder)).toEqual([]);
  });

  it("offers quick buttons ascending, dropping any that would breach the cap", () => {
    const tight = {
      ...ladder,
      highestBidPaise: 250_000,
      maxIncreasePaise: 6_000,
      quickBidsPaise: [10_000, 5_000],
    };
    expect(offerableQuickBidsPaise(tight)).toEqual([5_000]);
  });

  it("caps a single bid rather than the auction — a bidder can always bid again", () => {
    // The cap that stops one bad-faith bid freezing an item is per bid, not per event:
    // two ₹1,000 raises get to the same place as one ₹2,000 raise (spec R6).
    const first = allowedBidRangePaise({ ...ladder, highestBidPaise: 200_000 });
    const second = allowedBidRangePaise({ ...ladder, highestBidPaise: first.max });
    expect(second.max).toBe(400_000);
  });
});
