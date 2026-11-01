/**
 * A themed landing page's derived figures against a real schema (storefront-themes D9; Q19, Q34,
 * Q38, Q39). Best selling is units in paid orders over 90 days — an unpaid, cancelled, stale or
 * other shop's sale must not lift a product — and dispatch time is the median from paid to
 * ready, left out under three parcels. An unthemed shop has no landing DTO at all (Q19).
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";
import { PARCEL_ACTOR, SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";

const address = {
  fullName: "Landing Test",
  mobile: "9000000042",
  addressLine1: "1 Landing Lane",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  country: "India",
};
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe.skipIf(!isDisposableDb)("storefront landing page (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orderService: typeof import("@server/checkout/order.service").orderService;
  let storefrontService: typeof import("@server/catalog/storefront.service").storefrontService;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const handle = `landing-test-${stamp}`;
  let orgId: string;
  const productIds: string[] = [];
  const orderIds: string[] = [];
  const ids: Record<string, string> = {};

  async function order(
    productId: string,
    quantity: number,
    {
      payment = PAYMENT_STATUS.PAID as string,
      status = ORDER_STATUS.CONFIRMED as string,
      paidAt = new Date(Date.now() - DAY) as Date | null,
    } = {},
  ) {
    const row = await prisma.order.create({
      data: {
        code: `LAND-${stamp}-${orderIds.length}`,
        address,
        paymentStatus: payment,
        paidAt,
        status,
        items: { create: [{ productId, quantity, unitPrice: 10_000 }] },
      },
      select: { id: true },
    });
    orderIds.push(row.id);
    return row.id;
  }

  /** A paid parcel of this shop marked ready `hours` after payment. */
  async function readyAfter(hours: number, status: string = ORDER_STATUS.CONFIRMED) {
    const paidAt = new Date(Date.now() - 10 * DAY);
    const orderId = await order(ids.slow, 1, { paidAt, status });
    const shipment = await prisma.shipment.create({
      data: {
        code: `LAND-${stamp}-SH${orderIds.length}`, orderId, orgId,
        fromPincode: "400001", fromCity: "Mumbai", fromState: "Maharashtra", shippingCost: 0,
        status: SHIPMENT_STATUS.READY_FOR_PICKUP,
      },
      select: { id: true },
    });
    await prisma.parcelEvent.create({
      data: {
        shipmentId: shipment.id,
        fromStatus: SHIPMENT_STATUS.PACKING,
        toStatus: SHIPMENT_STATUS.READY_FOR_PICKUP,
        actor: PARCEL_ACTOR.SHOP,
        createdAt: new Date(paidAt.getTime() + hours * HOUR),
      },
    });
  }

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orderService } = await import("@server/checkout/order.service"));
    ({ storefrontService } = await import("@server/catalog/storefront.service"));
    const { orgRepository } = await import("@server/catalog/org.repository");
    const fixtures = await ensureFixtures();

    orgId = (
      await orgRepository.create({
        code: `SEL-L${stamp}`.slice(0, 20),
        handle,
        name: `Landing Test ${stamp}`,
        email: `landing-${stamp}@example.invalid`,
        isActive: true,
      })
    ).id;

    const product = async (key: string, owner: string) => {
      const row = await prisma.product.create({
        data: {
          name: `Landing ${key}`,
          slug: `landing-${key}-${stamp}`,
          description: "fixture",
          price: 10_000,
          thumbnail: "https://example.invalid/landing.webp",
          categoryId: fixtures.categoryId,
          orgId: owner,
        },
        select: { id: true },
      });
      productIds.push(row.id);
      ids[key] = row.id;
    };
    for (const key of ["top", "second", "unpaid", "refunded", "cancelled", "stale", "slow", "archived"]) await product(key, orgId);
    await product("theirs", fixtures.otherOrgId);

    await order(ids.top, 5);
    await order(ids.second, 2);
    await order(ids.second, 1);
    // Each of these would outsell "top" if it counted.
    await order(ids.unpaid, 9, { payment: PAYMENT_STATUS.PENDING, status: ORDER_STATUS.PENDING_PAYMENT, paidAt: null });
    // Paid once, so it carries a paidAt: only the payment status says it no longer counts.
    await order(ids.refunded, 9, { payment: PAYMENT_STATUS.REFUNDED });
    await order(ids.cancelled, 9, { status: ORDER_STATUS.CANCELLED });
    await order(ids.stale, 9, { paidAt: new Date(Date.now() - 120 * DAY) });
    await order(ids.theirs, 9);
    // Sold most, but no longer on sale: it must not take a shelf place from goods that are.
    await prisma.product.update({ where: { id: ids.archived }, data: { archivedAt: new Date() } });
    await order(ids.archived, 9);
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.org.delete({ where: { id: orgId } });
  });

  it("ranks best selling by units in this shop's paid orders over 90 days (Q34)", async () => {
    const ranked = await orderService.bestSellingProductIdsForOrg(orgId, 90, 8);
    expect(ranked.slice(0, 2)).toEqual([ids.top, ids.second]);
    for (const key of ["unpaid", "refunded", "cancelled", "stale", "theirs", "archived"]) expect(ranked).not.toContain(ids[key]);
  });

  it("derives no dispatch time under three parcels, then the median rounded down (Q38, Q39)", async () => {
    await readyAfter(30);
    await readyAfter(50);
    // A cancelled order's parcel is not the shop's dispatch record: with it counted, three would pass the floor.
    await readyAfter(10, ORDER_STATUS.CANCELLED);
    await expect(orderService.dispatchDaysForOrg(orgId)).resolves.toBeNull();
    await readyAfter(80);
    // 30 h, 50 h, 80 h: the median is 50 h, which is 2 whole days.
    await expect(orderService.dispatchDaysForOrg(orgId)).resolves.toBe(2);
  });

  it("has no landing page until the shop publishes a look (Q19), then carries it", async () => {
    await expect(storefrontService.storefrontPage(handle)).resolves.toBeNull();
    await prisma.orgProfile.update({ where: { orgId }, data: { themeKey: "daily", paletteKey: "cobalt" } });
    const page = await storefrontService.storefrontPage(handle);
    expect(page).toMatchObject({ themeKey: "daily", paletteKey: "cobalt", dispatchDays: 2 });
    expect(page?.bestSellingIds[0]).toBe(ids.top);
    await prisma.orgProfile.update({ where: { orgId }, data: { themeKey: "retired-theme" } });
    await expect(storefrontService.storefrontPage(handle)).resolves.toBeNull();
  });
});
