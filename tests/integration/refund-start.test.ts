/**
 * A refund owed for every cause, and the admin's button that starts it exactly once
 * (order-fulfilment (`431ed6e7:docs/specs/own-store/order-fulfilment/trd.md`) U6: D16, D17; spec R13, R14,
 * A9; Q12, Q25). The gateway is stubbed at its adapter; the row, the claim and the email are real.
 * Owns its fixtures: a migrated schema and nothing in it.
 */
import "dotenv/config";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { JOBS_QUEUE, JOBS_SCHEMA } from "@server/shared/jobs/jobs.config";

vi.mock("next-auth", () => ({ getServerSession: async () => null }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));

const PREFIX = "refund-start-";

describe.skipIf(!isDisposableDb)("a refund owed is started once", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let moveParcel: typeof import("@server/checkout/fulfilment.service").moveParcel;
  let cancelParcel: typeof import("@server/checkout/fulfilment-cancel").cancelParcel;
  let startRefund: typeof import("@server/checkout/refund-start").startRefund;
  let listRefunds: typeof import("@server/checkout/refund-queue").listRefunds;
  let buyerCancelView: typeof import("@server/checkout/buyer-cancel-view").buyerCancelView;
  let gateway: typeof import("@server/payments/providers/razorpay/razorpay.repository").razorpayRepository;
  let S: typeof import("@server/shipping/domain/shipping.types").SHIPMENT_STATUS;
  let A: typeof import("@server/shipping/domain/shipping.types").PARCEL_ACTOR;
  let K: typeof import("@server/notifications/notice.types").NOTICE_KIND;
  let R: typeof import("@server/payments/refund.types").REFUND_STATE;
  let ORDER_STATUS: typeof import("@server/checkout/order.types").ORDER_STATUS;
  let PAYMENT_STATUS: typeof import("@server/checkout/order.types").PAYMENT_STATUS;
  let fx: Awaited<ReturnType<typeof ensureFixtures>>;
  const orderIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ moveParcel } = await import("@server/checkout/fulfilment.service"));
    ({ cancelParcel } = await import("@server/checkout/fulfilment-cancel"));
    ({ startRefund } = await import("@server/checkout/refund-start"));
    ({ listRefunds } = await import("@server/checkout/refund-queue"));
    ({ buyerCancelView } = await import("@server/checkout/buyer-cancel-view"));
    ({ razorpayRepository: gateway } = await import("@server/payments/providers/razorpay/razorpay.repository"));
    ({ SHIPMENT_STATUS: S, PARCEL_ACTOR: A } = await import("@server/shipping/domain/shipping.types"));
    ({ NOTICE_KIND: K } = await import("@server/notifications/notice.types"));
    ({ REFUND_STATE: R } = await import("@server/payments/refund.types"));
    ({ ORDER_STATUS, PAYMENT_STATUS } = await import("@server/checkout/order.types"));
    fx = await ensureFixtures();
  });

  // The gateway is mocked per test; whether this machine has Razorpay keys must not decide the outcome.
  beforeEach(() => void vi.spyOn(gateway, "refundsConfigured").mockReturnValue(true));
  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    if (orderIds.length) {
      const inOrders = { orderId: { in: orderIds } };
      const refunds = await prisma.refund.findMany({ where: inOrders, select: { id: true } });
      await prisma.adminLog.deleteMany({ where: { resource: "Refund", resourceId: { in: refunds.map((r) => r.id) } } });
      const notices = await prisma.notice.findMany({ where: { shipment: inOrders }, select: { id: true } });
      if (notices.length) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'noticeId' = ANY($2)`,
          JOBS_QUEUE,
          notices.map((n) => n.id),
        );
      }
      await prisma.refund.deleteMany({ where: inOrders });
      await prisma.promotionBudgetRelease.deleteMany({ where: inOrders });
      await prisma.notice.deleteMany({ where: { shipment: inOrders } });
      await prisma.orgLedgerEntryLine.deleteMany({ where: { entry: inOrders } });
      await prisma.orgLedgerEntry.deleteMany({ where: inOrders });
      await prisma.parcelEvent.deleteMany({ where: { shipment: inOrders } });
      await prisma.shipmentItem.deleteMany({ where: { shipment: inOrders } });
      await prisma.shipment.deleteMany({ where: inOrders });
      await prisma.orderItem.deleteMany({ where: inOrders });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    await prisma.productStock.deleteMany({ where: { product: { name: { startsWith: PREFIX } } } });
    await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const staff = () => ({ id: fx.userId, name: "Staff" });

  /** A paid one-parcel order: a ₹1,290 item, ₹100 off, ₹50 shipping — ₹1,240 captured (spec A6, A9). */
  async function aPaidParcel() {
    const name = unique();
    const product = await prisma.product.create({
      data: {
        name, slug: name, description: "fixture", price: 129_000, thumbnail: "https://example.invalid/x.webp", weight: 0.5,
        categoryId: fx.categoryId, orgId: fx.orgId, stockLocations: { create: { orgAddressId: fx.orgAddressId, quantity: 0 } },
      },
      select: { id: true },
    });
    const order = await prisma.order.create({
      data: {
        code: `BB-${name.slice(-8).toUpperCase()}`, userId: fx.userId,
        address: { fullName: "Asha Buyer", email: "asha@example.invalid", city: "Pune", pincode: "411001" },
        itemsTotal: 129_000, shippingTotal: 5_000, discount: 10_000, grandTotal: 124_000,
        paymentStatus: PAYMENT_STATUS.PAID, status: ORDER_STATUS.CONFIRMED, paidAt: new Date(), paymentId: `pay_${name.slice(-10)}`,
      },
      select: { id: true, paymentId: true },
    });
    orderIds.push(order.id);
    const item = await prisma.orderItem.create({
      data: { orderId: order.id, productId: product.id, quantity: 1, unitPrice: 129_000, discountPaise: 10_000, orgFundedPaise: 0 },
      select: { id: true },
    });
    const parcel = await prisma.shipment.create({
      data: {
        code: `${name}-SH1`, orderId: order.id, orgId: fx.orgId, orgAddressId: fx.orgAddressId,
        fromPincode: "400001", fromCity: "Mumbai", fromState: "Maharashtra", shippingCost: 5_000,
        items: { create: [{ orderItemId: item.id, quantity: 1 }] },
      },
      select: { id: true },
    });
    return { orderId: order.id, paymentId: order.paymentId!, parcelId: parcel.id };
  }

  /** A cancelled parcel's refund row, OWED. */
  async function anOwedRefund() {
    const p = await aPaidParcel();
    await cancelParcel(p.parcelId, { actor: A.ADMIN, name: "Staff" }, "Out of stock");
    const row = await prisma.refund.findUniqueOrThrow({ where: { shipmentId: p.parcelId } });
    return { ...p, refundId: row.id };
  }

  async function pickedUp(parcelId: string) {
    await moveParcel(parcelId, S.READY_FOR_PICKUP, { actor: A.SHOP });
    await moveParcel(parcelId, S.PICKUP_BOOKED, { actor: A.ADMIN });
    await moveParcel(parcelId, S.PICKED_UP, { actor: A.COURIER });
  }

  const rowOf = (id: string) => prisma.refund.findUniqueOrThrow({ where: { id } });
  const startedNotices = (parcelId: string) => prisma.notice.count({ where: { shipmentId: parcelId, kind: K.REFUND_STARTED_BUYER } });

  it("Q25, R13: a parcel lost, damaged or returned to the shop owes its ₹1,240 once, by the cancel's rule", async () => {
    const lost = await aPaidParcel();
    await pickedUp(lost.parcelId);
    await moveParcel(lost.parcelId, S.LOST, { actor: A.COURIER });
    await moveParcel(lost.parcelId, S.LOST, { actor: A.COURIER });

    const damaged = await aPaidParcel();
    await pickedUp(damaged.parcelId);
    await moveParcel(damaged.parcelId, S.IN_TRANSIT, { actor: A.COURIER });
    await moveParcel(damaged.parcelId, S.DAMAGED, { actor: A.COURIER });

    const returned = await aPaidParcel();
    await pickedUp(returned.parcelId);
    await moveParcel(returned.parcelId, S.RTO_IN_TRANSIT, { actor: A.COURIER });
    expect(await prisma.refund.count({ where: { shipmentId: returned.parcelId } })).toBe(0);
    await moveParcel(returned.parcelId, S.RTO_DELIVERED, { actor: A.COURIER });

    for (const [p, cause] of [[lost, S.LOST], [damaged, S.DAMAGED], [returned, S.RTO_DELIVERED]] as const) {
      expect(await prisma.refund.findMany({ where: { orderId: p.orderId }, select: { amountPaise: true, cause: true, state: true } })).toEqual([
        { amountPaise: 124_000, cause, state: R.OWED },
      ]);
    }
  });

  it("R14: the admin's list names the order, the parcel and who cancelled it", async () => {
    const { refundId, paymentId } = await anOwedRefund();
    const rows = await listRefunds(1);
    const row = rows.find((r) => r.id === refundId);
    expect(row).toMatchObject({ amountPaise: 124_000, cause: S.CANCELLED, cancelledBy: A.ADMIN, state: R.OWED, paymentId, owedDays: 0 });
    expect(row?.orderCode).toMatch(/^BB-/);
    expect(row?.parcelCode).toMatch(/-SH1$/);
    // Not started comes before started, so the work is at the top.
    const firstStarted = rows.findIndex((r) => r.state === R.STARTED);
    if (firstStarted >= 0) expect(rows.slice(firstStarted).every((r) => r.state === R.STARTED)).toBe(true);
  });

  it("R14: starting it records the gateway's id, emails the buyer once, and shows on the buyer's order", async () => {
    const { refundId, orderId, paymentId, parcelId } = await anOwedRefund();
    const create = vi.spyOn(gateway, "createRefund").mockResolvedValue({ kind: "started", gatewayRefundId: "rfnd_A" });

    expect(await startRefund(refundId, staff())).toEqual({ kind: "started", gatewayRefundId: "rfnd_A", amountPaise: 124_000 });
    expect(create).toHaveBeenCalledWith({ paymentId, amount: 124_000, receipt: refundId });
    expect(await rowOf(refundId)).toMatchObject({ state: R.STARTED, gatewayRefundId: "rfnd_A" });
    expect(await startedNotices(parcelId)).toBe(1);

    const view = await buyerCancelView(orderId, true);
    expect(view.refunds[parcelId]).toMatchObject({ amountPaise: 124_000, started: true });
    expect(view.refunds[parcelId].startedDay).toBeTruthy();

    await expect(startRefund(refundId, { id: fx.userId, name: "Other" })).rejects.toThrow("Already started by Staff.");
    expect(create).toHaveBeenCalledTimes(1);
    expect(await startedNotices(parcelId)).toBe(1);
  });

  it("A9: a timeout leaves it unconfirmed; the retry finds the refund the gateway made and asks for none", async () => {
    const { refundId, paymentId, parcelId } = await anOwedRefund();
    const create = vi.spyOn(gateway, "createRefund").mockResolvedValue({ kind: "unknown" });
    const find = vi.spyOn(gateway, "findRefundByReceipt").mockResolvedValue({ kind: "started", gatewayRefundId: "rfnd_T" });

    expect(await startRefund(refundId, staff())).toEqual({ kind: "unconfirmed" });
    expect(await rowOf(refundId)).toMatchObject({ state: R.UNCONFIRMED, gatewayRefundId: null });
    expect(await startedNotices(parcelId)).toBe(0);

    expect(await startRefund(refundId, staff())).toMatchObject({ kind: "started", gatewayRefundId: "rfnd_T" });
    expect(find).toHaveBeenCalledWith(paymentId, refundId);
    expect(create).toHaveBeenCalledTimes(1);
    expect(await rowOf(refundId)).toMatchObject({ state: R.STARTED, gatewayRefundId: "rfnd_T" });
    expect(await startedNotices(parcelId)).toBe(1);
  });

  it("A9: a retry whose lookup fails stays unconfirmed rather than asking blind", async () => {
    const { refundId } = await anOwedRefund();
    const create = vi.spyOn(gateway, "createRefund").mockResolvedValue({ kind: "unknown" });
    vi.spyOn(gateway, "findRefundByReceipt").mockRejectedValue(new Error("Razorpay refunds lookup failed with 503"));
    await startRefund(refundId, staff());
    expect(await startRefund(refundId, staff())).toEqual({ kind: "unconfirmed" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("A9: two presses at once ask the gateway once; the other is told it was already started", async () => {
    const { refundId, parcelId } = await anOwedRefund();
    const create = vi.spyOn(gateway, "createRefund").mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 150));
      return { kind: "started", gatewayRefundId: "rfnd_C" };
    });
    const both = await Promise.allSettled([startRefund(refundId, staff()), startRefund(refundId, staff())]);
    expect(both.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = both.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(lost.reason.message)).toMatch(/^Already started by (Staff|another admin)\.$/);
    expect(create).toHaveBeenCalledTimes(1);
    expect(await startedNotices(parcelId)).toBe(1);
  });

  it("a refusal is FAILED with Razorpay's reason; trying again asks again", async () => {
    const { refundId } = await anOwedRefund();
    const create = vi.spyOn(gateway, "createRefund").mockResolvedValueOnce({ kind: "refused", reason: "The payment has been fully refunded already" });
    expect(await startRefund(refundId, staff())).toEqual({ kind: "refused", reason: "The payment has been fully refunded already" });
    expect(await rowOf(refundId)).toMatchObject({ state: R.FAILED, failureReason: "The payment has been fully refunded already" });

    vi.spyOn(gateway, "findRefundByReceipt").mockResolvedValue(null);
    create.mockResolvedValueOnce({ kind: "started", gatewayRefundId: "rfnd_F" });
    expect(await startRefund(refundId, staff())).toMatchObject({ kind: "started" });
    expect(await rowOf(refundId)).toMatchObject({ state: R.STARTED, failureReason: null });
  });

  it("Q38: no captured payment, or no Razorpay keys, is refused in our words with the row untouched and nothing sent", async () => {
    const { refundId, orderId } = await anOwedRefund();
    const create = vi.spyOn(gateway, "createRefund");
    vi.mocked(gateway.refundsConfigured).mockReturnValue(false);
    await expect(startRefund(refundId, staff())).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/^Razorpay keys aren't set/) });
    vi.mocked(gateway.refundsConfigured).mockReturnValue(true);
    await prisma.order.update({ where: { id: orderId }, data: { paymentId: null } });
    await expect(startRefund(refundId, staff())).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/^This order has no captured Razorpay payment/) });
    expect(create).not.toHaveBeenCalled();
    expect(await rowOf(refundId)).toMatchObject({ state: R.OWED, failureReason: null, requestedAt: null });
  });

  it("D17: a request whose answer never came reads unconfirmed after 2 min, and its retry looks first", async () => {
    const { refundId } = await anOwedRefund();
    await prisma.refund.update({ where: { id: refundId }, data: { state: R.REQUESTED, requestedAt: new Date(Date.now() - 60_000) } });
    await expect(startRefund(refundId, staff())).rejects.toThrow(/^Already started by /);

    await prisma.refund.update({ where: { id: refundId }, data: { requestedAt: new Date(Date.now() - 3 * 60_000) } });
    expect((await listRefunds(1)).find((r) => r.id === refundId)?.state).toBe(R.UNCONFIRMED);
    const create = vi.spyOn(gateway, "createRefund");
    vi.spyOn(gateway, "findRefundByReceipt").mockResolvedValue({ kind: "started", gatewayRefundId: "rfnd_S" });
    expect(await startRefund(refundId, staff())).toMatchObject({ kind: "started", gatewayRefundId: "rfnd_S" });
    expect(create).not.toHaveBeenCalled();
  });

  it("D17: a late answer to a request already retried does not overwrite the retry's", async () => {
    const { refundId, parcelId } = await anOwedRefund();
    vi.spyOn(gateway, "findRefundByReceipt").mockResolvedValue({ kind: "started", gatewayRefundId: "rfnd_retry" });
    vi.spyOn(gateway, "createRefund").mockImplementation(async () => {
      // While the first press waits, its request goes stale and a second press adopts the refund.
      await prisma.refund.update({ where: { id: refundId }, data: { requestedAt: new Date(Date.now() - 3 * 60_000) } });
      await startRefund(refundId, staff());
      return { kind: "started", gatewayRefundId: "rfnd_late" };
    });
    await expect(startRefund(refundId, staff())).rejects.toThrow(/^Already started by /);
    expect(await rowOf(refundId)).toMatchObject({ state: R.STARTED, gatewayRefundId: "rfnd_retry" });
    expect(await startedNotices(parcelId)).toBe(1);
  });

  it("an unknown refund is not-found", async () => {
    await expect(startRefund("no-such-refund", staff())).rejects.toMatchObject({ status: 404 });
  });
});
