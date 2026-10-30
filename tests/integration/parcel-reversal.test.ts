/**
 * A parcel reverses only its own goods (offers-hardening R1, D1, D2).
 *
 * The bug this exists for: one parcel cancelled reversed every org's whole sale on the order, so a
 * second shop lost its payout for goods it had delivered. Owns its fixtures, like
 * `shipment-effects.test.ts`.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const PREFIX = "parcel-reversal-";

describe.skipIf(!isDisposableDb)("a parcel reverses only its own goods", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let moveParcel: typeof import("@server/checkout/fulfilment.service").moveParcel;
  let SHIPMENT_STATUS: typeof import("@server/shipping/domain/shipping.types").SHIPMENT_STATUS;
  let PARCEL_ACTOR: typeof import("@server/shipping/domain/shipping.types").PARCEL_ACTOR;
  let PAYMENT_STATUS: typeof import("@server/checkout/order.types").PAYMENT_STATUS;
  let ledgerService: typeof import("@server/payouts/ledger.service").ledgerService;
  const madeOrderIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ moveParcel } = await import("@server/checkout/fulfilment.service"));
    ({ SHIPMENT_STATUS, PARCEL_ACTOR } = await import("@server/shipping/domain/shipping.types"));
    ({ PAYMENT_STATUS } = await import("@server/checkout/order.types"));
    ({ ledgerService } = await import("@server/payouts/ledger.service"));
  });

  afterAll(async () => {
    if (madeOrderIds.length) {
      const inOrders = { orderId: { in: madeOrderIds } };
      await prisma.orgLedgerEntryLine.deleteMany({ where: { entry: inOrders } });
      await prisma.orgLedgerEntry.deleteMany({ where: inOrders });
      await prisma.parcelEvent.deleteMany({ where: { shipment: { orderId: { in: madeOrderIds } } } });
      await prisma.shipmentItem.deleteMany({ where: { shipment: inOrders } });
      await prisma.shipment.deleteMany({ where: inOrders });
      await prisma.orderItem.deleteMany({ where: inOrders });
      await prisma.order.deleteMany({ where: { id: { in: madeOrderIds } } });
    }
    await prisma.productStock.deleteMany({ where: { product: { name: { startsWith: PREFIX } } } });
    await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  async function aProduct(orgId: string, price: number, orgAddressId?: string) {
    const { categoryId } = await ensureFixtures();
    const name = unique();
    return prisma.product.create({
      data: {
        name, slug: name, description: "fixture", price,
        thumbnail: "https://example.invalid/x.webp", weight: 0.5, categoryId, orgId,
        ...(orgAddressId ? { stockLocations: { create: { orgAddressId, quantity: 0 } } } : {}),
      },
      select: { id: true },
    });
  }

  async function anOrder() {
    const order = await prisma.order.create({
      // Paid: only a paid parcel can be cancelled (order-fulfilment Q9).
      data: { code: `BB-${unique().slice(-8).toUpperCase()}`, address: {}, grandTotal: 0, paymentStatus: PAYMENT_STATUS.PAID },
      select: { id: true },
    });
    madeOrderIds.push(order.id);
    return order.id;
  }

  async function aParcel(input: {
    orderId: string; orgId: string; orgAddressId?: string; status: string;
    items: { orderItemId: string; quantity: number }[];
  }) {
    const shipment = await prisma.shipment.create({
      data: {
        code: `${unique()}-SH`, orderId: input.orderId, orgId: input.orgId,
        orgAddressId: input.orgAddressId ?? null,
        fromPincode: "400001", fromCity: "Mumbai", fromState: "Maharashtra",
        shippingCost: 5_000, status: input.status,
        items: { create: input.items },
      },
      select: { id: true },
    });
    return shipment.id;
  }

  /** The call the move makes, without moving the parcel: shipping reads the scope, payouts reverses. */
  const reverse = (shipmentId: string, reason = "test") =>
    prisma.$transaction(async (tx) => {
      const { shipmentRepository } = await import("@server/shipping/repositories/shipment.repository");
      const scope = await shipmentRepository.reversalScope(shipmentId, tx);
      return ledgerService.reverseShipment({ shipmentId, ...scope! }, reason, tx);
    });

  const entriesOf = (orderId: string) =>
    prisma.orgLedgerEntry.findMany({ where: { orderId }, include: { lines: true } });

  it("cancelling one org's parcel leaves the other org's sale whole (spec A1)", async () => {
    const { orgId: orgA, otherOrgId: orgB, orgAddressId } = await ensureFixtures();
    const orderId = await anOrder();
    const a = await aProduct(orgA, 100_000, orgAddressId);
    const b = await aProduct(orgB, 500_000);
    const itemA = await prisma.orderItem.create({
      data: { orderId, productId: a.id, quantity: 1, unitPrice: 100_000 }, select: { id: true },
    });
    const itemB = await prisma.orderItem.create({
      data: { orderId, productId: b.id, quantity: 1, unitPrice: 500_000 }, select: { id: true },
    });
    const parcelA = await aParcel({
      orderId, orgId: orgA, orgAddressId, status: SHIPMENT_STATUS.PACKING,
      items: [{ orderItemId: itemA.id, quantity: 1 }],
    });
    await aParcel({
      orderId, orgId: orgB, status: SHIPMENT_STATUS.IN_TRANSIT,
      items: [{ orderItemId: itemB.id, quantity: 1 }],
    });
    await ledgerService.recordSale(orderId);

    await moveParcel(parcelA, SHIPMENT_STATUS.CANCELLED, { actor: PARCEL_ACTOR.SYSTEM });

    const entries = await entriesOf(orderId);
    const of = (orgId: string, kind: string) => entries.filter((e) => e.orgId === orgId && e.kind === kind);
    expect(of(orgB, "REVERSAL"), "B's goods were not cancelled").toEqual([]);
    expect(of(orgB, "SALE")[0].payablePaise).toBeGreaterThan(0);
    expect(of(orgA, "REVERSAL")).toHaveLength(1);
    expect(of(orgA, "REVERSAL")[0].shipmentId).toBe(parcelA);
    expect(of(orgA, "REVERSAL")[0].payablePaise).toBe(-of(orgA, "SALE")[0].payablePaise);
  });

  it("a line split 3 + 2 across two parcels reverses to exactly its sale (spec A2)", async () => {
    const { orgId, orgAddressId } = await ensureFixtures();
    const orderId = await anOrder();
    const p = await aProduct(orgId, 33_333, orgAddressId);
    // Uneven on purpose: 1,66,665 gross, 9,997 discount of which 4,001 the org bore.
    const item = await prisma.orderItem.create({
      data: {
        orderId, productId: p.id, quantity: 5, unitPrice: 33_333,
        discountPaise: 9_997, orgFundedPaise: 4_001,
      },
      select: { id: true },
    });
    const first = await aParcel({
      orderId, orgId, orgAddressId, status: SHIPMENT_STATUS.IN_TRANSIT,
      items: [{ orderItemId: item.id, quantity: 3 }],
    });
    const second = await aParcel({
      orderId, orgId, orgAddressId, status: SHIPMENT_STATUS.IN_TRANSIT,
      items: [{ orderItemId: item.id, quantity: 2 }],
    });
    await ledgerService.recordSale(orderId);

    for (const parcel of [first, second]) {
      await moveParcel(parcel, SHIPMENT_STATUS.RTO_IN_TRANSIT, { actor: PARCEL_ACTOR.SYSTEM });
      await moveParcel(parcel, SHIPMENT_STATUS.RTO_DELIVERED, { actor: PARCEL_ACTOR.SYSTEM });
    }

    const entries = await entriesOf(orderId);
    const sale = entries.find((e) => e.kind === "SALE")!;
    const reversals = entries.filter((e) => e.kind === "REVERSAL");
    expect(reversals.map((r) => r.shipmentId).sort()).toEqual([first, second].sort());
    expect(reversals.map((r) => r.lines[0].quantity).sort()).toEqual([2, 3]);

    const figures = [
      "grossItemsPaise", "orgFundedDiscountPaise", "platformFundedDiscountPaise",
      "commissionBasePaise", "commissionPaise", "payablePaise",
    ] as const;
    for (const f of figures) {
      expect(reversals.reduce((s, r) => s + r[f], 0), f).toBe(-sale[f]);
    }
    expect(reversals.reduce((s, r) => s + r.lines[0].commissionPaise, 0)).toBe(-sale.lines[0].commissionPaise);
    expect(reversals.reduce((s, r) => s + r.lines[0].basePaise, 0)).toBe(-sale.lines[0].basePaise);
  });

  it("replaying a parcel's event writes nothing new, and the database refuses a second reversal", async () => {
    const { orgId, orgAddressId } = await ensureFixtures();
    const orderId = await anOrder();
    const p = await aProduct(orgId, 10_000, orgAddressId);
    const item = await prisma.orderItem.create({
      data: { orderId, productId: p.id, quantity: 2, unitPrice: 10_000 }, select: { id: true },
    });
    const parcel = await aParcel({
      orderId, orgId, orgAddressId, status: SHIPMENT_STATUS.IN_TRANSIT,
      items: [{ orderItemId: item.id, quantity: 1 }],
    });
    await ledgerService.recordSale(orderId);
    await moveParcel(parcel, SHIPMENT_STATUS.LOST, { actor: PARCEL_ACTOR.SYSTEM });
    const before = await entriesOf(orderId);

    expect(await reverse(parcel, "replay")).toBe(0);
    expect(await entriesOf(orderId)).toHaveLength(before.length);

    await expect(
      prisma.orgLedgerEntry.create({
        data: {
          orgId, orderId, shipmentId: parcel, kind: "REVERSAL",
          grossItemsPaise: 0, orgFundedDiscountPaise: 0, platformFundedDiscountPaise: 0,
          commissionBasePaise: 0, commissionPaise: 0, payablePaise: 0,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  /** One line of 5 units, figures that do not divide by 5, in two parcels of 3 and 2. */
  async function aSplitLine() {
    const { orgId, orgAddressId } = await ensureFixtures();
    const orderId = await anOrder();
    const p = await aProduct(orgId, 33_333, orgAddressId);
    const item = await prisma.orderItem.create({
      data: {
        orderId, productId: p.id, quantity: 5, unitPrice: 33_333,
        discountPaise: 9_997, orgFundedPaise: 4_001,
      },
      select: { id: true },
    });
    const parcel = (quantity: number) => aParcel({
      orderId, orgId, orgAddressId, status: SHIPMENT_STATUS.IN_TRANSIT,
      items: [{ orderItemId: item.id, quantity }],
    });
    const parcels = [await parcel(3), await parcel(2)];
    await ledgerService.recordSale(orderId);
    return { orderId, parcels };
  }

  /** Each call in its own transaction, started together — what two courier webhooks do. */
  const concurrently = (shipmentIds: string[]) => Promise.all(shipmentIds.map((id) => reverse(id, "race")));

  it("two parcels of one line reversed at once still sum to the sale exactly (D1 lock)", async () => {
    for (let run = 0; run < 5; run++) {
      const { orderId, parcels } = await aSplitLine();
      await concurrently(parcels);

      const entries = await entriesOf(orderId);
      const sale = entries.find((e) => e.kind === "SALE")!;
      const reversals = entries.filter((e) => e.kind === "REVERSAL");
      expect(reversals).toHaveLength(2);
      for (const f of ["grossItemsPaise", "orgFundedDiscountPaise", "platformFundedDiscountPaise",
        "commissionBasePaise", "commissionPaise", "payablePaise"] as const) {
        expect(reversals.reduce((s, r) => s + r[f], 0), f).toBe(-sale[f]);
      }
    }
  });

  it("one parcel reversed twice at once writes one reversal and raises nothing (D1 lock)", async () => {
    for (let run = 0; run < 5; run++) {
      const { orderId, parcels } = await aSplitLine();
      expect((await concurrently([parcels[0], parcels[0]])).sort()).toEqual([0, 1]);
      expect((await entriesOf(orderId)).filter((e) => e.kind === "REVERSAL")).toHaveLength(1);
    }
  });

  it("an order-wide reversal already written stands, and a parcel adds nothing to it (Q6)", async () => {
    const { orgId, orgAddressId } = await ensureFixtures();
    const orderId = await anOrder();
    const p = await aProduct(orgId, 10_000, orgAddressId);
    const item = await prisma.orderItem.create({
      data: { orderId, productId: p.id, quantity: 2, unitPrice: 10_000 }, select: { id: true },
    });
    const parcel = await aParcel({
      orderId, orgId, orgAddressId, status: SHIPMENT_STATUS.IN_TRANSIT,
      items: [{ orderItemId: item.id, quantity: 2 }],
    });
    await ledgerService.recordSale(orderId);
    const sale = (await entriesOf(orderId))[0];
    // The shape `reverseSale` wrote before this unit: no parcel, no quantity.
    await prisma.orgLedgerEntry.create({
      data: {
        orgId, orderId, kind: "REVERSAL",
        grossItemsPaise: -sale.grossItemsPaise, orgFundedDiscountPaise: 0,
        platformFundedDiscountPaise: 0, commissionBasePaise: -sale.commissionBasePaise,
        commissionPaise: -sale.commissionPaise, payablePaise: -sale.payablePaise,
        lines: { create: { orderItemId: item.id, basePaise: -sale.lines[0].basePaise,
          rateBps: sale.lines[0].rateBps, commissionPaise: -sale.lines[0].commissionPaise } },
      },
    });

    await moveParcel(parcel, SHIPMENT_STATUS.LOST, { actor: PARCEL_ACTOR.SYSTEM });
    expect(await entriesOf(orderId)).toHaveLength(2);
  });
  const netOf = async (orderId: string) =>
    (await entriesOf(orderId)).reduce((sum, e) => sum + e.payablePaise, 0);

  it("a manually edited sale, fully returned, nets the org to exactly zero (Q12)", async () => {
    const { orderId, parcels } = await aSplitLine();
    const sale = (await entriesOf(orderId)).find((e) => e.kind === "SALE")!;
    // The admin's correction: payable cut by a fifth, and an uneven paisa, so pro rata must round.
    await prisma.orgLedgerEntry.update({
      where: { id: sale.id },
      data: { payablePaise: Math.floor((sale.payablePaise * 4) / 5) - 1, isManuallyEdited: true },
    });

    for (const parcel of parcels) await reverse(parcel);

    expect(await netOf(orderId)).toBe(0);
    const reversals = (await entriesOf(orderId)).filter((e) => e.kind === "REVERSAL");
    for (const f of ["grossItemsPaise", "commissionPaise", "platformFundedDiscountPaise"] as const) {
      expect(reversals.reduce((s, r) => s + r[f], 0), f).toBe(-sale[f]);
    }
  });

  it("a soft-deleted sale is not reversed", async () => {
    const { orderId, parcels } = await aSplitLine();
    await prisma.orgLedgerEntry.updateMany({ where: { orderId, kind: "SALE" }, data: { deletedAt: new Date() } });

    expect(await reverse(parcels[0])).toBe(0);
    expect((await entriesOf(orderId)).filter((e) => e.kind === "REVERSAL")).toEqual([]);
  });

  it("a soft-deleted reversal no longer counts as units reversed", async () => {
    const { orderId, parcels } = await aSplitLine();
    await reverse(parcels[0]);
    await prisma.orgLedgerEntry.updateMany({ where: { orderId, kind: "REVERSAL" }, data: { deletedAt: new Date() } });

    await reverse(parcels[1]);
    const sale = (await entriesOf(orderId)).find((e) => e.kind === "SALE")!;
    const second = (await entriesOf(orderId)).find((e) => e.shipmentId === parcels[1])!;
    // Reversed from zero, as if it were the first two units of five.
    expect(second.lines[0].basePaise).toBe(-Math.floor((sale.lines[0].basePaise * 2) / 5));
  });

  it("refuses a parcel line that is not in its org's sale", async () => {
    const { orderId, parcels } = await aSplitLine();
    const { otherOrgId } = await ensureFixtures();
    const stray = await aProduct(otherOrgId, 1_000);
    const item = await prisma.orderItem.create({
      data: { orderId, productId: stray.id, quantity: 1, unitPrice: 1_000 }, select: { id: true },
    });
    await prisma.shipmentItem.create({ data: { shipmentId: parcels[0], orderItemId: item.id, quantity: 1 } });

    await expect(reverse(parcels[0])).rejects.toThrow(/absent from its org's sale/);
  });
});
