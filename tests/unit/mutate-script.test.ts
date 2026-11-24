import { describe, it, expect } from "vitest";
import { mutateText } from "../../scripts/mutate.mjs";

describe("mutate", () => {
  it("replaces the one occurrence", () => {
    expect(mutateText("if (count === 0) return;", "=== 0", "!== 0")).toBe("if (count !== 0) return;");
  });

  it("refuses a missing or ambiguous target, so the wrong line is never broken", () => {
    expect(() => mutateText("a", "b", "c")).toThrow(/not in the file/);
    expect(() => mutateText("x x", "x", "y")).toThrow(/more than once/);
  });
});
