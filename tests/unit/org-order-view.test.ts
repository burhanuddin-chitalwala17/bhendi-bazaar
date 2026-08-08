// What an org may know about an order it part-fulfils (programme spec R7/A6): its own
// parcels and the delivery address, never the basket's other shipments or order-level
// money. The Prisma query already filters shipments to the org; this mapper asserts the
// property a second time so it is testable without a database — and so a future query
// change that widens the include cannot silently widen what a vendor sees.
import { describe, expect, it } from "vitest";
import { toOrgOrderView } from "@/data-access-layer/org/orders.dal";

const shipment = (orgId: string, overrides: Record<string, unknown> = {}) => ({
  id: `sh-${orgId}`,
  code: `BB-1001-${orgId}`,
  status: "processing",
  shippingCost: 80,
  orgId,
  items: [
    {
      productId: `p-${orgId}`,
      productName: `Item from ${orgId}`,
      productSlug: `item-${orgId}`,
      thumbnail: "",
      price: 500,
      quantity: 2,
    },
  ],
  ...overrides,
});

const order = (shipments: ReturnType<typeof shipment>[]) => ({
  id: "order-1",
  code: "BB-1001",
  status: "processing",
  paymentStatus: "paid",
  createdAt: new Date("2026-08-09T10:00:00Z"),
  address: {
    fullName: "A Buyer",
    mobile: "9876543210",
    addressLine1: "12 Main St",
    city: "Mumbai",
    state: "MH",
    pincode: "400003",
    country: "India",
  },
  // A row that (wrongly) still carries the whole basket's money — the view must not.
  grandTotal: 99999,
  itemsTotal: 88888,
  shipments,
});

describe("toOrgOrderView", () => {
  it("keeps only this org's shipments when a foreign one reaches the mapper", () => {
    const view = toOrgOrderView(order([shipment("org-a"), shipment("org-b")]), "org-a");

    expect(view.shipments).toHaveLength(1);
    expect(view.shipments[0].code).toBe("BB-1001-org-a");
  });

  it("computes parcel value from this org's items only", () => {
    const view = toOrgOrderView(order([shipment("org-a"), shipment("org-b")]), "org-a");

    expect(view.parcelValue).toBe(1000); // 500 × 2, org-a only
    expect(view.itemCount).toBe(2);
  });

  it("never carries order-level money, whatever the row contains", () => {
    const view = toOrgOrderView(order([shipment("org-a")]), "org-a");

    expect(view).not.toHaveProperty("grandTotal");
    expect(view).not.toHaveProperty("itemsTotal");
  });

  it("prices a discounted item at its sale price", () => {
    const discounted = shipment("org-a");
    discounted.items[0] = { ...discounted.items[0], salePrice: 400 } as never;

    expect(toOrgOrderView(order([discounted]), "org-a").parcelValue).toBe(800);
  });

  it("keeps the delivery address and payment status — the org ships this parcel", () => {
    const view = toOrgOrderView(order([shipment("org-a")]), "org-a");

    expect(view.address.pincode).toBe("400003");
    expect(view.paymentStatus).toBe("paid");
  });

  it("survives a shipment whose items are not an array", () => {
    const broken = shipment("org-a", { items: null });

    const view = toOrgOrderView(order([broken]), "org-a");
    expect(view.shipments[0].items).toEqual([]);
    expect(view.parcelValue).toBe(0);
  });
});
