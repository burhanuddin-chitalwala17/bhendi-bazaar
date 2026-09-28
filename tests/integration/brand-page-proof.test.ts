/**
 * The brand page's proof against a real schema (brand-page R4, A3, A3a; trd D2): the orders
 * figure is checkout's own count — paid, visible, once per order however many of the org's
 * lines it carries — and the rating and the quoted reviews follow the product pages' own
 * predicate, so a withdrawn or retracted review, or one on an archived piece, is in neither
 * place. Owns its world: a fresh org, so the seed's rows cannot leak into the counts.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";

const address = {
  fullName: "Proof Test",
  mobile: "9000000041",
  addressLine1: "1 Proof Lane",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  country: "India",
};

describe.skipIf(!isDisposableDb)("brand page proof (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orderService: typeof import("@server/checkout/order.service").orderService;
  let reviewService: typeof import("@server/catalog/review.service").reviewService;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let orgId: string;
  const productIds: string[] = [];
  const orderIds: string[] = [];

  const day = (n: number) => new Date(Date.UTC(2026, 8, n));

  async function order(productId: string, paymentStatus: string, status: string, lines = 1) {
    const row = await prisma.order.create({
      data: {
        code: `PROOF-${stamp}-${orderIds.length}`,
        address,
        paymentStatus,
        status,
        items: {
          create: Array.from({ length: lines }, () => ({ productId, quantity: 1, unitPrice: 10_000 })),
        },
      },
      select: { id: true },
    });
    orderIds.push(row.id);
  }

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orderService } = await import("@server/checkout/order.service"));
    ({ reviewService } = await import("@server/catalog/review.service"));
    const { orgRepository } = await import("@server/catalog/org.repository");
    const fixtures = await ensureFixtures();

    const org = await orgRepository.create({
      code: `SEL-P${stamp}`.slice(0, 20),
      handle: `proof-test-${stamp}`,
      name: `Proof Test ${stamp}`,
      email: `proof-${stamp}@example.invalid`,
      isActive: true,
    });
    orgId = org.id;

    const product = async (name: string, owner: string, archivedAt: Date | null = null) => {
      const row = await prisma.product.create({
        data: {
          name,
          slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${stamp}`,
          description: "fixture",
          price: 10_000,
          thumbnail: "https://example.invalid/proof.webp",
          categoryId: fixtures.categoryId,
          orgId: owner,
          archivedAt,
        },
        select: { id: true },
      });
      productIds.push(row.id);
      return row.id;
    };
    const onSale = await product("Proof saree", orgId);
    const archived = await product("Proof shawl", orgId, new Date());
    const theirs = await product("Proof other", fixtures.otherOrgId);

    // Two paid orders carrying the org's goods (one with two of its lines), one unpaid, one
    // paid-but-expired (impossible by construction — the predicate is what is under test),
    // and one paid order for another shop's piece.
    await order(onSale, PAYMENT_STATUS.PAID, ORDER_STATUS.CONFIRMED);
    await order(onSale, PAYMENT_STATUS.PAID, ORDER_STATUS.DELIVERED, 2);
    await order(onSale, PAYMENT_STATUS.PENDING, ORDER_STATUS.PENDING_PAYMENT);
    await order(onSale, PAYMENT_STATUS.PAID, ORDER_STATUS.EXPIRED);
    await order(theirs, PAYMENT_STATUS.PAID, ORDER_STATUS.CONFIRMED);

    // One shopper, so R10 is exercised: three published reviews on the on-sale piece, then a
    // withdrawn one, a retracted one, and one on the archived piece — each later, each rated 1,
    // so any of them leaking in would drag both the average and the "newest" down.
    const review = (productId: string, rating: number, n: number, state: Record<string, Date> = {}) =>
      prisma.review.create({
        data: {
          productId,
          userId: fixtures.userId,
          userName: "Proof Buyer",
          rating,
          comment: `day ${n}`,
          createdAt: day(n),
          ...state,
        },
      });
    await review(onSale, 5, 1);
    await review(onSale, 5, 2);
    await review(onSale, 3, 3);
    await review(onSale, 1, 4, { withdrawnAt: new Date() });
    await review(onSale, 1, 5, { deletedAt: new Date() });
    await review(archived, 1, 6);
  });

  afterAll(async () => {
    // Children first: an order's lines cascade with it and a product's reviews with it; the
    // org is Restrict behind both, so it goes last.
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.org.delete({ where: { id: orgId } });
  });

  it("counts a paid order with the org's goods once, and ignores unpaid, expired and other shops' orders (A3)", async () => {
    await expect(orderService.paidOrderCountForOrg(orgId)).resolves.toBe(2);
  });

  it("rates the shop from the published reviews of its on-sale pieces, one voice per shopper per piece (A3a, R10)", async () => {
    // Three reviews counted; one voice, whose latest published rating is 3.
    await expect(reviewService.ratingForOrg(orgId)).resolves.toEqual({ average: 3, count: 3 });
  });

  it("quotes the newest published reviews, product named, and hands over no userId (R1, A3a)", async () => {
    const recent = await reviewService.recentForOrg(orgId, 3);
    expect(recent.map((review) => review.comment)).toEqual(["day 3", "day 2", "day 1"]);
    expect(recent.every((review) => review.product.name === "Proof saree")).toBe(true);
    expect(JSON.stringify(recent)).not.toContain("userId");
    expect(Object.keys(recent[0]).sort()).toEqual(
      ["authorName", "comment", "createdAt", "id", "isVerifiedPurchase", "product", "rating"],
    );
  });
});
