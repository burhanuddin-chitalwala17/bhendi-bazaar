/**
 * How long an event may run: at most MAX_BIDDING_DAYS from when it opens.
 *
 * The cap lives in the schema, which is both what the form validates against and what
 * the create route parses (Invariant 4) — so these tests also stand for the picker,
 * whose `max` is computed from the same exported constant rather than its own literal.
 */
import { describe, expect, it } from "vitest";
import {
  biddingFormSchema,
  MAX_BIDDING_DAYS,
} from "@/lib/validation/schemas/bidding.schema";

const DAY_MS = 24 * 60 * 60 * 1000;

const opensAt = () => new Date(Date.now() + 60 * 60 * 1000);

const event = (startAt: Date, endAt: Date) => ({
  productId: "prod-1",
  startAt,
  endAt,
  startingBid: 500,
  maxIncrease: 1000,
  quickBids: [50, 100],
});

const endAtIssues = (startAt: Date, endAt: Date) => {
  const result = biddingFormSchema.safeParse(event(startAt, endAt));
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path[0] === "endAt")
    .map((issue) => issue.message);
};

describe(`a bidding window is capped at ${MAX_BIDDING_DAYS} days`, () => {
  it("accepts a window exactly at the cap", () => {
    const start = opensAt();
    const end = new Date(start.getTime() + MAX_BIDDING_DAYS * DAY_MS);
    expect(endAtIssues(start, end)).toEqual([]);
  });

  it("rejects a window one minute past the cap", () => {
    const start = opensAt();
    const end = new Date(start.getTime() + MAX_BIDDING_DAYS * DAY_MS + 60 * 1000);
    expect(endAtIssues(start, end)).toContain(
      `Bidding can run for at most ${MAX_BIDDING_DAYS} days from when it opens`
    );
  });

  it("measures from the start, not from now — a later start still gets its full run", () => {
    const start = new Date(Date.now() + 30 * DAY_MS);
    const end = new Date(start.getTime() + MAX_BIDDING_DAYS * DAY_MS);
    expect(endAtIssues(start, end)).toEqual([]);
  });

  it("still accepts the ordinary short window", () => {
    const start = opensAt();
    expect(endAtIssues(start, new Date(start.getTime() + 3 * DAY_MS))).toEqual([]);
  });

  it("reports the cap against endAt, which is the field the picker bounds", () => {
    const start = opensAt();
    const result = biddingFormSchema.safeParse(
      event(start, new Date(start.getTime() + 60 * DAY_MS))
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "endAt")).toBe(true);
    }
  });

  it("leaves the existing order and past-date rules alone", () => {
    const start = opensAt();
    expect(endAtIssues(start, new Date(start.getTime() - DAY_MS))).toContain(
      "Bidding must end after it starts"
    );
  });
});
