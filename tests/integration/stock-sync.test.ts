/**
 * One stock figure on every marketplace, against a real schema (inventory-sync D1–D6). The
 * marketplace is a fake that records what it is sent; under test is what we store and decide: a
 * change enqueued with its transaction, the count now sent and sent once, a sale taken once and never
 * below zero, a cancellation put back once, the daily check's correction, and the switch.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@prisma/client";

import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

const fake = vi.hoisted(() => {
  const state = {
    sent: [] as Array<{ sku: string; counts: Array<{ externalId: string; quantity: number }> }>,
    theirs: new Map<string, number>(),
    held: new Set<string>(),
    /** SKUs the marketplace turns down. */
    reject: new Set<string>(),
    orders: [] as unknown[],
    /** Runs inside a send, once, to start something while the push holds its lock. */
    onSet: null as null | (() => Promise<void>),
    locations: [{ externalId: "DEFAULT", name: "Amazon pickup address", pincode: null }] as Array<{ externalId: string; name: string; pincode: string | null }>,
  };
  const provider = {
    configured: () => true,
    readLocations: async () => state.locations,
    readStock: async (_t: unknown, _a: unknown, listing: { sku: string }) =>
      state.held.has(listing.sku)
        ? { counts: [], heldByMarketplace: true }
        : { counts: [{ externalId: "DEFAULT", quantity: state.theirs.get(listing.sku) ?? 0 }], heldByMarketplace: false },
    setStock: async (_t: unknown, _a: unknown, listing: { sku: string }, counts: Array<{ externalId: string; quantity: number }>) => {
      if (state.reject.has(listing.sku)) {
        const { MarketplaceRequestError } = await import("@server/channels/providers/marketplace-provider");
        throw new MarketplaceRequestError(400, "test refusal");
      }
      const hook = state.onSet;
      state.onSet = null;
      if (hook) await hook();
      state.sent.push({ sku: listing.sku, counts });
      state.theirs.set(listing.sku, counts.reduce((n, c) => n + c.quantity, 0));
    },
    readOrders: async () => ({ lines: state.orders, cursor: new Date().toISOString() }),
  };
  return { state, provider };
});

vi.mock("@server/channels/providers", () => ({ providerFor: () => fake.provider }));

