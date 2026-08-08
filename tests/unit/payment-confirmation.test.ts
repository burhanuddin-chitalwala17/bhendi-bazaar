// Payment state transitions are a 100% target, and per the TRD these tests are the
// deliverable — the fix is the easy part (ADR-0005). The decision is pure, so every
// branch runs without a database; the transition's race is database behaviour and is
// covered by the conditional-write shape instead (TESTING.md § untestable).
import { describe, expect, it } from "vitest";
import { decideConfirmation, type OrderPaymentState } from "@server/payments/confirmation";
import { RAZORPAY_NOTES_ORDER_KEY } from "@server/payments/notes";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const order = (overrides: Partial<OrderPaymentState> = {}): OrderPaymentState => ({
  paymentStatus: "pending",
  paymentId: null,
  grandTotal: 360000, // ₹3,600 in paise
  gatewayOrderId: "order_rzp_1",
  ...overrides,
});

describe("decideConfirmation", () => {
  it("confirms a matching payment against a pending order", () => {
    expect(
      decideConfirmation(order(), {
        paymentId: "pay_1",
        gatewayOrderId: "order_rzp_1",
        amount: 360000,
      })
    ).toEqual({ kind: "confirm" });
  });

  it("treats the same payment arriving again as success with no side effects", () => {
    // Webhook-first and browser-first both converge here: whichever loses the race
    // sees a paid order carrying its own payment id.
    expect(
      decideConfirmation(order({ paymentStatus: "paid", paymentId: "pay_1" }), {
        paymentId: "pay_1",
        gatewayOrderId: "order_rzp_1",
      })
    ).toEqual({ kind: "already-confirmed" });
  });

  it("rejects a DIFFERENT payment against an already-paid order — that is an incident, not idempotency", () => {
    const decision = decideConfirmation(
      order({ paymentStatus: "paid", paymentId: "pay_1" }),
      { paymentId: "pay_2", gatewayOrderId: "order_rzp_1" }
    );
    expect(decision.kind).toBe("reject");
  });

  it("rejects a valid-looking signal for a different gateway order", () => {
    const decision = decideConfirmation(order(), {
      paymentId: "pay_1",
      gatewayOrderId: "order_rzp_OTHER",
      amount: 360000,
    });
    expect(decision.kind).toBe("reject");
  });

  it("rejects when the order never got a gateway order attached", () => {
    const decision = decideConfirmation(order({ gatewayOrderId: null }), {
      paymentId: "pay_1",
      gatewayOrderId: "order_rzp_1",
    });
    expect(decision.kind).toBe("reject");
  });

  it("rejects an amount mismatch in either direction", () => {
    for (const amount of [350000, 370000]) {
      const decision = decideConfirmation(order(), {
        paymentId: "pay_1",
        gatewayOrderId: "order_rzp_1",
        amount,
      });
      expect(decision.kind).toBe("reject");
    }
  });

  it("accepts the browser return, which carries no amount — the persisted gateway-order link is its amount check", () => {
    expect(
      decideConfirmation(order(), { paymentId: "pay_1", gatewayOrderId: "order_rzp_1" })
    ).toEqual({ kind: "confirm" });
  });
});

describe("the notes contract (trd.md D6)", () => {
  it("creation writes and the webhook reads the SAME key, via the shared constant", () => {
    // The original defect: creation wrote `orderId`, the webhook read `localOrderId`,
    // and every webhook silently no-op'd — while returning 200.
    const repository = readFileSync(
      "server/payments/providers/razorpay/razorpay.repository.ts",
      "utf8"
    );
    const service = readFileSync("server/payments/payment.service.ts", "utf8");

    expect(repository).toContain("[RAZORPAY_NOTES_ORDER_KEY]: input.localOrderId");
    expect(service.match(/RAZORPAY_NOTES_ORDER_KEY/g)!.length).toBeGreaterThanOrEqual(2);
    expect(RAZORPAY_NOTES_ORDER_KEY).toBe("localOrderId");
  });
});

describe("signature comparison (trd.md D8)", () => {
  it("no verify path compares signatures with ===", () => {
    const source = readFileSync(
      "server/payments/providers/razorpay/razorpay.repository.ts",
      "utf8"
    );
    expect(source).not.toMatch(/expectedSignature\s*===/);
    expect(source).toContain("timingSafeEqual");
  });

  it("timingSafeEqual agrees with equality for the hmac shapes we compare", () => {
    const secret = "test-secret";
    const sign = (text: string) =>
      crypto.createHmac("sha256", secret).update(text).digest("hex");
    const a = sign("order_1|pay_1");

    const match = (x: string, y: string) =>
      x.length === y.length &&
      crypto.timingSafeEqual(Buffer.from(x, "utf8"), Buffer.from(y, "utf8"));

    expect(match(a, sign("order_1|pay_1"))).toBe(true);
    expect(match(a, sign("order_1|pay_2"))).toBe(false);
    expect(match(a, "short")).toBe(false);
  });
});
