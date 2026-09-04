// The confirmation is the only receipt a buyer gets, and every part of it was
// broken in a way that produces no error: skipped for want of an optional field,
// raced against the serverless freeze, and quoting paise as rupees.
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getPurchaseConfirmationEmailTemplate,
  type OrderEmailView,
} from "@server/notifications/templates/purchaseConfirmationEmail";
import { formatCurrency } from "@server/notifications/formatters";

const view = (over: Partial<OrderEmailView> = {}): OrderEmailView => ({
  id: "o1",
  code: "BB-1001",
  status: "confirmed",
  paymentStatus: "paid",
  createdAt: new Date("2026-09-04T10:00:00Z"),
  itemsTotal: 129900,
  discount: 0,
  grandTotal: 129900,
  address: {
    fullName: "Aisha Khan",
    mobile: "9999999999",
    addressLine1: "1 Market Road",
    city: "Mumbai",
    state: "MH",
    pincode: "400001",
    country: "India",
  },
  shipments: [{ estimatedDelivery: null }],
  items: [{ productName: "Silk Abaya", quantity: 2, unitPrice: 64950 }],
  ...over,
});

describe("money in the email", () => {
  it("reads paise as rupees — the local formatter quoted a ₹1,299 order as ₹1,29,900", () => {
    expect(formatCurrency(129900)).toBe("₹1,299");
  });

  it("keeps the paise when they are not whole rupees", () => {
    expect(formatCurrency(129950)).toBe("₹1,299.50");
  });
});

describe("the order items table", () => {
  it("lists the lines, where it used to print the paise total as the only row", () => {
    const html = getPurchaseConfirmationEmailTemplate(view());

    expect(html).toContain("Silk Abaya");
    expect(html).toContain("× 2");
    // 2 × ₹649.50
    expect(html).toContain("₹1,299");
    expect(html).not.toContain("<tbody>\n                129900");
  });

  it("names the variant, so a two-size order is not two identical rows", () => {
    const html = getPurchaseConfirmationEmailTemplate(
      view({
        items: [
          { productName: "Silk Abaya", quantity: 1, unitPrice: 64950, size: "M" },
          { productName: "Silk Abaya", quantity: 1, unitPrice: 64950, size: "L" },
        ],
      })
    );

    expect(html).toContain("(M)");
    expect(html).toContain("(L)");
  });

  it("says something rather than nothing when an order has no readable lines", () => {
    const html = getPurchaseConfirmationEmailTemplate(view({ items: [] }));

    expect(html).toContain("See your order online");
  });

  it("escapes what the buyer typed instead of interpolating it as markup", () => {
    const html = getPurchaseConfirmationEmailTemplate(
      view({
        notes: "<script>alert(1)</script>",
        address: { ...view().address, fullName: "A <b>Khan</b>" },
      })
    );

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &lt;b&gt;Khan&lt;/b&gt;");
  });
});

// The delivery side: who it goes to, and whether the send is allowed to outlive
// the request. Mocked at the repository and the mailer, so this is the service's
// own decision-making and nothing else.
const findById = vi.fn();
const findConfirmationDetails = vi.fn();
const sendPurchaseConfirmationEmail = vi.fn();
const recordSale = vi.fn();

vi.mock("@server/checkout/order.repository", () => ({
  orderRepository: {
    findById: (id: string) => findById(id),
    findConfirmationDetails: (id: string) => findConfirmationDetails(id),
  },
}));
vi.mock("@server/notifications/email.service", () => ({
  emailService: {
    sendPurchaseConfirmationEmail: (v: unknown, to: string) =>
      sendPurchaseConfirmationEmail(v, to),
  },
}));
vi.mock("@server/payouts/ledger.service", () => ({
  ledgerService: { recordSale: (id: string) => recordSale(id) },
}));

const { orderService } = await import("@server/checkout/order.service");

const orderRow = (address: Record<string, unknown> | null) => ({
  id: "o1",
  code: "BB-1001",
  status: "confirmed",
  paymentStatus: "paid",
  createdAt: new Date("2026-09-04T10:00:00Z"),
  notes: null,
  itemsTotal: 129900,
  discount: 0,
  grandTotal: 129900,
  address,
  shipments: [{ estimatedDelivery: null, items: [] }],
});

