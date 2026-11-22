/**
 * A payment captured after its order was released is owed back and refunded once
 * (payment-confirmation/unmatched-payments R1–R7, A1–A6). The gateway is stubbed at its
 * adapter; the order, the row, the claim and the list are real.
 */
import "dotenv/config";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

vi.mock("next-auth", () => ({ getServerSession: async () => null }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));

describe.skipIf(!isDisposableDb)("a payment captured after its order was released", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let paymentService: typeof import("@server/payments/payment.service").paymentService;
  let refundService: typeof import("@server/payments/refund.service").refundService;
  let startRefund: typeof import("@server/checkout/refund-start").startRefund;
  let listRefunds: typeof import("@server/checkout/refund-queue").listRefunds;
  let gateway: typeof import("@server/payments/providers/razorpay/razorpay.repository").razorpayRepository;
  let NOTES_KEY: string;
  let fx: Awaited<ReturnType<typeof ensureFixtures>>;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const orderIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ paymentService } = await import("@server/payments/payment.service"));
    ({ refundService } = await import("@server/payments/refund.service"));
    ({ startRefund } = await import("@server/checkout/refund-start"));
    ({ listRefunds } = await import("@server/checkout/refund-queue"));
    ({ razorpayRepository: gateway } = await import("@server/payments/providers/razorpay/razorpay.repository"));
    ({ RAZORPAY_NOTES_ORDER_KEY: NOTES_KEY } = await import("@server/payments/notes"));
    fx = await ensureFixtures();
  });

  beforeEach(() => void vi.spyOn(gateway, "refundsConfigured").mockReturnValue(true));
  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    const refunds = await prisma.refund.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } });
    await prisma.adminLog.deleteMany({ where: { resource: "Refund", resourceId: { in: refunds.map((r) => r.id) } } });
    await prisma.refund.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  });

  /** An order the sweep released, holding its gateway order: ₹220.72, as the buyer was charged. */
  async function aReleasedOrder(n: number) {
    const order = await prisma.order.create({
      data: { code: `UNM-${stamp}-${n}`, address: {}, status: "expired", paymentStatus: "pending", grandTotal: 220_72, gatewayOrderId: `order_late_${stamp}_${n}` },
      select: { id: true, code: true, gatewayOrderId: true },
    });
    orderIds.push(order.id);
    return order;
  }

  const capturedFor = (order: { id: string; gatewayOrderId: string | null }, paymentId: string) => ({
    id: paymentId,
    order_id: order.gatewayOrderId ?? "",
    amount: 220_72,
    notes: { [NOTES_KEY]: order.id },
  });

  it("records the capture once, however often it is reported, and leaves the order released (A1, A3, A5)", async () => {
    const order = await aReleasedOrder(1);
    const paymentId = `pay_late_${stamp}_1`;

    for (let i = 0; i < 3; i++) {
      await expect(paymentService.confirmFromWebhookEvent(capturedFor(order, paymentId))).resolves.toMatchObject({ recordedUnmatched: true });
    }

    const rows = await prisma.refund.findMany({ where: { orderId: order.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ shipmentId: null, gatewayPaymentId: paymentId, amountPaise: 220_72, cause: "paid_after_release", state: "OWED" });

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true, paymentStatus: true, paymentId: true } });
    expect(after).toEqual({ status: "expired", paymentStatus: "pending", paymentId: null });
  });

  it("shows on the admin's list with its order and payment, and no parcel (A1)", async () => {
    const order = await aReleasedOrder(2);
    const paymentId = `pay_late_${stamp}_2`;
    await paymentService.confirmFromWebhookEvent(capturedFor(order, paymentId));
    const [row] = await prisma.refund.findMany({ where: { orderId: order.id }, select: { id: true } });

    const listed = (await listRefunds(1)).find((r) => r.id === row.id);
    expect(listed).toMatchObject({ orderCode: order.code, parcelCode: null, paymentId, amountPaise: 220_72, cause: "paid_after_release" });
  });

  it("refunds the captured payment once when pressed twice at once, and sends no parcel notice (A2, A4)", async () => {
    const order = await aReleasedOrder(3);
    const paymentId = `pay_late_${stamp}_3`;
    await paymentService.confirmFromWebhookEvent(capturedFor(order, paymentId));
    const [row] = await prisma.refund.findMany({ where: { orderId: order.id }, select: { id: true } });
    const create = vi.spyOn(gateway, "createRefund").mockResolvedValue({ kind: "started", gatewayRefundId: `rfnd_${stamp}` });

    const presses = await Promise.allSettled([
      startRefund(row.id, { id: fx.userId, name: "Staff" }),
      startRefund(row.id, { id: fx.userId, name: "Staff" }),
    ]);

    expect(presses.filter((p) => p.status === "fulfilled")).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ paymentId, amount: 220_72, receipt: row.id });
    expect(await prisma.refund.findUniqueOrThrow({ where: { id: row.id }, select: { state: true } })).toEqual({ state: "STARTED" });
  });

  it("is not counted against a paid order's parcel refunds (D6)", async () => {
    const order = await aReleasedOrder(4);
    await paymentService.confirmFromWebhookEvent(capturedFor(order, `pay_late_${stamp}_4`));

    expect(await refundService.owedSoFar(order.id, prisma)).toBe(0);
    expect(await refundService.forOrder(order.id)).toEqual([]);
  });
});
