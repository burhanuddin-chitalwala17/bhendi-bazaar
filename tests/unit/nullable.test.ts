// A nullable+unique column tolerates many NULLs but only one ''. Storing a blank
// form field as '' therefore makes the *second* such row a constraint violation —
// which is how a blank SKU blocked creating a second product. See CHANGELOG PR-17.
import { describe, expect, it } from "vitest";
import { blankToNull } from "@server/shared/nullable";

describe("blankToNull", () => {
  it.each([undefined, null, "", "   ", "\t\n"])("%s becomes null", (input) => {
    expect(blankToNull(input as string | null | undefined)).toBeNull();
  });

  it("keeps a real value, trimmed", () => {
    expect(blankToNull("ABY-EMR-001")).toBe("ABY-EMR-001");
    expect(blankToNull("  ABY-EMR-001  ")).toBe("ABY-EMR-001");
  });

  it("never returns an empty string, which is the whole point", () => {
    for (const input of ["", " ", "\t", null, undefined, "x"]) {
      expect(blankToNull(input as string | null | undefined)).not.toBe("");
    }
  });
});
