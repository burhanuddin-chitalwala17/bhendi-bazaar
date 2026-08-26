// The confirmation email is the only bill a buyer ever sees, and it is built by
// string interpolation — so what is asserted here is what a template of that shape
// gets wrong: money formatted from the wrong unit, a lines table that was never
// rendered, and user-typed text reaching the HTML unescaped.
import { describe, expect, it } from "vitest";
import {
  getPurchaseConfirmationEmailTemplate,
  type OrderEmailView,
} from "@server/notifications/templates/purchaseConfirmationEmail";

process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";

function view(overrides: Partial<OrderEmailView> = {}): OrderEmailView {
  return {
    id: "ord_abc123",
    code: "BB-1755000000000-a1b2c3d4",
    status: "processing",
    paymentStatus: "paid",
    createdAt: new Date("2026-08-20T10:30:00Z"),
    items: [
      { productName: "Kaftan", quantity: 2, unitPrice: 99900, size: "M", color: "Black" },
      { productName: "Abaya", quantity: 1, unitPrice: 250050 },
    ],
    itemsTotal: 449850,
    shippingTotal: 8000,
    discount: 50000,
    grandTotal: 407850,
    address: {
      fullName: "Aisha K",
      email: "aisha@example.com",
      mobile: "9876543210",
      addressLine1: "12 Mohammed Ali Road",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400003",
      country: "India",
    },
    shipments: [],
    ...overrides,
  };
}

describe("purchase confirmation email", () => {
  it("bills every line with its quantity and amount", () => {
    const html = getPurchaseConfirmationEmailTemplate(view());

    expect(html).toContain("Kaftan");
    expect(html).toContain("M · Black");
    expect(html).toContain("2 × ₹999"); // unit price
    expect(html).toContain("₹1,998"); // line amount
    expect(html).toContain("Abaya");
    expect(html).toContain("₹2,500.50");
  });

  it("formats money from paise, not as paise", () => {
    const html = getPurchaseConfirmationEmailTemplate(view());

    expect(html).toContain("₹4,498.50"); // subtotal
    expect(html).toContain("₹80"); // shipping
    expect(html).toContain("₹500"); // discount
    expect(html).toContain("₹4,078.50"); // total
    expect(html).not.toContain("₹4,49,850"); // the paise-as-rupees defect
  });

  it("shows the order id and links to the order in the app", () => {
    const html = getPurchaseConfirmationEmailTemplate(view());

    expect(html).toContain("Order ID");
    expect(html).toContain("BB-1755000000000-a1b2c3d4");
    expect(html).toContain('href="http://localhost:3000/order/ord_abc123"');
  });

  it("says shipping is free rather than printing ₹0", () => {
    const html = getPurchaseConfirmationEmailTemplate(view({ shippingTotal: 0 }));

    expect(html).toContain("Free");
  });

  it("omits the discount row when nothing was discounted", () => {
    const html = getPurchaseConfirmationEmailTemplate(view({ discount: 0 }));

    expect(html).not.toContain("Discount:");
  });

  it("escapes user-typed text instead of interpolating markup", () => {
    const html = getPurchaseConfirmationEmailTemplate(
      view({
        notes: '<script>alert(1)</script> leave at "gate" & ring',
        items: [{ productName: "<b>Kurta</b>", quantity: 1, unitPrice: 100 }],
      })
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;gate&quot;");
    expect(html).toContain("&amp; ring");
    expect(html).toContain("&lt;b&gt;Kurta&lt;/b&gt;");
  });

  it("does not leave an empty bill silently empty", () => {
    const html = getPurchaseConfirmationEmailTemplate(view({ items: [] }));

    expect(html).toContain("Item details are on your order page");
  });
});
