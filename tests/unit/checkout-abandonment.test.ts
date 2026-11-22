/**
 * checkout-abandonment: closing the payment window used to leave the goods held
 * until a once-a-day sweep noticed, and the half-finished order showing in the
 * panels as business. These cover the release decision (R1–R3) and the visibility
 * rule (R4/R5).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrderById = vi.fn();
const expireAndRestock = vi.fn();
const confirmPaid = vi.fn();
const fetchOrderPaymentState = vi.fn();
const findAbandonableHoldsForProducts = vi.fn();
const onPaymentConfirmed = vi.fn();
const recordUnmatched = vi.fn();

vi.mock("@server/payments/refund.service", () => ({
  refundService: { recordUnmatched: (row: unknown) => recordUnmatched(row) },
}));

vi.mock("@server/checkout/order.service", () => ({
  orderService: {
    getOrderById: (id: string) => getOrderById(id),
    onPaymentConfirmed: (id: string) => onPaymentConfirmed(id),
  },
}));

vi.mock("@server/checkout/order.repository", () => ({
  orderRepository: {
    expireAndRestock: (id: string) => expireAndRestock(id),
    confirmPaid: (id: string, paymentId: string) => confirmPaid(id, paymentId),
    attachGatewayOrder: vi.fn(),
    markPaymentFailed: vi.fn(),
    findStuckPendingOrders: vi.fn(),
    findAbandonableHoldsForProducts: (ids: string[], older: Date) =>
      findAbandonableHoldsForProducts(ids, older),
  },
}));

vi.mock("@server/payments/providers/razorpay/razorpay.repository", () => ({
  razorpayRepository: {
    fetchOrderPaymentState: (id: string) => fetchOrderPaymentState(id),
    createOrder: vi.fn(),
    verifyPayment: vi.fn(),
  },
}));

const { paymentService } = await import("@server/payments/payment.service");

const unpaidOrder = {
  id: "order-1",
  userId: null,
  status: "pending_payment",
  paymentStatus: "pending",
  paymentId: null,
  gatewayOrderId: "gw-1",
  grandTotal: 250_00,
  // Past the hold window, so only the gateway's answer decides.
  createdAt: new Date(Date.now() - 60 * 60_000),
};

const freshOrder = () => ({ ...unpaidOrder, createdAt: new Date(Date.now() - 2 * 60_000) });

beforeEach(() => {
  vi.clearAllMocks();
  getOrderById.mockResolvedValue({ ...unpaidOrder });
  expireAndRestock.mockResolvedValue(true);
});

describe("releaseIfUnpaid", () => {
  it("releases when the gateway reports nothing was ever captured", async () => {
    fetchOrderPaymentState.mockResolvedValue({ kind: "none" });

    const result = await paymentService.releaseIfUnpaid("order-1");

    expect(result.outcome).toBe("released");
    expect(expireAndRestock).toHaveBeenCalledWith("order-1");
  });

  it("holds the reservation while a payment is still in flight (R2)", async () => {
    // The UPI case: the buyer closed our window and is approving in their bank app.
    fetchOrderPaymentState.mockResolvedValue({ kind: "in-flight" });

    const result = await paymentService.releaseIfUnpaid("order-1");

    expect(result.outcome).toBe("in-flight");
    expect(expireAndRestock).not.toHaveBeenCalled();
  });

  it("confirms rather than releases when the gateway reports a capture", async () => {
    fetchOrderPaymentState.mockResolvedValue({
      kind: "captured",
      paymentId: "pay-9",
      amount: 250_00,
    });
    confirmPaid.mockResolvedValue(true);

    const result = await paymentService.releaseIfUnpaid("order-1");

    expect(result.outcome).toBe("confirmed");
    expect(confirmPaid).toHaveBeenCalledWith("order-1", "pay-9");
    expect(expireAndRestock).not.toHaveBeenCalled();
  });

  it("never asks the gateway about an order that is already paid", async () => {
    getOrderById.mockResolvedValue({ ...unpaidOrder, paymentStatus: "paid" });

    const result = await paymentService.releaseIfUnpaid("order-1");

    expect(result.outcome).toBe("already-paid");
    expect(fetchOrderPaymentState).not.toHaveBeenCalled();
    expect(expireAndRestock).not.toHaveBeenCalled();
  });

  it("releases without a gateway call when no payment order was ever created", async () => {
    getOrderById.mockResolvedValue({ ...unpaidOrder, gatewayOrderId: null });

    const result = await paymentService.releaseIfUnpaid("order-1");

    expect(result.outcome).toBe("released");
    expect(fetchOrderPaymentState).not.toHaveBeenCalled();
  });

  it("refuses a signed-in caller who does not own the order (D3)", async () => {
    getOrderById.mockResolvedValue({ ...unpaidOrder, userId: "owner" });

    await expect(
      paymentService.releaseIfUnpaid("order-1", { userId: "someone-else" })
    ).rejects.toThrow(/not found/i);
    expect(expireAndRestock).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller on an owned order, rather than skipping the check", async () => {
    // "if (userId && ...)" is not a guard: the absent identity must fail, not pass.
    getOrderById.mockResolvedValue({ ...unpaidOrder, userId: "owner" });

    await expect(
      paymentService.releaseIfUnpaid("order-1", { userId: null })
    ).rejects.toThrow(/not found/i);
  });

  it("holds a fresh order whose failed attempt can still be retried on the same gateway order", async () => {
    // The phone case: a PhonePe attempt failed, the browser asked to release, and the buyer
    // paid again on the same gateway order minutes later. Releasing then refused that payment.
    getOrderById.mockResolvedValue(freshOrder());
    fetchOrderPaymentState.mockResolvedValue({ kind: "none" });

    const result = await paymentService.releaseIfUnpaid("order-1");

    expect(result.outcome).toBe("still-payable");
    expect(expireAndRestock).not.toHaveBeenCalled();
  });

  it("still confirms a fresh order the gateway reports captured", async () => {
    getOrderById.mockResolvedValue(freshOrder());
    fetchOrderPaymentState.mockResolvedValue({ kind: "captured", paymentId: "pay-9", amount: 250_00 });
    confirmPaid.mockResolvedValue(true);

    const result = await paymentService.releaseIfUnpaid("order-1");

    expect(result.outcome).toBe("confirmed");
  });

  it("releases a fresh order that never got a gateway order — nothing can be paid on it", async () => {
    getOrderById.mockResolvedValue({ ...freshOrder(), gatewayOrderId: null });

    const result = await paymentService.releaseIfUnpaid("order-1");

    expect(result.outcome).toBe("released");
  });

  it("lets a guest order be released by whoever holds its id", async () => {
    fetchOrderPaymentState.mockResolvedValue({ kind: "none" });

    const result = await paymentService.releaseIfUnpaid("order-1", { userId: null });

    expect(result.outcome).toBe("released");
  });
});

describe("releaseHoldsOnProducts", () => {
  it("reports whether anything actually came back", async () => {
    findAbandonableHoldsForProducts.mockResolvedValue([{ id: "order-1" }]);
    fetchOrderPaymentState.mockResolvedValue({ kind: "none" });

    await expect(paymentService.releaseHoldsOnProducts(["p1"])).resolves.toBe(true);
  });

  it("reports nothing released when the holds are still in flight", async () => {
    findAbandonableHoldsForProducts.mockResolvedValue([{ id: "order-1" }]);
    fetchOrderPaymentState.mockResolvedValue({ kind: "in-flight" });

    await expect(paymentService.releaseHoldsOnProducts(["p1"])).resolves.toBe(false);
  });

  it("does not fail a waiting buyer's checkout when the gateway is unreachable", async () => {
    findAbandonableHoldsForProducts.mockResolvedValue([{ id: "order-1" }]);
    fetchOrderPaymentState.mockRejectedValue(new Error("gateway down"));

    await expect(paymentService.releaseHoldsOnProducts(["p1"])).resolves.toBe(false);
  });
});

describe("order codes (ADR-0025)", () => {
  it("draws only from the unambiguous alphabet, at a fixed length", async () => {
    const { generateOrderCode, ORDER_CODE_ALPHABET, ORDER_CODE_LENGTH } = await import(
      "@server/checkout/order-code"
    );

    for (let i = 0; i < 500; i++) {
      const code = generateOrderCode();
      expect(code.startsWith("BB-")).toBe(true);
      const body = code.slice(3);
      expect(body).toHaveLength(ORDER_CODE_LENGTH);
      for (const char of body) expect(ORDER_CODE_ALPHABET).toContain(char);
    }
  });

  it("omits the characters people misread — I, L, O, U, 0, 1", async () => {
    const { ORDER_CODE_ALPHABET } = await import("@server/checkout/order-code");
    for (const char of "ILOU01") expect(ORDER_CODE_ALPHABET).not.toContain(char);
  });

  it("does not repeat itself across a realistic run of orders", async () => {
    const { generateOrderCode } = await import("@server/checkout/order-code");
    const codes = new Set(Array.from({ length: 5_000 }, generateOrderCode));
    expect(codes.size).toBe(5_000);
  });

  it("generates codes the lookup form accepts, and still accepts the old ones", async () => {
    // The generator and the validation pattern are declared separately so the
    // pattern can stay out of the client bundle; this is what binds them.
    const { generateOrderCode } = await import("@server/checkout/order-code");
    const { orderLookupSchema } = await import("@/lib/validation/schemas/order.schemas");

    for (let i = 0; i < 200; i++) {
      expect(orderLookupSchema.safeParse({ code: generateOrderCode() }).success).toBe(true);
    }
    expect(orderLookupSchema.safeParse({ code: "BB-1001" }).success).toBe(true);
    expect(orderLookupSchema.safeParse({ code: "BB-IL0U1234" }).success).toBe(false);
  });
});

describe("a payment captured after its order was released (unmatched-payments)", () => {
  const capture = { localOrderId: "order-1", gatewayOrderId: "gw-1", paymentId: "pay-late", amount: 250_00 };

  beforeEach(() => {
    confirmPaid.mockResolvedValue(false);
    getOrderById
      .mockResolvedValueOnce({ ...unpaidOrder })
      .mockResolvedValueOnce({ ...unpaidOrder, status: "expired" });
    recordUnmatched.mockResolvedValue(true);
  });

  it("records the webhook's capture as owed back, for the amount captured, and answers rather than throws (R1, D1, D4)", async () => {
    const result = await paymentService.confirmPayment(capture);

    expect(recordUnmatched).toHaveBeenCalledWith({ orderId: "order-1", gatewayPaymentId: "pay-late", amountPaise: 250_00 });
    expect(result).toMatchObject({ recordedUnmatched: true });
    expect(onPaymentConfirmed).not.toHaveBeenCalled();
  });

  it("records nothing from the browser's return, which cannot tell authorised from captured (D1)", async () => {
    const { amount: _amount, ...browser } = capture;
    void _amount;
    await expect(paymentService.confirmPayment(browser)).rejects.toThrow(/released before this payment/i);
    expect(recordUnmatched).not.toHaveBeenCalled();
  });

  it("records nothing when the order lost to another payment rather than to the release (D2)", async () => {
    getOrderById.mockReset();
    getOrderById
      .mockResolvedValueOnce({ ...unpaidOrder })
      .mockResolvedValueOnce({ ...unpaidOrder, paymentStatus: "paid", paymentId: "pay-other" });

    await expect(paymentService.confirmPayment(capture)).rejects.toThrow(/different payment/i);
    expect(recordUnmatched).not.toHaveBeenCalled();
  });

  it("still confirms a capture for an order that was not released (A6)", async () => {
    getOrderById.mockReset();
    getOrderById.mockResolvedValue({ ...unpaidOrder });
    confirmPaid.mockResolvedValue(true);

    const result = await paymentService.confirmPayment(capture);

    expect(result).toMatchObject({ paymentStatus: "paid", alreadyConfirmed: false });
    expect(recordUnmatched).not.toHaveBeenCalled();
  });
});

describe("a gateway lookup that races the release (unmatched-payments D2)", () => {
  it("reports the order released, not confirmed, when the capture is recorded as owed back", async () => {
    fetchOrderPaymentState.mockResolvedValue({ kind: "captured", paymentId: "pay-race", amount: 250_00 });
    confirmPaid.mockResolvedValue(false);
    recordUnmatched.mockResolvedValue(true);
    getOrderById
      .mockResolvedValueOnce({ ...unpaidOrder })
      .mockResolvedValueOnce({ ...unpaidOrder })
      .mockResolvedValueOnce({ ...unpaidOrder, status: "expired" });

    const result = await paymentService.releaseIfUnpaid("order-1");

    expect(result.outcome).toBe("already-released");
    expect(recordUnmatched).toHaveBeenCalledOnce();
    expect(expireAndRestock).not.toHaveBeenCalled();
  });
});
