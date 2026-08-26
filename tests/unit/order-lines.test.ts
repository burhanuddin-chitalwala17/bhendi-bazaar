// Order lines are rows (order-and-cart-lines PR 1). Two contracts pinned here: the
// row→wire mapper every read uses (price = what was actually paid, TRD D2), and the
// lift migration's load-bearing expressions — per-line identity, the rupees-vs-paise
// disambiguation, and the referential action that protects order history.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toWireShipmentItems, withWireItems } from "@server/checkout/order.repository";

const lineRow = (overrides: Record<string, unknown> = {}) => ({
  quantity: 2,
  orderItem: {
    productId: "prod-1",
    unitPrice: 100000,
    thumbnail: "t.jpg" as string | null,
    size: "M" as string | null,
    color: null as string | null,
    product: { name: "Cream Rida", slug: "cream-rida", thumbnail: "t.jpg" },
    ...(overrides.orderItem as object | undefined),
  },
  ...overrides,
});

describe("toWireShipmentItems", () => {
  it("prices the wire line at what was paid, display fields from the product join", () => {
    expect(toWireShipmentItems([lineRow()])).toEqual([
      {
        productId: "prod-1",
        productName: "Cream Rida",
        productSlug: "cream-rida",
        thumbnail: "t.jpg",
        price: 100000,
        quantity: 2,
        size: "M",
        color: undefined,
      },
    ]);
  });

  it("never fabricates a salePrice — the strike-through is not history", () => {
    expect(toWireShipmentItems([lineRow()])[0]).not.toHaveProperty("salePrice", expect.anything());
  });
});

describe("withWireItems", () => {
  it("swaps row relations for the wire array and keeps the legacy blob off the wire", () => {
    const order = withWireItems({
      id: "order-1",
      shipments: [{ id: "sh-1", legacyItems: [{ old: true }], items: [lineRow()] }],
    });
    expect(order.shipments[0]).not.toHaveProperty("legacyItems");
    expect(order.shipments[0].items[0].productName).toBe("Cream Rida");
  });

  it("keeps every field a shipment carries beyond items/legacyItems (a bare-constraint return type once erased these)", () => {
    const order = withWireItems({
      id: "order-1",
      shipments: [
        { id: "sh-1", status: "confirmed", estimatedDelivery: "2026-09-01", legacyItems: null, items: [lineRow()] },
      ],
    });
    expect(order.shipments[0].status).toBe("confirmed");
    expect(order.shipments[0].estimatedDelivery).toBe("2026-09-01");
  });

  it("produces items already in wire shape — feeding them back into toWireShipmentItems is the bug this guards against", () => {
    const order = withWireItems({
      id: "order-1",
      shipments: [{ id: "sh-1", legacyItems: null, items: [lineRow()] }],
    });
    // The real regression: onPaymentConfirmed called toWireShipmentItems(shipment.items)
    // on an already-wire array, and crashed reading `.orderItem` off an object that
    // doesn't have one — every payment confirmation failed with a 500.
    expect(() => toWireShipmentItems(order.shipments[0].items as any)).toThrow();
  });
});

describe("the order-lines lift migration", () => {
  const sql = readFileSync("prisma/migrations/20260810150000_order_lines/migration.sql", "utf8");

  it("keys lifted rows by line position — the same product can appear twice in one shipment", () => {
    expect(sql).toContain("WITH ORDINALITY");
    expect(sql).toMatch(/md5\(shipment_id \|\| ':' \|\| product_id \|\| ':' \|\| line_no\)/);
  });

  it("disambiguates rupees from paise per order, against the already-paise itemsTotal", () => {
    expect(sql).toMatch(/ROUND\(SUM\(l\.unit_price_raw \* l\.quantity\) \* 100\) = o\."itemsTotal"/);
  });

  it("applies the same sale-price rule checkout charges", () => {
    expect(sql).toMatch(/'salePrice'\)::numeric > 0/);
    expect(sql).toMatch(/'salePrice'\)::numeric < COALESCE\(\(e\.elem ->> 'price'\)::numeric, 0\)/);
  });

  it("a sold product cannot be deleted out from under its order history (RESTRICT)", () => {
    expect(sql).toMatch(
      /OrderItem_productId_fkey"?\s+FOREIGN KEY \("productId"\) REFERENCES "Product"\("id"\) ON DELETE RESTRICT/
    );
  });

  it("skips deleted-product lines loudly, never silently", () => {
    expect(sql).toContain("RAISE NOTICE");
    expect(sql).toMatch(/skipped/);
  });

  it("retires the blob: nullable, so new shipments never write it", () => {
    expect(sql).toMatch(/ALTER TABLE "Shipment" ALTER COLUMN "items" DROP NOT NULL/);
  });
});
