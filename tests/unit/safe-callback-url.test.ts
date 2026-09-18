// The sign-in pages honour callbackUrl only as a same-origin path (seamless-sign-in D5).
import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "@/lib/safe-callback-url";

describe("safeCallbackUrl", () => {
  it.each(["/", "/wishlist", "/product/cream-rida?size=M", "/admin"])("keeps the relative path %s", (path) => {
    expect(safeCallbackUrl(path)).toBe(path);
  });

  it.each([
    ["protocol-relative", "//evil.example"],
    ["backslash protocol-relative", "/\\evil.example"],
    ["absolute", "https://evil.example/"],
    ["javascript:", "javascript:alert(1)"],
    ["relative without a slash", "wishlist"],
    ["a hidden control character", "/\t/evil.example"],
    ["empty", ""],
  ])("falls back to / for %s", (_label, value) => {
    expect(safeCallbackUrl(value)).toBe("/");
  });

  it("falls back to / when absent, and takes the first of a repeated param", () => {
    expect(safeCallbackUrl(undefined)).toBe("/");
    expect(safeCallbackUrl(["/cart", "//evil.example"])).toBe("/cart");
  });
});
