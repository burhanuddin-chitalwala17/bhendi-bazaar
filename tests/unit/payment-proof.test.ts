/**
 * Proof of money that moved outside the platform (ai-images/shop-credits D6–D8, Q17, Q18, Q36): a
 * top-up and a paid settlement need method, reference and date; a receipt or QR is our own picture;
 * a top-up is at most ₹10,00,000.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@server/catalog/object-store", () => ({ isOwnObjectUrl: (url: string) => url.startsWith("https://img.test/") }));

const { paymentDetailsSchema, settlementStatusSchema, topUpSchema } = await import("@/lib/validation/schemas/credit.schema");

const proof = { method: "UPI", reference: "UTR123", paidOn: "2026-11-20" };

describe("a top-up", () => {
  it("takes the amount and its proof, receipt optional", () => {
    expect(topUpSchema.parse({ ...proof, amountPaise: 100_000 })).toMatchObject({ amountPaise: 100_000, reference: "UTR123", receiptRef: null });
  });

  it("is refused without a reference (spec A2)", () => {
    expect(() => topUpSchema.parse({ ...proof, reference: " ", amountPaise: 100_000 })).toThrow(/transaction reference/);
  });

  it("is refused above ₹10,00,000, at zero, and in fractions of a paisa", () => {
    expect(() => topUpSchema.parse({ ...proof, amountPaise: 100_000_001 })).toThrow(/₹10,00,000/);
    expect(() => topUpSchema.parse({ ...proof, amountPaise: 0 })).toThrow(/above zero/);
    expect(() => topUpSchema.parse({ ...proof, amountPaise: 10.5 })).toThrow(/Whole paise/);
  });

  it("is refused with a payment date in the future, or a receipt hosted elsewhere", () => {
    expect(() => topUpSchema.parse({ ...proof, paidOn: "2999-01-01", amountPaise: 100 })).toThrow(/future/);
    expect(() => topUpSchema.parse({ ...proof, amountPaise: 100, receiptRef: "https://evil.test/r.png" })).toThrow(/Upload the picture/);
    expect(topUpSchema.parse({ ...proof, amountPaise: 100, receiptRef: "https://img.test/r.png" }).receiptRef).toBe("https://img.test/r.png");
  });
});

describe("a settlement recorded paid (Q18)", () => {
  it("needs the same proof", () => {
    expect(() => settlementStatusSchema.parse({ status: "PAID" })).toThrow(/Invalid option|expected/);
    expect(settlementStatusSchema.parse({ status: "PAID", ...proof, method: "BANK_TRANSFER" })).toMatchObject({ status: "PAID", method: "BANK_TRANSFER" });
  });

  it("can be cancelled with nothing", () => {
    expect(settlementStatusSchema.parse({ status: "CANCELLED" })).toEqual({ status: "CANCELLED" });
  });
});

describe("the platform's payment details (Q35)", () => {
  it("keeps what is given, upper-cases an IFSC, and turns blanks into nothing", () => {
    expect(
      paymentDetailsSchema.parse({ upiId: "bhendi@okhdfc", ifsc: "hdfc0001234", accountNumber: "50100123456789", accountName: "", bankName: null }),
    ).toEqual({ upiId: "bhendi@okhdfc", qrRef: null, accountName: null, accountNumber: "50100123456789", ifsc: "HDFC0001234", bankName: null });
  });

  it("refuses what cannot be a UPI id, an account number or an IFSC", () => {
    expect(() => paymentDetailsSchema.parse({ upiId: "bhendi" })).toThrow(/name@bank/);
    expect(() => paymentDetailsSchema.parse({ accountNumber: "12-34" })).toThrow(/Digits only/);
    expect(() => paymentDetailsSchema.parse({ ifsc: "HDFC1234" })).toThrow(/11 characters/);
  });
});