const ADDRESS = {
  fullName: "Aisha Khan",
  mobile: "9999999999",
  addressLine1: "1 Market Road",
  city: "Mumbai",
  state: "MH",
  pincode: "400001",
  country: "India",
};

beforeEach(() => {
  findById.mockReset();
  findConfirmationDetails.mockReset();
  sendPurchaseConfirmationEmail.mockReset();
  recordSale.mockReset();
  recordSale.mockResolvedValue(undefined);
  sendPurchaseConfirmationEmail.mockResolvedValue(undefined);
  findConfirmationDetails.mockResolvedValue({ accountEmail: null, items: [] });
});

describe("who the confirmation goes to", () => {
  it("uses the address email when the buyer gave one", async () => {
    findById.mockResolvedValue(orderRow({ ...ADDRESS, email: "buyer@example.com" }));

    await orderService.onPaymentConfirmed("o1");

    expect(sendPurchaseConfirmationEmail.mock.calls[0][1]).toBe("buyer@example.com");
  });

  it("falls back to the account — the field is optional, so it is usually blank", async () => {
    // The bug: a signed-in buyer, whose verified address we hold, got nothing.
    findById.mockResolvedValue(orderRow(ADDRESS));
    findConfirmationDetails.mockResolvedValue({
      accountEmail: "account@example.com",
      items: [],
    });

    await orderService.onPaymentConfirmed("o1");

    expect(sendPurchaseConfirmationEmail.mock.calls[0][1]).toBe("account@example.com");
  });

  it("treats an empty string as no address, not as one to send to", async () => {
    findById.mockResolvedValue(orderRow({ ...ADDRESS, email: "" }));
    findConfirmationDetails.mockResolvedValue({
      accountEmail: "account@example.com",
      items: [],
    });

    await orderService.onPaymentConfirmed("o1");

    expect(sendPurchaseConfirmationEmail.mock.calls[0][1]).toBe("account@example.com");
  });

  it("sends nothing for a guest who gave no email, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    findById.mockResolvedValue(orderRow(ADDRESS));

    await orderService.onPaymentConfirmed("o1");

    expect(sendPurchaseConfirmationEmail).not.toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toContain("BB-1001");
    warn.mockRestore();
  });
});

describe("the send itself", () => {
  it("is awaited, so it cannot be killed by the function returning", async () => {
    findById.mockResolvedValue(orderRow({ ...ADDRESS, email: "buyer@example.com" }));
    let settled = false;
    sendPurchaseConfirmationEmail.mockImplementation(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            settled = true;
            resolve();
          }, 10)
        )
    );

    await orderService.onPaymentConfirmed("o1");

    expect(settled).toBe(true);
  });

  it("still does not fail a paid order when the provider is down", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    findById.mockResolvedValue(orderRow({ ...ADDRESS, email: "buyer@example.com" }));
    sendPurchaseConfirmationEmail.mockRejectedValue(new Error("Resend is down"));

    await expect(orderService.onPaymentConfirmed("o1")).resolves.toBeUndefined();
    error.mockRestore();
  });

  it("carries the order's lines, not just its totals", async () => {
    findById.mockResolvedValue(orderRow({ ...ADDRESS, email: "buyer@example.com" }));
    findConfirmationDetails.mockResolvedValue({
      accountEmail: null,
      items: [
        { productName: "Silk Abaya", quantity: 2, price: 64950, size: "M" },
        { productName: "Prayer Mat", quantity: 1, price: 19900 },
      ],
    });

    await orderService.onPaymentConfirmed("o1");

    expect(sendPurchaseConfirmationEmail.mock.calls[0][0].items).toEqual([
      { productName: "Silk Abaya", quantity: 2, unitPrice: 64950, size: "M", color: undefined },
      { productName: "Prayer Mat", quantity: 1, unitPrice: 19900, size: undefined, color: undefined },
    ]);
  });
});
