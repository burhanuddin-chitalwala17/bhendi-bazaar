/** DATABASE_POOL_MAX is parsed, never trusted (GTM B12): below 3, two transactions at once starve. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { poolMax } from "@server/shared/pool-size";

afterEach(() => vi.restoreAllMocks());

describe("poolMax", () => {
  it("keeps the default when unset", () => {
    expect(poolMax(undefined, 10)).toBe(10);
    expect(poolMax("", 10)).toBe(10);
  });

  it("takes a whole number of at least 3", () => {
    expect(poolMax("3", 10)).toBe(3);
    expect(poolMax("5", 10)).toBe(5);
  });

  it("refuses, loudly, what would starve or make no sense", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const bad of ["1", "2", "0", "-1", "2.5", "abc"]) expect(poolMax(bad, 10)).toBe(10);
    expect(log).toHaveBeenCalledTimes(6);
  });
});
