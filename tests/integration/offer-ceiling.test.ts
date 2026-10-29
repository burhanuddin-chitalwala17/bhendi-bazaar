/**
 * A shop's discount ceiling holds for every kind of offer (offers-hardening R3, D4, Q7): the form
 * refuses what it can know, and the engine clamps what is already running. Owns its fixtures.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { CreateOrderWithShipmentsInput } from "@server/checkout/order.types";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { billableWeightKg } from "@server/shipping/billable-weight";
import { signRateQuote } from "@server/shipping/rate-quote.service";

vi.mock("next-auth", () => ({ getServerSession: async () => null }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));

const PREFIX = "offers-u4-";
const PRICE = 1_000_000; // ₹10,000
const SHIPPING = 5_000;
const WEIGHT_KG = 0.5;

describe.skipIf(!isDisposableDb)("offers: a shop's discount ceiling", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orderService: typeof import("@server/checkout/order.service").orderService;
  let adminPromotionService: typeof import("@server/promotions/admin.promotion.service").adminPromotionService;
  let productsService: typeof import("@server/catalog/admin.product.service").productsService;
  let priceContext: typeof import("@server/promotions/price-context");
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;
  const orderIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orderService } = await import("@server/checkout/order.service"));
    ({ adminPromotionService } = await import("@server/promotions/admin.promotion.service"));
    ({ productsService } = await import("@server/catalog/admin.product.service"));
    priceContext = await import("@server/promotions/price-context");
    fixtures = await ensureFixtures();
    // The fixture org is the default 50%; stated so the suite does not depend on it.
    await prisma.org.update({ where: { id: fixtures.orgId }, data: { maxDiscountBps: 5000 } });
  });

  afterAll(async () => {
    const inOrders = { orderId: { in: orderIds } };
    await prisma.shipmentItem.deleteMany({ where: { shipment: inOrders } });
    await prisma.shipment.deleteMany({ where: inOrders });
    await prisma.orderDiscount.deleteMany({ where: inOrders });
    await prisma.orderItem.deleteMany({ where: inOrders });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    const ours = { product: { name: { startsWith: PREFIX } } };
    await prisma.promotionTarget.deleteMany({ where: { OR: [ours, { promotionId: { startsWith: PREFIX } }] } });
    await prisma.promotion.deleteMany({ where: {
      OR: [{ id: { startsWith: PREFIX } }, { label: { startsWith: PREFIX } }, { label: { startsWith: `Markdown — ${PREFIX}` } }],
    } });
    await prisma.productStock.deleteMany({ where: ours });
    await prisma.productMedia.deleteMany({ where: ours });
    await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const window = () => ({ startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000) });

  async function aProduct() {
    const name = unique();
    return await prisma.product.create({
      data: {
        name, slug: name, description: "fixture", price: PRICE, weight: WEIGHT_KG,
        thumbnail: "https://example.invalid/x.webp", categoryId: fixtures.categoryId, orgId: fixtures.orgId,
        stockLocations: { create: { orgAddressId: fixtures.orgAddressId, quantity: 100 } },
      },
      select: { id: true, price: true, orgId: true, categoryId: true },
    });
  }

  it("refuses ₹9,999 off a ₹10,000 product on a 50%-capped shop's offer form (spec A4)", async () => {
    const product = await aProduct();
    const attempt = adminPromotionService.create(
      {
        label: unique(), trigger: "AUTOMATIC", valueType: "AMOUNT_OFF", amountOff: 9_999,
        ...window(), isActive: true, categoryIds: [], productIds: [product.id],
      },
      { scope: "ORG", orgId: fixtures.orgId },
    );
    await expect(attempt).rejects.toMatchObject({
      message: "Your shop's offers can take off at most 50%. ₹9,999 off ₹10,000 is 99.99%.",
      field: "amountOff",
    });
  });

  it("refuses a ₹1 fixed price on the offer form, as the amount it takes off (spec A4)", async () => {
    const product = await aProduct();
    const attempt = adminPromotionService.create(
      {
        label: unique(), trigger: "AUTOMATIC", valueType: "FIXED_PRICE", fixedPrice: 1,
        ...window(), isActive: true, categoryIds: [], productIds: [product.id],
      },
      { scope: "ORG", orgId: fixtures.orgId },
    );
    await expect(attempt).rejects.toMatchObject({
      message: "Your shop's offers can take off at most 50%. ₹9,999 off ₹10,000 is 99.99%.",
      field: "fixedPrice",
    });
  });

  it("refuses a ₹1 sale price on the product form, and saves nothing (spec A4)", async () => {
    const name = unique();
    const attempt = productsService.createProduct({
      name, description: "fixture", price: 10_000, salePrice: 1,
      orgId: fixtures.orgId, categoryId: fixtures.categoryId, weight: WEIGHT_KG,
      media: [{ kind: "IMAGE", ref: "https://placehold.co/600x600", isThumbnail: true }],
      stockLocations: [{ orgAddressId: fixtures.orgAddressId, quantity: 1 }],
    });
    await expect(attempt).rejects.toMatchObject({
      message: "Your sale price can be at most 50% below the price — no lower than ₹5,000.",
      field: "salePrice",
    });
    expect(await prisma.product.count({ where: { name } })).toBe(0);
  });

  it("refuses a ₹1 sale price on a bulk sheet row, in the same words (spec A4)", async () => {
    const { validateProductRows } = await import("@server/catalog/bulk/bulk-product.service");
    const errors = await validateProductRows(fixtures.orgId, [{
      rowNumber: 2,
      row: {
        name: unique(), description: "d", price: 10_000, salePrice: 1, categorySlug: fixtures.categorySlug,
        weight: 1, factLabels: {}, measurements: {}, tags: [], images: [], stock: {},
      },
    }], []);
    expect(errors).toContainEqual({
      row: 2, field: "salePrice",
      message: "Your sale price can be at most 50% below the price — no lower than ₹5,000.",
    });
  });

  it("an older over-cap offer takes off exactly 50% on the product page and at checkout (spec A4)", async () => {
    const product = await aProduct();
    // Inserted directly, as an offer saved before the ceiling held — or one a price edit breached.
    await prisma.promotion.create({
      data: {
        id: unique(), label: "U4 legacy", scope: "ORG", orgId: fixtures.orgId, trigger: "AUTOMATIC",
        valueType: "AMOUNT_OFF", amountOffPaise: 999_900, ...window(),
        targets: { create: [{ productId: product.id }] },
      },
    });

    const shown = priceContext.resolveProductPrice(product, await priceContext.loadPriceContext());
    expect(shown.offerPricePaise).toBe(PRICE / 2);

    const location = await prisma.orgAddress.findUniqueOrThrow({
      where: { id: fixtures.orgAddressId },
      select: { org: { select: { name: true } }, address: { select: { pincode: true, city: true, state: true } } },
    });
    const input: CreateOrderWithShipmentsInput = {
      address: {
        id: "u4-address", fullName: "U4 Buyer", mobile: "9000000044",
        email: "u4@example.invalid", addressLine1: "1 Ceiling Lane", city: "Mumbai",
        state: "Maharashtra", pincode: "400001", country: "India",
      },
      displayedGrandTotal: shown.offerPricePaise + SHIPPING,
      shippingGroups: [{
        groupId: fixtures.orgAddressId,
        orgId: fixtures.orgId,
        orgName: location.org.name,
        fromPincode: location.address.pincode,
        fromCity: location.address.city,
        fromState: location.address.state,
        items: [{ productId: product.id, quantity: 1 }],
        selectedRate: {
          quote: signRateQuote(
            { providerId: fixtures.shippingProviderId, providerName: "Fixture Carrier", courierName: "Test Courier",
              rate: SHIPPING, estimatedDays: 3, mode: "surface" },
            { fromPincode: location.address.pincode, toPincode: "400001", billableWeightKg: billableWeightKg(WEIGHT_KG) },
          ),
        },
      }],
    };
    const order = await orderService.createOrderWithShipments(input);
    orderIds.push(order.id);

    const item = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: order.id }, select: { discountPaise: true, orgFundedPaise: true },
    });
    expect(item.discountPaise).toBe(PRICE / 2);
    expect(item.orgFundedPaise).toBe(PRICE / 2);
  });

  describe("the edit form's sale price is the shop's own markdown, never a campaign's price", () => {
    async function aFormProduct(salePrice?: number) {
      const name = unique();
      const created = await productsService.createProduct({
        name, description: "before", price: 10_000, salePrice,
        orgId: fixtures.orgId, categoryId: fixtures.categoryId, weight: WEIGHT_KG,
        media: [{ kind: "IMAGE", ref: "https://placehold.co/600x600", isThumbnail: true }],
        stockLocations: [{ orgAddressId: fixtures.orgAddressId, quantity: 1 }],
      });
      return created.id;
    }

    /** What the edit page loads, saved back with only the description changed. */
    async function editDescription(id: string) {
      const { adminProductsDAL } = await import("@/data-access-layer/admin/products.dal");
      const dto = await adminProductsDAL.getProductById(id);
      await productsService.updateProduct(id, {
        name: dto.name, description: "after", price: dto.price / 100,
        salePrice: dto.salePrice != null ? dto.salePrice / 100 : undefined,
        orgId: fixtures.orgId, categoryId: dto.category.id, weight: dto.weight,
        media: [{ kind: "IMAGE", ref: "https://placehold.co/600x600", isThumbnail: true }],
        stockLocations: [{ orgAddressId: fixtures.orgAddressId, quantity: 1, seenQuantity: 1 }],
      });
      return dto;
    }

    const markdown = (id: string) =>
      prisma.promotion.findUnique({ where: { id: `mkdn_${id}` }, select: { fixedPricePaise: true, isActive: true } });

    it("under a 60% platform campaign, a description edit saves and makes no markdown (spec A4)", async () => {
      const id = await aFormProduct();
      await prisma.promotion.create({
        data: {
          id: unique(), label: "U4 campaign", scope: "PLATFORM", trigger: "AUTOMATIC",
          valueType: "PERCENT", percentBps: 6000, ...window(), targets: { create: [{ productId: id }] },
        },
      });
      const dto = await editDescription(id);
      expect(dto.salePrice).toBeUndefined();
      expect(await markdown(id)).toBeNull();
      expect((await prisma.product.findUniqueOrThrow({ where: { id } })).description).toBe("after");
    });

    it("a product's own markdown round-trips unchanged (spec A4)", async () => {
      const id = await aFormProduct(6_000);
      const dto = await editDescription(id);
      expect(dto.salePrice).toBe(600_000);
      expect(await markdown(id)).toEqual({ fixedPricePaise: 600_000, isActive: true });
    });

    it("an older over-cap markdown does not block a description edit; the engine clamps it (spec A4)", async () => {
      const id = await aFormProduct();
      await prisma.promotion.create({
        data: {
          id: `mkdn_${id}`, label: `Markdown — ${PREFIX}legacy`, scope: "ORG", orgId: fixtures.orgId,
          trigger: "AUTOMATIC", valueType: "FIXED_PRICE", fixedPricePaise: 100, ...window(),
          targets: { create: [{ id: `mkdntgt_${id}`, productId: id }] },
        },
      });
      await editDescription(id);
      expect(await markdown(id)).toEqual({ fixedPricePaise: 100, isActive: true });
    });
  });
});
