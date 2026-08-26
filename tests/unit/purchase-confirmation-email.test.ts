// Regression coverage for two bugs found in the purchase confirmation email:
// order items rendered as a raw number instead of item rows, and every amount
// displayed 100x too large because formatCurrency never converted paise to rupees.
import { describe, expect, it } from "vitest";
import { getPurchaseConfirmationEmailTemplate, type OrderEmailView } from "@server/notifications/templates/purchaseConfirmationEmail";
import { formatCurrency } from "@server/notifications/formatters";

const order = (overrides: Partial<OrderEmailView> = {}): OrderEmailView => ({
  id: "order_1",
  code: "BB-1001",
  status: "processing",
  paymentStatus: "paid",
  createdAt: new Date("2026-08-01T10:00:00Z"),
  itemsTotal: 360000, // ₹3,600
  discount: 0,
  grandTotal: 360000,
  address: {
    fullName: "Fatima Khan",
    mobile: "9876543210",
    addressLine1: "12 Marine Drive",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    country: "India",
  },
  shipments: [],
  items: [
    { productName: "Abaya - Classic", quantity: 2, price: 150000, size: "M", color: "Black" },
    { productName: "Hijab - Silk", quantity: 1, price: 60000 },
  ],
  ...overrides,
});

describe("formatCurrency (server/notifications)", () => {
  it("converts paise to rupees for display", () => {
    expect(formatCurrency(360000)).toBe("₹3,600");
  });

  it("keeps fractional paise visible instead of rounding them away", () => {
    expect(formatCurrency(120050)).toBe("₹1,200.50");
  });
});

describe("getPurchaseConfirmationEmailTemplate", () => {
  it("renders each order item as a row with its name, quantity, and line total", () => {
    const html = getPurchaseConfirmationEmailTemplate(order());

    expect(html).toContain("Abaya - Classic");
    expect(html).toContain("(M / Black)");
    expect(html).toContain("× 2");
    expect(html).toContain(formatCurrency(150000 * 2));

    expect(html).toContain("Hijab - Silk");
    expect(html).toContain(formatCurrency(60000));
  });

  it("displays totals at rupee scale, not the raw paise value", () => {
    const html = getPurchaseConfirmationEmailTemplate(order({ itemsTotal: 360000, grandTotal: 360000 }));

    expect(html).toContain("₹3,600");
    expect(html).not.toContain("₹3,60,000");
  });

  it("does not render the aggregate total number as the item table body", () => {
    const html = getPurchaseConfirmationEmailTemplate(order());
    // The original bug assigned `orderItemsHtml = order.itemsTotal`, so the table
    // body was the bare number with no markup around it.
    expect(html).not.toMatch(/<tbody>\s*360000\s*<\/tbody>/);
  });
});
