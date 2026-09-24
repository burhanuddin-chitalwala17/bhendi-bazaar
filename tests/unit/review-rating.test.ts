/**
 * What a product's reviews add up to (product-reviews R6, R6a, R10; trd.md D4).
 *
 * Pinned hard for the same reason the bidding phases are: nothing stores these numbers
 * any more, so this function *is* the rating. If it is wrong there is no column to check
 * it against — and the previous arrangement, two columns nothing wrote, is exactly what
 * shipping an unverified rating looks like.
 *
 * R10 is the case that matters. All of a shopper's reviews are shown and counted, but
 * the average counts only their most recent, so writing ten times cannot set a rating.
 */
import { describe, expect, it } from "vitest";

import {
  NO_RATING,
  ratingFor,
  summariseRatings,
  type RatingRow,
} from "@server/catalog/review-rating";

const at = (iso: string) => new Date(iso);

const row = (over: Partial<RatingRow> & { id: string; rating: number }): RatingRow => ({
  productId: "p1",
  userId: "u1",
  createdAt: at("2026-09-01T00:00:00.000Z"),
  ...over,
});

describe("summariseRatings", () => {
  it("has nothing to say about a product with no reviews", () => {
    expect(summariseRatings([]).size).toBe(0);
  });

  it("averages one review per shopper as written", () => {
    const summary = summariseRatings([
      row({ id: "r1", userId: "u1", rating: 5 }),
      row({ id: "r2", userId: "u2", rating: 4 }),
      row({ id: "r3", userId: "u3", rating: 3 }),
    ]);
    const p1 = summary.get("p1")!;
    expect(p1.average).toBe(4);
    expect(p1.count).toBe(3);
  });

  it("counts every review a shopper wrote but averages only their latest (R10)", () => {
    const summary = summariseRatings([
      row({ id: "r1", userId: "u1", rating: 1, createdAt: at("2026-09-01T00:00:00Z") }),
      row({ id: "r2", userId: "u1", rating: 5, createdAt: at("2026-09-05T00:00:00Z") }),
      row({ id: "r3", userId: "u2", rating: 3, createdAt: at("2026-09-02T00:00:00Z") }),
    ]);
    const p1 = summary.get("p1")!;
    // Two voices: u1's latest (5) and u2's only (3).
    expect(p1.average).toBe(4);
    // Three reviews, which is what the list below the summary will show (D4a).
    expect(p1.count).toBe(3);
  });

  it("cannot be moved by repetition", () => {
    const spam = Array.from({ length: 20 }, (_, index) =>
      row({
        id: `spam${index}`,
        userId: "u1",
        rating: 5,
        createdAt: at(`2026-09-${String(index + 1).padStart(2, "0")}T00:00:00Z`),
      }),
    );
    const summary = summariseRatings([
      ...spam,
      row({ id: "honest", userId: "u2", rating: 1 }),
    ]);
    // One voice at 5, one at 1 — twenty reviews on one side change nothing.
    expect(summary.get("p1")!.average).toBe(3);
    expect(summary.get("p1")!.count).toBe(21);
  });

  it("resolves a same-instant tie the same way every time", () => {
    const sameMoment = at("2026-09-05T12:00:00.000Z");
    const rows = [
      row({ id: "a", userId: "u1", rating: 2, createdAt: sameMoment }),
      row({ id: "b", userId: "u1", rating: 4, createdAt: sameMoment }),
    ];
    // Whichever order the database returns them in, the higher id wins.
    expect(summariseRatings(rows).get("p1")!.average).toBe(4);
    expect(summariseRatings([...rows].reverse()).get("p1")!.average).toBe(4);
  });

  it("does not depend on the order rows arrive in", () => {
    const rows = [
      row({ id: "r1", userId: "u1", rating: 1, createdAt: at("2026-09-01T00:00:00Z") }),
      row({ id: "r2", userId: "u1", rating: 5, createdAt: at("2026-09-09T00:00:00Z") }),
      row({ id: "r3", userId: "u2", rating: 2, createdAt: at("2026-09-03T00:00:00Z") }),
    ];
    const forwards = summariseRatings(rows).get("p1")!;
    const backwards = summariseRatings([...rows].reverse()).get("p1")!;
    expect(backwards).toEqual(forwards);
  });

  it("treats a review with no account as its own voice (D6)", () => {
    const summary = summariseRatings([
      row({ id: "r1", userId: null, rating: 5 }),
      row({ id: "r2", userId: null, rating: 1 }),
    ]);
    // Grouped as one voice this would be 1 or 5; they are different people.
    expect(summary.get("p1")!.average).toBe(3);
    expect(summary.get("p1")!.count).toBe(2);
  });

  it("keeps products apart", () => {
    const summary = summariseRatings([
      row({ id: "r1", productId: "p1", userId: "u1", rating: 5 }),
      row({ id: "r2", productId: "p2", userId: "u1", rating: 1 }),
    ]);
    expect(summary.get("p1")!.average).toBe(5);
    expect(summary.get("p2")!.average).toBe(1);
  });

  it("buckets every review into the histogram, so the bars sum to the count", () => {
    const summary = summariseRatings([
      row({ id: "r1", userId: "u1", rating: 5 }),
      row({ id: "r2", userId: "u1", rating: 5, createdAt: at("2026-09-02T00:00:00Z") }),
      row({ id: "r3", userId: "u2", rating: 3 }),
      row({ id: "r4", userId: "u3", rating: 1 }),
    ]);
    const { histogram, count } = summary.get("p1")!;
    expect(histogram).toEqual({ 1: 1, 2: 0, 3: 1, 4: 0, 5: 2 });
    expect(Object.values(histogram).reduce((a, b) => a + b, 0)).toBe(count);
  });
});

describe("ratingFor", () => {
  it("is zeroes for a product nobody reviewed, not NaN", () => {
    const context = { byProduct: summariseRatings([]) };
    expect(ratingFor(context, "p1")).toEqual(NO_RATING);
    expect(ratingFor(context, "p1").average).toBe(0);
  });

  it("answers for the product asked about", () => {
    const context = {
      byProduct: summariseRatings([row({ id: "r1", rating: 4 })]),
    };
    expect(ratingFor(context, "p1").average).toBe(4);
    expect(ratingFor(context, "unknown")).toEqual(NO_RATING);
  });
});
