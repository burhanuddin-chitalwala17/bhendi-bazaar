/**
 * Who is offered the item next, and when an offer stops counting (winner-offer D1, D2).
 *
 * The chain moves money between people who never see each other, so the rules are pinned
 * here rather than trusted to the sweep: one step per person, each at their own highest bid,
 * a person with no email recorded as skipped, and an offer over at exactly its deadline.
 */
import { describe, expect, it } from "vitest";
import {
  bidderKey,
  isActionable,
  nextStep,
  offerExpiry,
  type ChainBid,
} from "@server/bidding/offer-chain";
import { hashOfferToken, mintOfferToken, OFFER_TOKEN_PATTERN } from "@server/bidding/offer-token";

const bid = (id: string, amountPaise: number, who: Partial<ChainBid>): ChainBid => ({
  id,
  amountPaise,
  userId: null,
  guestPhone: null,
  email: null,
  ...who,
});

const asha = { userId: "u-asha", email: "asha@example.com" };
const guestRavi = { guestPhone: "+91 98765 43210", email: "ravi@example.com" };
const guestNoEmail = { guestPhone: "9000000000", email: null };

describe("nextStep", () => {
  it("offers the highest bid first", () => {
    const ladder = [bid("b1", 100_000, asha), bid("b2", 120_000, guestRavi)];
    expect(nextStep(ladder, [])).toEqual({ kind: "offer", bid: ladder[1] });
  });

  it("offers each person once, at their own highest bid", () => {
    const ladder = [
      bid("a3", 150_000, asha),
      bid("r2", 140_000, guestRavi),
      bid("a2", 130_000, asha),
      bid("r1", 110_000, guestRavi),
    ];
    const first = nextStep(ladder, []);
    expect(first).toEqual({ kind: "offer", bid: ladder[0] });

    const second = nextStep(ladder, [ladder[0]]);
    // Ravi, at 1,40,000 — never Asha's lower bid, and never the winning figure.
    expect(second).toEqual({ kind: "offer", bid: ladder[1] });

    expect(nextStep(ladder, [ladder[0], ladder[1]])).toEqual({ kind: "exhausted" });
  });

  it("skips a person with no email rather than passing over them silently", () => {
    const ladder = [bid("g1", 200_000, guestNoEmail), bid("a1", 100_000, asha)];
    expect(nextStep(ladder, [])).toEqual({ kind: "skip", bid: ladder[0] });
    expect(nextStep(ladder, [ladder[0]])).toEqual({ kind: "offer", bid: ladder[1] });
  });

  it("treats a guest's bids as one person by phone, however the number was typed", () => {
    const ladder = [
      bid("r2", 140_000, { guestPhone: "+91-98765-43210", email: null }),
      bid("r1", 120_000, guestRavi),
    ];
    // Their highest bid carried no email: the person is skipped, not re-offered at the lower bid.
    expect(nextStep(ladder, [])).toEqual({ kind: "skip", bid: ladder[0] });
    expect(nextStep(ladder, [ladder[0]])).toEqual({ kind: "exhausted" });
  });

  it("is exhausted on an empty ladder", () => {
    expect(nextStep([], [])).toEqual({ kind: "exhausted" });
  });
});

describe("bidderKey", () => {
  it("never confuses an account with a guest", () => {
    expect(bidderKey({ userId: "9000000000", guestPhone: null })).not.toBe(
      bidderKey({ userId: null, guestPhone: "9000000000" })
    );
  });
});

describe("isActionable", () => {
  const expiresAt = new Date("2026-09-29T00:00:00.000Z");

  it("is open until its deadline and closed at exactly it", () => {
    expect(isActionable({ status: "OFFERED", expiresAt }, new Date(expiresAt.getTime() - 1))).toBe(true);
    expect(isActionable({ status: "ACCEPTED", expiresAt }, new Date(expiresAt.getTime() - 1))).toBe(true);
    expect(isActionable({ status: "OFFERED", expiresAt }, expiresAt)).toBe(false);
  });

  it("is closed in every other status, whatever the clock says", () => {
    const early = new Date(expiresAt.getTime() - 3_600_000);
    for (const status of ["DECLINED", "LAPSED", "SKIPPED", "WITHDRAWN", "PAID"] as const) {
      expect(isActionable({ status, expiresAt }, early)).toBe(false);
    }
    expect(isActionable({ status: "OFFERED", expiresAt: null }, early)).toBe(false);
  });
});

describe("offerExpiry", () => {
  it("is the claim window from now", () => {
    const now = new Date("2026-09-28T06:00:00.000Z");
    expect(offerExpiry(now, 12).toISOString()).toBe("2026-09-28T18:00:00.000Z");
  });
});

describe("offer token", () => {
  it("is URL-safe, fresh each time, and stored only as a hash", () => {
    const a = mintOfferToken();
    const b = mintOfferToken();
    expect(a).toMatch(OFFER_TOKEN_PATTERN);
    expect(a).not.toBe(b);
    expect(hashOfferToken(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOfferToken(a)).not.toContain(a);
    expect(hashOfferToken(a)).toBe(hashOfferToken(a));
  });
});
