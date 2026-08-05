// Pins the slug rule. A slug containing characters that need percent-encoding
// does not survive the round trip through a Next route param — the param arrives
// still encoded, so the lookup misses. See CHANGELOG PR-14/PR-15.
import { describe, expect, it } from "vitest";
import {
  slugify,
  isValidSlug,
  slugCandidates,
  isUniqueViolation,
  SLUG_PATTERN,
} from "@server/shared/slug";

describe("slugify", () => {
  it.each([
    ["product test 001", "product-test-001"],
    ["  Emerald  Satin Abaya  ", "emerald-satin-abaya"],
    ["Wooden Tasbih (99 Beads)", "wooden-tasbih-99-beads"],
    ["Rose & Musk Blend", "rose-musk-blend"],
    ["Café Crème", "cafe-creme"],
    ["--already-fine--", "already-fine"],
    ["UPPER Case", "upper-case"],
    ["a___b", "a-b"],
  ])("%s -> %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("produces a valid slug for every non-empty result", () => {
    for (const s of ["Rose & Musk", "Café", "99 Beads", "x"]) {
      expect(isValidSlug(slugify(s))).toBe(true);
    }
  });

  it("returns empty when nothing survives, rather than an invalid slug", () => {
    expect(slugify("₹₹₹")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("never yields a slug needing percent-encoding — the original bug", () => {
    for (const s of ["product test 001", "a/b", "a?b", "a#b", "100%"]) {
      const out = slugify(s);
      expect(encodeURIComponent(out)).toBe(out);
    }
  });
});

describe("isValidSlug", () => {
  it.each(["abc", "a-b-c", "a1", "1-2"])("accepts %s", (s) =>
    expect(isValidSlug(s)).toBe(true)
  );
  it.each(["", "-a", "a-", "a--b", "A", "a b", "a_b", "a%20b", "café"])(
    "rejects %s",
    (s) => expect(isValidSlug(s)).toBe(false)
  );
  it("is anchored at both ends", () => {
    expect(SLUG_PATTERN.test("x a")).toBe(false);
  });
});

describe("slugCandidates", () => {
  it("offers the bare slug first, then numbered suffixes", () => {
    const g = slugCandidates("Black Abaya");
    expect([g.next().value, g.next().value, g.next().value]).toEqual([
      "black-abaya",
      "black-abaya-2",
      "black-abaya-3",
    ]);
  });

  it("falls back when the name slugifies to nothing", () => {
    expect(slugCandidates("₹₹₹").next().value).toBe("item");
  });

  it("every candidate is a valid slug", () => {
    const g = slugCandidates("Rose & Musk Blend");
    for (let i = 0; i < 5; i++) expect(isValidSlug(g.next().value as string)).toBe(true);
  });
});

describe("isUniqueViolation", () => {
  // Captured verbatim from Prisma 7 + @prisma/adapter-pg. `meta.target` is
  // undefined under a driver adapter, which is why the first version of this
  // function never matched and every retry was silently disabled.
  const adapterError = {
    code: "P2002",
    meta: {
      modelName: "Product",
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          originalCode: "23505",
          originalMessage:
            'duplicate key value violates unique constraint "Product_slug_key"',
          kind: "UniqueConstraintViolation",
          constraint: { fields: ["slug"] },
        },
      },
    },
  };

  it("recognises the real driver-adapter shape", () => {
    expect("target" in adapterError.meta).toBe(false);
    expect(isUniqueViolation(adapterError, "slug")).toBe(true);
  });

  it("still recognises the classic meta.target shape", () => {
    expect(isUniqueViolation({ code: "P2002", meta: { target: ["slug"] } }, "slug")).toBe(true);
    expect(isUniqueViolation({ code: "P2002", meta: { target: "slug" } }, "slug")).toBe(true);
  });

  it("ignores a violation on a different field, in either shape", () => {
    expect(isUniqueViolation({ code: "P2002", meta: { target: ["sku"] } }, "slug")).toBe(false);
    const other = structuredClone(adapterError);
    other.meta.driverAdapterError.cause.constraint.fields = ["sku"];
    expect(isUniqueViolation(other, "slug")).toBe(false);
  });

  it("ignores other errors, so a real failure is not retried as a collision", () => {
    expect(isUniqueViolation({ code: "P2025" }, "slug")).toBe(false);
    expect(isUniqueViolation(new Error("connection refused"), "slug")).toBe(false);
    expect(isUniqueViolation(undefined, "slug")).toBe(false);
  });
});
