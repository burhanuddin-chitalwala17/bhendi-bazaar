/**
 * Prisma reports the same constraint violation differently depending on version and
 * driver, and reading only one shape fails *open*: `uniqueViolationFields` returns the
 * unattributed `[]`, every `isUniqueViolation(error, field)` answers false, and the
 * friendly message the caller wrote is skipped in favour of a raw Prisma error. Nothing
 * throws, nothing logs, and the only symptom is a worse message.
 *
 * That is exactly what the 7.1 → 7.10 bump did: `meta.driverAdapterError.cause.constraint`
 * changed from `{ fields: [...] }` (the columns) to `{ index: "..." }` (the constraint's
 * name). These fixtures are captured from real errors, so a future bump that changes the
 * shape again fails here rather than in a form nobody is looking at.
 */
import { describe, expect, it } from "vitest";
import {
  uniqueViolationFields,
  isUniqueViolation,
  isNotFoundViolation,
  constraintFields,
} from "@server/shared/constraint";

/** Prisma 7.10 + @prisma/adapter-pg: the constraint's NAME. */
const p2002ByIndex = {
  code: "P2002",
  meta: {
    modelName: "Product",
    driverAdapterError: {
      name: "DriverAdapterError",
      cause: {
        originalCode: "23505",
        originalMessage: 'duplicate key value violates unique constraint "Product_orgId_sku_key"',
        kind: "UniqueConstraintViolation",
        constraint: { index: "Product_orgId_sku_key" },
        table: "Product",
      },
    },
  },
};

/** Prisma 7.1 + @prisma/adapter-pg: the columns themselves. */
const p2002ByFields = {
  code: "P2002",
  meta: {
    modelName: "Product",
    driverAdapterError: { cause: { constraint: { fields: ["orgId", "sku"] } } },
  },
};

/** No driver adapter: the engine's own `meta.target`. */
const p2002ByTarget = { code: "P2002", meta: { target: ["orgId", "sku"] } };

describe("unique violations, whichever shape Prisma reports", () => {
  it.each([
    ["constraint name (7.10 adapter)", p2002ByIndex],
    ["constraint fields (7.1 adapter)", p2002ByFields],
    ["engine target (no adapter)", p2002ByTarget],
  ])("%s names both columns", (_label, error) => {
    expect(uniqueViolationFields(error)).toEqual(["orgId", "sku"]);
    expect(isUniqueViolation(error, "sku")).toBe(true);
    expect(isUniqueViolation(error, "orgId")).toBe(true);
    expect(isUniqueViolation(error, "slug")).toBe(false);
  });

  it("reads a single-column constraint name", () => {
    const error = {
      code: "P2002",
      meta: { driverAdapterError: { cause: { constraint: { index: "Product_slug_key" } } } },
    };
    expect(uniqueViolationFields(error)).toEqual(["slug"]);
    expect(isUniqueViolation(error, "slug")).toBe(true);
  });

  it("does not invent fields for the hand-written partial indexes", () => {
    // These two live in migration SQL and express a rule, not a field a form can
    // highlight, so the right answer is "a uniqueness failure, unattributed".
    for (const index of ["ProductMedia_one_thumbnail_per_product", "BiddingEvent_one_open_per_product"]) {
      const error = {
        code: "P2002",
        meta: { driverAdapterError: { cause: { constraint: { index } } } },
      };
      expect(uniqueViolationFields(error), index).toEqual([]);
      expect(isUniqueViolation(error, "productId"), index).toBe(false);
    }
  });

  it("is null — not [] — for anything that is not a unique violation", () => {
    // The distinction callers rely on: [] means "unique violation, unknown column",
    // null means "not a unique violation at all".
    expect(uniqueViolationFields({ code: "P2003" })).toBeNull();
    expect(uniqueViolationFields(new Error("boom"))).toBeNull();
    expect(uniqueViolationFields(undefined)).toBeNull();
  });
});

describe("other constraint failures", () => {
  it("attributes a foreign key to the column that pointed wrong", () => {
    const error = {
      code: "P2003",
      meta: {
        modelName: "Product",
        driverAdapterError: {
          cause: {
            originalMessage: 'insert or update on table "Product" violates foreign key constraint',
            constraint: { index: "Product_categoryId_fkey" },
          },
        },
      },
    };
    expect(constraintFields(error)).toEqual({ kind: "foreignKey", fields: ["categoryId"] });
  });

  it("reads a Restrict refusal as the other direction of the same code", () => {
    // ADR-0020: money-bearing rows refuse deletion. The caller typed nothing wrong, so
    // no field is attributed — but the referencing table is what makes the message useful.
    const error = {
      code: "P2003",
      meta: {
        modelName: "Product",
        driverAdapterError: {
          cause: {
            originalMessage: 'update or delete on table "Product" violates foreign key constraint',
            constraint: { index: "OrderItem_productId_fkey" },
          },
        },
      },
    };
    expect(constraintFields(error)).toEqual({
      kind: "restricted",
      fields: [],
      referencingTable: "OrderItem",
    });
  });

  it("recognises record-not-found", () => {
    expect(isNotFoundViolation({ code: "P2025" })).toBe(true);
    expect(isNotFoundViolation({ code: "P2002" })).toBe(false);
  });
});
