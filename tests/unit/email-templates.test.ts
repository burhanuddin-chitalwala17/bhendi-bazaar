import { describe, expect, it } from "vitest";

import { getPasswordResetEmailTemplate } from "@server/notifications/templates/passwordResetEmail";
import { getPayoutEmailTemplate } from "@server/notifications/templates/payoutEmail";
import {
  getPurchaseConfirmationEmailTemplate,
  type OrderEmailView,
} from "@server/notifications/templates/purchaseConfirmationEmail";
import { getVerificationEmailTemplate } from "@server/notifications/templates/verificationEmail";
import { esc, renderEmail } from "@server/notifications/templates/layout";

const order: OrderEmailView = {
  id: "ord_1",
  code: "BB-1001",
  status: "confirmed",
  paymentStatus: "paid",
  createdAt: new Date("2026-09-01T10:00:00Z"),
  notes: null,
  items: [
    { name: "Abaya", quantity: 2, unitPrice: 120000, totalPrice: 240000, size: "M" },
  ],
  itemsTotal: 240000,
  discount: 20000,
  grandTotal: 220000,
  address: {
    fullName: "Aisha Khan",
    mobile: "9876543210",
    addressLine1: "12 Mohammed Ali Road",
    city: "Mumbai",
    state: "MH",
    pincode: "400003",
    country: "India",
  },
  shipments: [],
};

const emails = {
  verification: () => getVerificationEmailTemplate("https://x.test/verify?token=t"),
  passwordReset: () => getPasswordResetEmailTemplate("https://x.test/reset?token=t", "Aisha"),
  purchase: () => getPurchaseConfirmationEmailTemplate(order),
  payout: () =>
    getPayoutEmailTemplate({
      orgId: "org_1",
      orgName: "Zam Zam Boutique",
      code: "STL-7",
      amountPaise: 500000,
      reference: "UTR123",
      paidAt: new Date("2026-09-02T10:00:00Z"),
    }),
};

describe("every transactional email renders through the one shell", () => {
  it.each(Object.entries(emails))("%s carries the shared chrome", (_name, render) => {
    const html = render();

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<h1 class="logo">Bhendi Bazaar</h1>');
    expect(html).toContain("email-wrapper");
    // One shell per email: the layout owns the wrapper, so a template cannot nest a second.
    expect(html.match(/class="email-wrapper"/g)).toHaveLength(1);
    expect(html.match(/<!DOCTYPE html>/g)).toHaveLength(1);
    expect(html).toContain(`&copy; ${new Date().getFullYear()} Bhendi Bazaar`);
  });
});

describe("escaping", () => {
  it("neutralises markup arriving in customer-typed fields", () => {
    const html = getPurchaseConfirmationEmailTemplate({
      ...order,
      notes: "<script>alert(1)</script>",
      address: { ...order.address, fullName: 'Ali "Bob" & <b>Co</b>' },
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Ali &quot;Bob&quot; &amp; &lt;b&gt;Co&lt;/b&gt;");
  });

  it("escapes ampersands before the entities it introduces", () => {
    expect(esc("Tom & <Jerry>")).toBe("Tom &amp; &lt;Jerry&gt;");
  });
});

describe("layout options", () => {
  it("omits the banner and the footer links when a template asks for neither", () => {
    const html = renderEmail({ title: "Plain", body: "<p>hi</p>" });

    expect(html).not.toContain('<div class="success-banner">');
    expect(html).not.toContain('class="social-link"');
    expect(html).toContain("Royal Curation of Islamic Clothing");
  });
});

describe("money", () => {
  it("renders paise as rupees, not as raw integers", () => {
    const html = getPurchaseConfirmationEmailTemplate(order);

    expect(html).toContain("2,400");
    expect(html).toContain("2,200");
    expect(html).not.toContain("240000");
  });
});
