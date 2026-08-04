// Asserts the runner resolves the same aliases as tsconfig.json. If this fails,
// no other test can be trusted.
import { describe, expect, it } from "vitest";
import { ProductFlag } from "@server/catalog/product.flags";
import type { Pagination } from "@server/shared/pagination";

describe("test harness", () => {
  it("resolves the @server alias", () => {
    expect(ProductFlag.FEATURED).toBe("FEATURED");
  });

  it("resolves type-only imports from @server", () => {
    const page: Pagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
    expect(page.limit).toBe(20);
  });

  it("fails a test that tries to reach the network", async () => {
    await expect(async () => {
      await fetch("https://example.com");
    }).rejects.toThrow(/Unmocked fetch/);
  });
});
