// A product that has been sold cannot be hard-deleted: OrderItem, PromotionTarget and
// BiddingEvent hold `onDelete: Restrict` foreign keys on it (ADR-0020). Postgres was
// enforcing that correctly; the refusal reached the org as "One of the selected
// records no longer exists", because `constraintFields` read the engine's `field_name`
// — which `@prisma/adapter-pg` never sets — and then assumed the child side of the key.
//
// The two P2003 payloads below were captured from Prisma 7.1 + @prisma/adapter-pg
// against the local dev database, not written from the documentation.
import { describe, expect, it } from "vitest";
import { constraintFields, uniqueViolationFields } from "@server/shared/constraint";
import { describeDeleteBlockers } from "@server/catalog/admin.product.service";
import { toErrorResponse } from "@/lib/api-error-response";

const parentSide = {
  code: "P2003",
  meta: {
    modelName: "Product",
    driverAdapterError: {
      name: "DriverAdapterError",
      cause: {
        originalCode: "23503",
        originalMessage:
          'update or delete on table "Product" violates foreign key constraint "OrderItem_productId_fkey" on table "OrderItem"',
        kind: "ForeignKeyConstraintViolation",
        constraint: { index: "OrderItem_productId_fkey" },
      },
    },
  },
};

const childSide = {
  code: "P2003",
  meta: {
    modelName: "Product",
    driverAdapterError: {
      name: "DriverAdapterError",
      cause: {
        originalCode: "23503",
        originalMessage:
          'insert or update on table "Product" violates foreign key constraint "Product_categoryId_fkey"',
        kind: "ForeignKeyConstraintViolation",
        constraint: { index: "Product_categoryId_fkey" },
      },
    },
  },
};

describe("constraintFields — which side of the foreign key failed", () => {
  it("reads a delete refused by rows that still point here as `restricted`", () => {
    expect(constraintFields(parentSide)).toEqual({
      kind: "restricted",
      fields: [],
      referencingTable: "OrderItem",
    });
  });

  it("still reads a value pointing at a missing parent as `foreignKey`", () => {
    expect(constraintFields(childSide)).toEqual({
      kind: "foreignKey",
      fields: ["categoryId"],
    });
  });

  it("recovers the column under the adapter, which sets no `field_name`", () => {
    // The regression this file exists for: the old reader looked only at
    // `meta.field_name`, so every foreign key lost its field attribution.
    const result = constraintFields(childSide);
    expect(result?.fields).toEqual(["categoryId"]);
  });

  it("falls back to the constraint's own table when there is no driver message", () => {
    const engineShape = {
      code: "P2003",
      meta: { modelName: "Product", field_name: "OrderItem_productId_fkey (index)" },
    };
    expect(constraintFields(engineShape)).toMatchObject({
      kind: "restricted",
      referencingTable: "OrderItem",
    });
  });

  it("leaves uniqueness alone", () => {
    expect(constraintFields({ code: "P2002" })).toBeNull();
    expect(uniqueViolationFields(parentSide)).toBeNull();
  });
});

describe("toErrorResponse — what the org is told", () => {
  it("no longer claims the product they selected has vanished", async () => {
    const response = toErrorResponse(parentSide);
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error).toBe("This cannot be deleted while existing orders still refer to it");
    // Nothing on the form is wrong, so nothing is highlighted.
    expect(body.details).toBeUndefined();
  });

  it("still tells a form which field to fix on the child side", async () => {
    const body = await toErrorResponse(childSide).json();
    expect(body.error).toBe("That category no longer exists — pick another");
    expect(body.details).toEqual([
      { path: "categoryId", message: "That category no longer exists — pick another" },
    ]);
  });
});

describe("describeDeleteBlockers", () => {
  const none = { orderItems: 0, promotionTargets: 0, biddingEvents: 0, channelListings: 0 };

  it("returns null when the product has never been sold, promoted or bid on", () => {
    expect(describeDeleteBlockers(none)).toBeNull();
  });

  it("names the count, so the org knows whether it is one basket or a year of trade", () => {
    expect(describeDeleteBlockers({ ...none, orderItems: 1 })).toContain(
      "1 order still refers to it, and deleting it would break that record"
    );
    expect(describeDeleteBlockers({ ...none, orderItems: 14 })).toContain(
      "14 orders still refer to it, and deleting it would break those records"
    );
  });

  it("lists every blocker rather than the first", () => {
    const message = describeDeleteBlockers({
      orderItems: 3,
      promotionTargets: 1,
      biddingEvents: 2,
      channelListings: 0,
    });
    expect(message).toContain("3 orders, 1 promotion and 2 bidding events");
  });

  it("refuses on a promotion or a bidding event alone, not only on orders", () => {
    expect(describeDeleteBlockers({ ...none, promotionTargets: 1 })).toContain("1 promotion");
    expect(describeDeleteBlockers({ ...none, biddingEvents: 1 })).toContain("1 bidding event");
  });

  it("refuses on a linked marketplace listing, whose key on the product never cascades (channel-import D1)", () => {
    expect(describeDeleteBlockers({ ...none, channelListings: 2 })).toContain("2 marketplace listings");
  });

  it("names Archive as the way through, since the refusal is otherwise a dead end", () => {
    // Delete used to archive silently in this case. It no longer does, so the message
    // has to carry the org to the control that does work — it is the whole reason the
    // refusal is acceptable now that Archive is its own button.
    expect(describeDeleteBlockers({ ...none, orderItems: 1 })).toContain(
      "Archive it instead to take it off the storefront."
    );
  });
});