describe.skipIf(!isDisposableDb)("stock sync (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let stock: typeof import("@server/channels/channel-stock.service").channelStockService;
  let orders: typeof import("@server/channels/channel-orders.service").channelOrdersService;
  let locations: typeof import("@server/channels/channel-location.service").channelLocationService;
  let stockService: typeof import("@server/catalog/stock.service").stockService;
  let orgId: string;
  let categoryId: string;
  let locationId: string;
  let connectionId: string;
  const stamp = Date.now();

  const product = async (s: string, quantity: number) => {
    const p = await prisma.product.create({
      data: { name: `Stock ${s}`, slug: `ss-${stamp}-${s}`, description: "", price: 1000, categoryId, thumbnail: "/brand/bhendi-bazaar.png", orgId, sku: `SS-${stamp}-${s}` },
      select: { id: true },
    });
    await prisma.productStock.create({ data: { productId: p.id, orgAddressId: locationId, quantity } });
    await prisma.channelListing.create({
      data: { connectionId, orgId, channel: "amazon", sku: `SS-${stamp}-${s}`, skuKey: `ss-${stamp}-${s}`, productId: p.id, linkSource: "OWNER", linkedAt: new Date(), lastSeenAt: new Date() },
    });
    return p.id;
  };
  const count = async (productId: string) => (await prisma.productStock.findFirstOrThrow({ where: { productId, orgAddressId: locationId }, select: { quantity: true } })).quantity;
  const pushJobs = async (productId: string) => {
    const { JOBS_QUEUE, JOBS_SCHEMA } = await import("@server/shared/jobs/jobs.config");
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->>'type' = 'channels.push-stock' AND data->'payload'->>'productId' = $2`,
      JOBS_QUEUE,
      productId,
    );
    return Number(rows[0].n);
  };
  const line = (orderId: string, sku: string, quantity: number, state = "open", orderedAt = new Date()) => ({
    orderId,
    lineId: `${orderId}-1`,
    sku: `SS-${stamp}-${sku}`,
    quantity,
    locationExternalId: "DEFAULT",
    state,
    amountPaise: 99_900,
    orderedAt,
  });

  const cleanup = async () => {
    const products = await prisma.product.findMany({ where: { orgId, sku: { startsWith: `SS-${stamp}` } }, select: { id: true } });
    await prisma.marketplaceOrder.deleteMany({ where: { orgId } });
    await prisma.stockCorrection.deleteMany({ where: { orgId } });
    await prisma.channelListing.deleteMany({ where: { orgId } });
    await prisma.productStock.deleteMany({ where: { productId: { in: products.map((p) => p.id) } } });
    await prisma.product.deleteMany({ where: { id: { in: products.map((p) => p.id) } } });
    const { JOBS_QUEUE, JOBS_SCHEMA } = await import("@server/shared/jobs/jobs.config");
    await prisma.$executeRawUnsafe(`DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->>'type' IN ('channels.push-stock', 'channels.check-orders')`, JOBS_QUEUE);
  };

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ channelStockService: stock } = await import("@server/channels/channel-stock.service"));
    ({ channelOrdersService: orders } = await import("@server/channels/channel-orders.service"));
    ({ channelLocationService: locations } = await import("@server/channels/channel-location.service"));
    ({ stockService } = await import("@server/catalog/stock.service"));
    ({ orgId, categoryId, orgAddressId: locationId } = await ensureFixtures());
    await prisma.channelListing.deleteMany({ where: { orgId } });
    await prisma.channelLocation.deleteMany({ where: { orgId } });
    await prisma.channelConnection.deleteMany({ where: { orgId } });
    connectionId = (
      await prisma.channelConnection.create({ data: { orgId, channel: "amazon", state: "CONNECTED", externalAccountId: `A-${stamp}`, refreshToken: "sealed-test" }, select: { id: true } })
    ).id;
  });

  beforeEach(async () => {
    await cleanup();
    Object.assign(fake.state, { sent: [], theirs: new Map(), held: new Set(), reject: new Set(), orders: [], onSet: null });
    await prisma.channelLocation.deleteMany({ where: { orgId } });
    await locations.refresh(connectionId);
    const [loc] = await prisma.channelLocation.findMany({ where: { connectionId }, select: { id: true } });
    await locations.save(orgId, "amazon", [{ id: loc.id, orgAddressId: locationId, notUsed: false }]);
    await prisma.channelConnection.update({ where: { id: connectionId }, data: { stockSync: "on", stockSyncChangedAt: new Date(Date.now() - 3_600_000), ordersCursor: null, ordersCheckedAt: null } });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.channelLocation.deleteMany({ where: { orgId } });
    await prisma.channelConnection.deleteMany({ where: { orgId } });
  });

  it("enqueues a push in the transaction that changes stock, and none when it rolls back (D2)", async () => {
    const id = await product("TX", 5);
    const before = await pushJobs(id);
    await prisma.$transaction(async (tx) => stockService.takeOne(id, locationId, tx));
    expect(await pushJobs(id)).toBe(before + 1);
    await expect(
      prisma.$transaction(async (tx) => {
        await stockService.takeOne(id, locationId, tx);
        throw new Error("rolled back");
      }),
    ).rejects.toThrow(/rolled back/);
    expect(await pushJobs(id)).toBe(before + 1);
  });

  it("sends the count as it is now, and sends the same count only once (D3, spec A2, A3)", async () => {
    const id = await product("PUSH", 5);
    fake.state.theirs.set(`SS-${stamp}-PUSH`, 9);
    await stock.push(id);
    expect(fake.state.sent).toEqual([{ sku: `SS-${stamp}-PUSH`, counts: [{ externalId: "DEFAULT", quantity: 5 }] }]);
    await stock.push(id);
    expect(fake.state.sent).toHaveLength(1);
    await prisma.productStock.updateMany({ where: { productId: id }, data: { quantity: 3 } });
    await stock.push(id);
    expect(fake.state.sent.at(-1)?.counts).toEqual([{ externalId: "DEFAULT", quantity: 3 }]);
  });

  it("never sends to a listing Amazon stocks itself, to an unmatched location, or while paused (Q5, Q16, Q4)", async () => {
    const held = await product("FBA", 5);
    fake.state.held.add(`SS-${stamp}-FBA`);
    await stock.push(held);
    expect(fake.state.sent).toEqual([]);

    const id = await product("WAIT", 5);
    await prisma.channelLocation.updateMany({ where: { connectionId }, data: { orgAddressId: null, notUsed: false } });
    await stock.push(id);
    expect(fake.state.sent).toEqual([]);
    await expect(stock.turnOn(orgId, "amazon")).rejects.toThrow(/Match your locations/);

    await prisma.channelLocation.updateMany({ where: { connectionId }, data: { orgAddressId: locationId } });
    await prisma.channelConnection.update({ where: { id: connectionId }, data: { stockSync: "paused" } });
    await stock.push(id);
    expect(fake.state.sent).toEqual([]);
  });

  it("sends 0 for an archived product (Q6)", async () => {
    const id = await product("ARCH", 4);
    await prisma.product.update({ where: { id }, data: { archivedAt: new Date() } });
    await stock.push(id);
    expect(fake.state.sent.at(-1)?.counts).toEqual([{ externalId: "DEFAULT", quantity: 0 }]);
  });

  it("takes a marketplace sale once however often it is reported (spec A1, D4)", async () => {
    const id = await product("SALE", 5);
    fake.state.orders = [line("405-1", "SALE", 2)];
    await orders.check(connectionId);
    await orders.check(connectionId);
    expect(await count(id)).toBe(3);
    expect(await prisma.marketplaceOrder.count({ where: { orgId, orderId: "405-1" } })).toBe(1);
  });

  it("records the last item sold twice as one oversold line, stock 0 and never below (spec A4, Q7)", async () => {
    const id = await product("LAST", 1);
    fake.state.orders = [line("405-A", "LAST", 1), line("405-B", "LAST", 1)];
    await orders.check(connectionId);
    expect(await count(id)).toBe(0);
    const rows = await prisma.marketplaceOrder.findMany({ where: { orgId, productId: id }, select: { orderId: true, oversold: true, taken: true }, orderBy: { orderId: "asc" } });
    expect(rows).toEqual([
      { orderId: "405-A", oversold: false, taken: 1 },
      { orderId: "405-B", oversold: true, taken: 0 },
    ]);
  });

  it("puts a cancelled order back once, before dispatch only (spec A5, Q8)", async () => {
    const id = await product("CXL", 5);
    fake.state.orders = [line("405-C", "CXL", 2)];
    await orders.check(connectionId);
    fake.state.orders = [line("405-C", "CXL", 2, "cancelled")];
    await orders.check(connectionId);
    await orders.check(connectionId);
    expect(await count(id)).toBe(5);

    fake.state.orders = [line("405-S", "CXL", 1)];
    await orders.check(connectionId);
    fake.state.orders = [line("405-S", "CXL", 1, "shipped")];
    await orders.check(connectionId);
    fake.state.orders = [line("405-S", "CXL", 1, "cancelled")];
    await orders.check(connectionId);
    expect(await count(id)).toBe(4);
  });

  it("restocks once when two checks see the same cancellation at the same moment (Q8)", async () => {
    const id = await product("RACE", 5);
    fake.state.orders = [line("405-R", "RACE", 2)];
    await orders.check(connectionId);
    fake.state.orders = [line("405-R", "RACE", 2, "cancelled")];
    await Promise.all([orders.check(connectionId), orders.check(connectionId), orders.check(connectionId)]);
    expect(await count(id)).toBe(5);
  });

  it("puts back a count changed by hand on the marketplace, and records it (spec A6, Q9)", async () => {
    const id = await product("DAILY", 5);
    await stock.push(id);
    fake.state.theirs.set(`SS-${stamp}-DAILY`, 7);
    const result = await stock.dailyCheck(connectionId);
    expect(result.corrected).toBe(1);
    expect(fake.state.theirs.get(`SS-${stamp}-DAILY`)).toBe(5);
    const section = await stock.section(orgId, "amazon");
    expect(section.corrections[0]).toMatchObject({ title: "Stock DAILY", theirs: 7, ours: 5 });
  });

  it("previews what turning on will change, sending nothing, then turns on (spec A7, Q4)", async () => {
    await prisma.channelConnection.update({ where: { id: connectionId }, data: { stockSync: "off" } });
    await product("PRE", 5);
    fake.state.theirs.set(`SS-${stamp}-PRE`, 8);
    const preview = await stock.preview(orgId, "amazon");
    expect(preview.rows.find((r) => r.title === "Stock PRE")).toMatchObject({ theirs: 8, ours: 5, changes: true });
    expect(fake.state.sent).toEqual([]);
    await stock.turnOn(orgId, "amazon");
    expect((await prisma.channelConnection.findUniqueOrThrow({ where: { id: connectionId }, select: { stockSync: true } })).stockSync).toBe("on");
  });

  it("marks a location the marketplace stops reporting as gone, and matches only to the shop's open locations (Q15)", async () => {
    fake.state.locations = [];
    await locations.refresh(connectionId);
    expect((await prisma.channelLocation.findFirstOrThrow({ where: { connectionId } })).goneAt).toBeInstanceOf(Date);
    fake.state.locations = [{ externalId: "DEFAULT", name: "Amazon pickup address", pincode: null }];
    await locations.refresh(connectionId);
    const [loc] = await prisma.channelLocation.findMany({ where: { connectionId }, select: { id: true, goneAt: true } });
    expect(loc.goneAt).toBeNull();
    await expect(locations.save(orgId, "amazon", [{ id: loc.id, orgAddressId: "not-ours", notUsed: false }])).rejects.toThrow(/Pick one of your open pickup locations/);
  });

  it("sends the count as it is when a push waiting on the lock runs, never one read before it (D3, Q22)", async () => {
    const id = await product("ORDER", 4);
    await stock.push(id);
    await prisma.productStock.updateMany({ where: { productId: id }, data: { quantity: 5 } });
    let second: Promise<unknown> = Promise.resolve();
    fake.state.onSet = async () => {
      second = stock.push(id);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await prisma.productStock.updateMany({ where: { productId: id }, data: { quantity: 4 } });
    };
    await stock.push(id);
    await second;
    expect(fake.state.sent.map((s) => s.counts[0].quantity)).toEqual([4, 5, 4]);
  });

  it("records a sale from before sync was on without taking stock, and takes one first seen shipped (Q24)", async () => {
    const id = await product("BEFORE", 5);
    const sync = new Date(Date.now() - 60_000);
    await prisma.channelConnection.update({ where: { id: connectionId }, data: { stockSyncChangedAt: sync } });
    fake.state.orders = [line("405-O", "BEFORE", 2, "open", new Date(sync.getTime() - 60_000)), line("405-M", "BEFORE", 1, "shipped")];
    await orders.check(connectionId);
    expect(await count(id)).toBe(4);
    const old = await prisma.marketplaceOrder.findFirstOrThrow({ where: { orgId, orderId: "405-O" }, select: { beforeSync: true, taken: true, oversold: true } });
    expect(old).toEqual({ beforeSync: true, taken: 0, oversold: false });
  });

  it("starts the order check from now when sync goes on (Q24)", async () => {
    await prisma.channelConnection.update({ where: { id: connectionId }, data: { stockSync: "off", ordersCursor: "2026-01-01T00:00:00.000Z" } });
    await stock.turnOn(orgId, "amazon");
    const row = await prisma.channelConnection.findUniqueOrThrow({ where: { id: connectionId }, select: { ordersCursor: true } });
    expect(new Date(row.ordersCursor!).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("runs the next order check only when this one had a connection due, so a second chain stops (Q23)", async () => {
    let next = 0;
    expect(await orders.checkDue(async () => void next++)).toBe(1);
    expect(await orders.checkDue(async () => void next++)).toBe(0);
    expect(next).toBe(1);
  });

  it("sends what waited for a location's match once it is matched (Q16)", async () => {
    const id = await product("MATCH", 5);
    const [loc] = await prisma.channelLocation.findMany({ where: { connectionId }, select: { id: true } });
    await prisma.channelLocation.update({ where: { id: loc.id }, data: { orgAddressId: null, matchedAt: null } });
    const before = await pushJobs(id);
    await locations.save(orgId, "amazon", [{ id: loc.id, orgAddressId: locationId, notUsed: false }]);
    expect(await pushJobs(id)).toBe(before + 1);
  });

  it("names a listing the marketplace turned down instead of reading 'sending' for ever", async () => {
    const id = await product("NOPE", 5);
    await prisma.channelListing.updateMany({ where: { connectionId }, data: { stockSent: Prisma.DbNull } });
    fake.state.reject.add(`SS-${stamp}-NOPE`);
    await stock.push(id);
    const section = await stock.section(orgId, "amazon");
    expect(section.refused).toBe(1);
    expect(section.sending).toBeNull();
  });

  it("spends no transaction on a line already recorded unchanged, and a quiet check writes nothing (Q23)", async () => {
    await product("QUIET", 5);
    fake.state.orders = [line("405-Q", "QUIET", 1)];
    await orders.check(connectionId);
    const { marketplaceOrderRepository } = await import("@server/channels/marketplace-order.repository");
    const claim = vi.spyOn(marketplaceOrderRepository, "claim");
    const cursor = vi.spyOn((await import("@server/channels/channel-connection.repository")).channelConnectionRepository, "setOrdersCursor");
    await orders.check(connectionId);
    expect(claim).not.toHaveBeenCalled();
    expect(cursor).not.toHaveBeenCalled();
    fake.state.orders = [line("405-Q", "QUIET", 1, "cancelled")];
    await orders.check(connectionId);
    expect(claim).toHaveBeenCalledTimes(1);
    claim.mockRestore();
    cursor.mockRestore();
  });
});
