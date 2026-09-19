// A page size is a caller-supplied `take` and a page number a caller-supplied `skip`.
// Both are parsed against a closed set rather than coerced (Invariant 4 at a read
// boundary), because `limit=1000000` on an admin listing is a table scan for the asking.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  resolvePageNumber,
  resolvePageSize,
} from "@server/shared/pagination";

describe("resolvePageSize", () => {
  it("accepts every offered size, as a number or as the string a query param gives", () => {
    for (const size of PAGE_SIZE_OPTIONS) {
      expect(resolvePageSize(size)).toBe(size);
      expect(resolvePageSize(String(size))).toBe(size);
    }
  });

  it("refuses anything outside the set rather than passing it through", () => {
    expect(resolvePageSize(1_000_000)).toBe(DEFAULT_PAGE_SIZE);
    expect(resolvePageSize(20)).toBe(DEFAULT_PAGE_SIZE);
    expect(resolvePageSize(0)).toBe(DEFAULT_PAGE_SIZE);
    expect(resolvePageSize(-10)).toBe(DEFAULT_PAGE_SIZE);
    expect(resolvePageSize(10.5)).toBe(DEFAULT_PAGE_SIZE);
  });

  it("falls back for absent and unparseable values", () => {
    expect(resolvePageSize(null)).toBe(DEFAULT_PAGE_SIZE);
    expect(resolvePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(resolvePageSize("")).toBe(DEFAULT_PAGE_SIZE);
    expect(resolvePageSize("all")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("honours a caller's own fallback, but only when it is one of the options", () => {
    expect(resolvePageSize("nonsense", 50)).toBe(50);
  });
});

describe("resolvePageNumber", () => {
  it("passes positive whole pages through", () => {
    expect(resolvePageNumber(1)).toBe(1);
    expect(resolvePageNumber("7")).toBe(7);
  });

  it("refuses anything that would become a negative or fractional skip", () => {
    expect(resolvePageNumber(0)).toBe(1);
    expect(resolvePageNumber(-3)).toBe(1);
    expect(resolvePageNumber(2.5)).toBe(1);
    expect(resolvePageNumber("last")).toBe(1);
    expect(resolvePageNumber(undefined)).toBe(1);
  });
});
