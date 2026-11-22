/**
 * A buyer whose payment failed showed as having spent the order's total in the admin console:
 * every order was summed, abandoned checkouts included (checkout-abandonment R4).
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isDisposableDb } from "../helpers/test-db";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";

describe.skipIf(!isDisposableDb)("admin user spend (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let repo: typeof import("@server/identity/admin.user.repository").adminUserRepository;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  let userId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ adminUserRepository: repo } = await import("@server/identity/admin.user.repository"));
    const user = await prisma.user.create({ data: { name: "Spend Buyer", email: `spend-${stamp}@example.invalid` }, select: { id: true } });
    userId = user.id;

    const orders = [
      { n: 1, status: ORDER_STATUS.DELIVERED, paymentStatus: PAYMENT_STATUS.PAID, grandTotal: 100_00 },
      { n: 2, status: ORDER_STATUS.EXPIRED, paymentStatus: PAYMENT_STATUS.PENDING, grandTotal: 220_72 },
      { n: 3, status: ORDER_STATUS.PENDING_PAYMENT, paymentStatus: PAYMENT_STATUS.PENDING, grandTotal: 50_00 },
      { n: 4, status: ORDER_STATUS.CANCELLED, paymentStatus: PAYMENT_STATUS.PAID, grandTotal: 70_00 },
    ];
    for (const o of orders) {
      await prisma.order.create({
        data: {
          code: `SPD${stamp}-${o.n}`,
          userId,
          status: o.status,
          paymentStatus: o.paymentStatus,
          grandTotal: o.grandTotal,
          address: { fullName: "Spend Buyer", mobile: "+919820000000", city: "Surat", pincode: "395003", addressLine1: "1 Road", state: "Gujarat", country: "India" },
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("counts only paid, live orders as spent — not an abandoned checkout, an unpaid one or a cancelled one", async () => {
    const user = await repo.getUserById(userId);
    expect(user?.totalSpent).toBe(100_00);
  });

  it("does not count an abandoned checkout as an order", async () => {
    const user = await repo.getUserById(userId);
    expect(user?.ordersCount).toBe(3);
  });
});
