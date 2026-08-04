// Pins the canonical PIN code rule. Eleven copies had drifted, and the laxest
// was on the server — which is the authority. See CHANGELOG PR-09.
import { describe, expect, it } from "vitest";
import { isValidPincode, PINCODE_PATTERN } from "@server/shared/pincode";

describe("isValidPincode", () => {
  it.each(["400008", "110001", "999999", "100000"])("accepts %s", (p) => {
    expect(isValidPincode(p)).toBe(true);
  });

  // The divergence that motivated this: the old server rule accepted all of these.
  it.each(["000000", "012345", "099999"])("rejects leading zero: %s", (p) => {
    expect(isValidPincode(p)).toBe(false);
  });

  it.each(["12345", "1234567", ""])("rejects wrong length: %s", (p) => {
    expect(isValidPincode(p)).toBe(false);
  });

  it.each(["40000a", "4000 8", " 400008", "400008 ", "4-0008"])(
    "rejects non-digits and surrounding space: %s",
    (p) => {
      expect(isValidPincode(p)).toBe(false);
    }
  );

  it("is anchored at both ends", () => {
    expect(PINCODE_PATTERN.test("x400008")).toBe(false);
    expect(PINCODE_PATTERN.test("400008x")).toBe(false);
  });
});
