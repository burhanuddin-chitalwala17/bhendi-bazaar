/**
 * A bulk library body is parsed, never trusted (Invariant 4): at most 100 ids per request (bulk-actions
 * Q10), each a bounded string, and a repeated id counts once.
 */
import { describe, expect, it } from "vitest";
import { mediaBulkSchema, mediaBulkTagSchema } from "@/lib/validation/schemas/media-library.schema";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `a${i}`);

describe("bulk media schemas", () => {
  it("accepts 100 ids and refuses 101 (Q10)", () => {
    expect(mediaBulkSchema.safeParse({ ids: ids(100) }).success).toBe(true);
    expect(mediaBulkSchema.safeParse({ ids: ids(101) }).success).toBe(false);
  });

  it("refuses an empty selection, a blank id and an oversized one", () => {
    expect(mediaBulkSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(mediaBulkSchema.safeParse({ ids: [""] }).success).toBe(false);
    expect(mediaBulkSchema.safeParse({ ids: ["x".repeat(65)] }).success).toBe(false);
  });

  it("de-duplicates, keeping first-seen order", () => {
    expect(mediaBulkSchema.parse({ ids: ["b", "a", "b", "a"] }).ids).toEqual(["b", "a"]);
  });

  it("tag body takes a tag from the closed set and an explicit direction (Q6)", () => {
    expect(mediaBulkTagSchema.parse({ ids: ["a", "a"], tag: "REFERENCE", on: true })).toEqual({
      ids: ["a"],
      tag: "REFERENCE",
      on: true,
    });
    expect(mediaBulkTagSchema.safeParse({ ids: ["a"], tag: "NOPE", on: true }).success).toBe(false);
    expect(mediaBulkTagSchema.safeParse({ ids: ["a"], tag: "REFERENCE" }).success).toBe(false);
  });
});
