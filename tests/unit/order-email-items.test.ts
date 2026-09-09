/**
 * The confirmation email's items table.
 *
 * It rendered a bare paise integer where the rows belong for as long as the template
 * has existed: `orderItemsHtml` was assigned `order.itemsTotal` as a placeholder and
 * never finished, and because a number interpolates into HTML perfectly happily,
 * nothing failed — not the compiler, not a test, not the send. The lesson these tests
 * encode is that a template's output has to be asserted on, because a template that
 * renders the wrong thing looks exactly like one that renders the right thing.
 */
import { describe, expect, it } from "vitest";
import { toOrderEmailItems } from "@server/checkout/order.service";
import {
  getPurchaseConfirmationEmailTemplate,
  type OrderEmailView,
} from "@server/notifications/templates/purchaseConfirmationEmail";

function item(over: Partial<{
  productId: string;
  productName: string;
  productSlug: string;
  thumbnail: string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
}> = {}) {
  return {
    productId: "p1",
    productName: "Brass lamp",
    productSlug: "brass-lamp",
    thumbnail: "https://example.test/a.jpg",
    price: 120_000,
    quantity: 1,
    ...over,
  };
}

const ORDER: OrderEmailView = {
  id: "o1",
  code: "BB-1001",
  status: "confirmed",
  paymentStatus: "paid",
  createdAt: new Date("2026-09-09T10:00:00.000Z"),
  notes: null,
  items: [{ productName: "Brass lamp", quantity: 2, unitPrice: 120_000 }],
  itemsTotal: 240_000,
  discount: 0,
  grandTotal: 245_000,
  address: {
    fullName: "A Buyer",
    email: "buyer@example.test",
    mobile: "9999999999",
    addressLine1: "1 Test Road",
    city: "Mumbai",
    state: "MH",
    pincode: "400001",
    country: "India",
  },
  shipments: [],
};

describe("toOrderEmailItems", () => {
  it("lists what was bought", () => {
    expect(toOrderEmailItems([{ items: [item({ quantity: 2 })] }])).toEqual([
      { productName: "Brass lamp", quantity: 2, unitPrice: 120_000, size: undefined, color: undefined },
    ]);
  });

  it("merges one line split across parcels into a single row", () => {
    // Allocation can take two units from two locations. The email has no parcel
    // column, so two identical rows would read as a defect.
    const merged = toOrderEmailItems([
      { items: [item({ quantity: 1 })] },
      { items: [item({ quantity: 2 })] },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(3);
  });

  it("keeps different variants of one product apart", () => {
    const merged = toOrderEmailItems([
      {
        items: [
          item({ color: "Maroon" }),
          item({ color: "Blue" }),
          item({ size: "L" }),
        ],
      },
    ]);
    expect(merged).toHaveLength(3);
  });

  it("keeps the same variant apart when it was bought at two prices", () => {
    // An offer can change between two parcels' pricing; merging them would report a
    // quantity against a unit price nobody paid.
    const merged = toOrderEmailItems([
      { items: [item({ price: 120_000 })] },
      { items: [item({ price: 100_000 })] },
    ]);
    expect(merged).toHaveLength(2);
  });

  it("returns nothing for an order with no parcels", () => {
    expect(toOrderEmailItems([])).toEqual([]);
  });
});

describe("purchase confirmation email", () => {
  it("renders a row per item, not a raw total", () => {
    const html = getPurchaseConfirmationEmailTemplate(ORDER);
    expect(html).toContain("Brass lamp");
    // The line total: 2 × ₹1,200. The regression was the raw paise integer landing
    // in the table body instead.
    expect(html).toContain("₹2,400");
    expect(html).not.toMatch(/<tbody>\s*240000\s*<\/tbody>/);
  });

  it("formats every amount as rupees, never as paise", () => {
    const html = getPurchaseConfirmationEmailTemplate(ORDER);
    expect(html).toContain("₹2,450"); // grand total, not 245000
    expect(html).not.toContain("245000");
    expect(html).not.toContain("240000");
  });

  it("shows the variant when there is one", () => {
    const html = getPurchaseConfirmationEmailTemplate({
      ...ORDER,
      items: [{ productName: "Silk saree", quantity: 1, unitPrice: 500_000, color: "Maroon", size: "Free" }],
    });
    expect(html).toContain("Free · Maroon");
  });

  it("escapes a product name rather than rendering it as markup", () => {
    // Product names are org-entered and an email client renders HTML.
    const html = getPurchaseConfirmationEmailTemplate({
      ...ORDER,
      items: [{ productName: '<script>alert(1)</script>', quantity: 1, unitPrice: 100 }],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("still renders when an order somehow has no item rows", () => {
    const html = getPurchaseConfirmationEmailTemplate({ ...ORDER, items: [] });
    expect(html).toContain("<tbody>");
    expect(html).toContain("order page");
  });
});
