/**
 * Bulk product actions against a real database (design-system Q29). What can go wrong is what
 * Postgres does with one statement over many rows: a shop reaching another shop's row through a
 * crafted id, a percentage rounding the wrong way, a stock row overwritten after it moved, an
 * archive that is not idempotent, a send whose jobs commit apart from its claims, and a statement
 * count that grows with the selection. Local disposable database, or skip.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureFixtures, ensureOrgMember, isDisposableDb } from "../helpers/test-db";
import { JOBS_QUEUE, JOBS_SCHEMA } from "@server/shared/jobs/jobs.config";

// Counted by the budget test; every statement line is swallowed so the run stays quiet.
process.env.PRISMA_LOG_QUERIES = "1";
let counting = false;
let statements = 0;
vi.spyOn(console, "log").mockImplementation((...args) => {
  if (typeof args[0] === "string" && args[0].startsWith("prisma:query") && counting) statements++;
});

const stamp = `bulk-${Date.now()}`;
const created: string[] = [];

describe.skipIf(!isDisposableDb)("bulk product actions (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let bulk: typeof import("@server/catalog/product-bulk.service").productBulkService;
  let team: typeof import("@server/catalog/product-team.service").productTeamService;
  let publish: typeof import("@server/channels/listing-publish.service").listingPublishService;
  let T: typeof import("@server/catalog/product-bulk.types");
  let fx: Awaited<ReturnType<typeof ensureFixtures>>;
  let actor: { kind: "org"; orgId: string; userId: string };

  const product = async (orgId: string, price: number, stock: number | null = 5, extra: { sku?: string } = {}) => {
    const n = `${created.length}-${Math.random().toString(36).slice(2, 8)}`;
    const location = orgId === fx.orgId ? fx.orgAddressId : null;
    const row = await prisma.product.create({
      data: {
        slug: `${stamp}-${n}`,
        name: `Bulk test ${n}`,
        description: "Created by tests/integration/product-bulk-actions.test.ts",
        price,
        categoryId: fx.categoryId,
        orgId,
        thumbnail: "/brand/bhendi-bazaar.png",
        ...extra,
        ...(stock !== null && location ? { stockLocations: { create: { orgAddressId: location, quantity: stock } } } : {}),
      },
      select: { id: true },
    });
    created.push(row.id);
    return row.id;
  };
  const priceOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id }, select: { price: true } })).price;
  const jobsFor = async (key: "productId" | "listingId", ids: string[]) =>
    (await prisma.$queryRawUnsafe<Array<{ data: { type: string; payload: Record<string, unknown> } }>>(
      `SELECT data FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'${key}' = ANY($2::text[])`,
      JOBS_QUEUE,
      ids,
    )).map((row) => row.data);

  /** "Stock changed" jobs (inventory-sync Q27) naming any of these products: one per bulk action. */
  const stockChangedFor = async (ids: string[]) =>
    await prisma.$queryRawUnsafe<Array<{ products: Array<{ productId: string; soldOut: boolean }> }>>(
      `SELECT data->'payload'->'products' AS products FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->>'type' = 'channels.stock-changed' AND EXISTS (SELECT 1 FROM jsonb_array_elements(data->'payload'->'products') p WHERE p->>'productId' = ANY($2::text[]))`,
      JOBS_QUEUE,
      ids,
    );
  const byId = (rows: Array<{ productId: string; soldOut: boolean }>) => [...rows].sort((x, y) => x.productId.localeCompare(y.productId));

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ productBulkService: bulk } = await import("@server/catalog/product-bulk.service"));
    ({ productTeamService: team } = await import("@server/catalog/product-team.service"));
    ({ listingPublishService: publish } = await import("@server/channels/listing-publish.service"));
    T = await import("@server/catalog/product-bulk.types");
    fx = await ensureFixtures();
    const member = await ensureOrgMember(fx.orgId, fx.userId);
    actor = { kind: T.BULK_ACTOR.ORG, orgId: fx.orgId, userId: member.userId };
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND (data->'payload'->>'productId' = ANY($2::text[]) OR data->'payload'->>'orgId' = $3)`,
      JOBS_QUEUE,
      created,
      fx.orgId,
    );
    await prisma.platformListing.deleteMany({ where: { productId: { in: created } } });
    await prisma.channelListing.deleteMany({ where: { productId: { in: created } } });
    await prisma.channelConnection.deleteMany({ where: { orgId: fx.orgId, externalAccountId: stamp } });
    await prisma.adminLog.deleteMany({ where: { resource: "Product", resourceId: { in: created } } });
    await prisma.product.deleteMany({ where: { id: { in: created } } });
  });

  it("never touches another shop's product, even named in the selection", async () => {
    const mine = await product(fx.orgId, 10_000);
    const theirs = await product(fx.otherOrgId, 10_000, null);
    const result = await bulk.setPrice(actor, [mine, theirs, "no-such-id"], { mode: T.BULK_PRICE_MODE.SET, pricePaise: 12_345 });
    expect(result.updated).toBe(1);
    expect(result.skipped).toEqual([
      { productId: theirs, reason: T.BULK_SKIP_REASON.NOT_FOUND },
      { productId: "no-such-id", reason: T.BULK_SKIP_REASON.NOT_FOUND },
    ]);
    expect(await priceOf(mine)).toBe(12_345);
    expect(await priceOf(theirs)).toBe(10_000);

    const archived = await bulk.archive(actor, [theirs]);
    expect(archived.updated).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: theirs } })).archivedAt).toBeNull();

    const stock = await bulk.setStock(actor, [{ productId: theirs, orgAddressId: fx.orgAddressId, quantity: 9, seenQuantity: 0 }]);
    expect(stock.skipped).toEqual([{ productId: theirs, reason: T.BULK_SKIP_REASON.NOT_FOUND }]);
    expect(await prisma.productStock.count({ where: { productId: theirs } })).toBe(0);
  });

  it("moves prices in integer paise; a percentage rounds to the nearest paisa, half away from zero", async () => {
    // 999 * 1.125 = 1123.875 → 1124; 1001 * 1.125 = 1126.125 → 1126; 4 * 0.875 = 3.5 → 4 (half up).
    const [a, b, c] = [await product(fx.orgId, 999), await product(fx.orgId, 1_001), await product(fx.orgId, 4)];
    const up = await bulk.setPrice(actor, [a, b], { mode: T.BULK_PRICE_MODE.PERCENT, percent: 12.5 });
    expect(up.updated).toBe(2);
    expect([await priceOf(a), await priceOf(b)]).toEqual([1_124, 1_126]);
    await bulk.setPrice(actor, [c], { mode: T.BULK_PRICE_MODE.PERCENT, percent: -12.5 });
    expect(await priceOf(c)).toBe(4);

    const down = await bulk.setPrice(actor, [a, c], { mode: T.BULK_PRICE_MODE.AMOUNT, deltaPaise: -1_000 });
    expect(down.updated).toBe(1);
    expect(down.skipped).toEqual([{ productId: c, reason: T.BULK_SKIP_REASON.PRICE_TOO_LOW }]);
    expect([await priceOf(a), await priceOf(c)]).toEqual([124, 4]);

    const same = await bulk.setPrice(actor, [a], { mode: T.BULK_PRICE_MODE.SET, pricePaise: 124 });
    expect(same.skipped).toEqual([{ productId: a, reason: T.BULK_SKIP_REASON.UNCHANGED }]);
  });

  it("moves the version, so a form open on the product is refused rather than undoing the change", async () => {
    const id = await product(fx.orgId, 5_000);
    const before = await prisma.product.findUniqueOrThrow({ where: { id }, select: { version: true } });
    await bulk.setPrice(actor, [id], { mode: T.BULK_PRICE_MODE.AMOUNT, deltaPaise: 100 });
    const after = await prisma.product.findUniqueOrThrow({ where: { id }, select: { version: true, lastEditedById: true, teamEditedAt: true } });
    expect(after).toEqual({ version: before.version + 1, lastEditedById: actor.userId, teamEditedAt: null });
  });

  it("refuses a stock row that moved after the editor read it, and writes the rest", async () => {
    const [moved, fine, fresh] = [await product(fx.orgId, 1_000, 5), await product(fx.orgId, 1_000, 5), await product(fx.orgId, 1_000, null)];
    // A sale lands on `moved` after the editor saw 5.
    await prisma.productStock.update({ where: { productId_orgAddressId: { productId: moved, orgAddressId: fx.orgAddressId } }, data: { quantity: 4 } });
    const result = await bulk.setStock(actor, [
      { productId: moved, orgAddressId: fx.orgAddressId, quantity: 20, seenQuantity: 5 },
      { productId: fine, orgAddressId: fx.orgAddressId, quantity: 0, seenQuantity: 5 },
      { productId: fresh, orgAddressId: fx.orgAddressId, quantity: 7, seenQuantity: 0 },
    ]);
    expect(result.updated).toBe(2);
    expect(result.conflicts).toEqual([{ productId: moved, orgAddressId: fx.orgAddressId, seenQuantity: 5, currentQuantity: 4 }]);
    const rows = await prisma.productStock.findMany({ where: { productId: { in: [moved, fine, fresh] } }, select: { productId: true, quantity: true } });
    expect(Object.fromEntries(rows.map((r) => [r.productId, r.quantity]))).toEqual({ [moved]: 4, [fresh]: 7 });
    // Marketplaces hear each changed product's count: one job for the whole edit, in the same transaction.
    const jobs = await stockChangedFor([fine, fresh]);
    expect(jobs).toHaveLength(1);
    expect(byId(jobs[0].products)).toEqual(byId([{ productId: fine, soldOut: true }, { productId: fresh, soldOut: false }]));
  });

  it("archives idempotently, and tells marketplaces each newly archived product sells nowhere", async () => {
    const [a, b] = [await product(fx.orgId, 1_000), await product(fx.orgId, 1_000)];
    const first = await bulk.archive(actor, [a, b]);
    expect(first.updated).toBe(2);
    const second = await bulk.archive(actor, [a, b]);
    expect(second.updated).toBe(0);
    expect(second.skipped.map((s) => s.reason)).toEqual([T.BULK_SKIP_REASON.ALREADY_ARCHIVED, T.BULK_SKIP_REASON.ALREADY_ARCHIVED]);
    const soldOut = await stockChangedFor([a, b]);
    expect(soldOut).toHaveLength(1);
    expect(byId(soldOut[0].products)).toEqual(byId([{ productId: a, soldOut: true }, { productId: b, soldOut: true }]));
    const trail = await prisma.adminLog.count({ where: { resource: "Product", resourceId: { in: [a, b] }, action: T.PRODUCT_AUDIT_ACTION.ARCHIVED } });
    expect(trail).toBe(2);
  });

  it("the team leaves archived products alone and writes its reason on each one it changes", async () => {
    const [live, gone] = [await product(fx.orgId, 2_000), await product(fx.orgId, 2_000)];
    await bulk.archive(actor, [gone]);
    const result = await team.bulkEdit(fx.userId, "Fixing a typo in the price", {
      action: T.BULK_ACTION.PRICE,
      productIds: [live, gone],
      change: { mode: T.BULK_PRICE_MODE.SET, pricePaise: 2_500 },
    });
    expect(result.skipped).toEqual([{ productId: gone, reason: T.BULK_SKIP_REASON.ARCHIVED }]);
    const entry = await prisma.adminLog.findFirstOrThrow({ where: { resource: "Product", resourceId: live, action: "PRODUCT_TEAM_UPDATED" } });
    expect(entry.metadata).toMatchObject({ reason: "Fixing a typo in the price", changes: [{ field: "price", before: 2_000, after: 2_500 }] });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: live } })).teamEditedAt).not.toBeNull();
  });

  it("a location outside the product's shop matches nothing", async () => {
    const theirs = await product(fx.otherOrgId, 1_000, null);
    const result = await team.bulkEdit(fx.userId, "Stock count from the shop", {
      action: T.BULK_ACTION.STOCK,
      rows: [{ productId: theirs, orgAddressId: fx.orgAddressId, quantity: 3, seenQuantity: 0 }],
    });
    expect(result.skipped).toEqual([{ productId: theirs, reason: T.BULK_SKIP_REASON.LOCATION_NOT_FOUND }]);
    expect(await prisma.productStock.count({ where: { productId: theirs } })).toBe(0);
  });

  it("sends each waiting listing: one claim and one job per product, committed together", async () => {
    const { encryptSecret } = await import("@server/shared/crypto");
    await prisma.platformListing.deleteMany({ where: { orgId: fx.orgId, channel: "amazon" } });
    await prisma.channelListing.deleteMany({ where: { orgId: fx.orgId, channel: "amazon" } });
    await prisma.channelConnection.deleteMany({ where: { orgId: fx.orgId, channel: "amazon" } });
    const connection = await prisma.channelConnection.create({
      data: { orgId: fx.orgId, channel: "amazon", state: "CONNECTED", externalAccountId: stamp, refreshToken: encryptSecret("r"), accessToken: encryptSecret("a"), accessTokenExpiresAt: new Date(Date.now() + 3_600_000) },
      select: { id: true },
    });
    const linked = async (n: number) => {
      const id = await product(fx.orgId, 44_900, 5, { sku: `${stamp}-sku-${n}` });
      await prisma.channelListing.create({
        data: { connectionId: connection.id, orgId: fx.orgId, channel: "amazon", sku: `${stamp}-sku-${n}`, skuKey: `${stamp}-sku-${n}`, externalId: `X${n}`, productId: id, linkSource: "SKU", linkedAt: new Date(), lastSeenAt: new Date(), title: `Bulk test`, pricePaise: 44_900 },
      });
      return id;
    };
    const [a, b, unlisted] = [await linked(1), await linked(2), await product(fx.orgId, 1_000)];

    // First look makes each listing with what is live, so nothing waits yet.
    const idle = await publish.bulkSend(actor, "amazon", [a, b, unlisted]);
    expect(idle.updated).toBe(0);
    expect(idle.skipped).toEqual([
      { productId: a, reason: T.BULK_SKIP_REASON.NOTHING_TO_SEND },
      { productId: b, reason: T.BULK_SKIP_REASON.NOTHING_TO_SEND },
      { productId: unlisted, reason: T.BULK_SKIP_REASON.NOT_ON_MARKETPLACE },
    ]);

    await bulk.setPrice(actor, [a, b], { mode: T.BULK_PRICE_MODE.SET, pricePaise: 49_900 });
    const sent = await publish.bulkSend(actor, "amazon", [a, b]);
    expect(sent.updated).toBe(2);
    const listings = await prisma.platformListing.findMany({ where: { productId: { in: [a, b] } }, select: { id: true, publishState: true, pending: true } });
    expect(listings.map((l) => l.publishState)).toEqual(["sent", "sent"]);
    expect(listings.every((l) => (l.pending as { price?: number }).price === 49_900)).toBe(true);
    const jobs = await jobsFor("listingId", listings.map((l) => l.id));
    expect(jobs.map((j) => j.type)).toEqual(["channels.publish-listing", "channels.publish-listing"]);

    // Already on its way: a second send claims nothing and queues nothing.
    const again = await publish.bulkSend(actor, "amazon", [a]);
    expect(again.skipped).toEqual([{ productId: a, reason: T.BULK_SKIP_REASON.SEND_IN_PROGRESS }]);
    expect(await jobsFor("listingId", listings.map((l) => l.id))).toHaveLength(2);
  });

  it("spends the same number of statements on 2 products as on 12", async () => {
    const count = async (run: () => Promise<unknown>) => {
      statements = 0;
      counting = true;
      try {
        await run();
      } finally {
        counting = false;
      }
      return statements;
    };
    const make = async (n: number) => Promise.all(Array.from({ length: n }, () => product(fx.orgId, 1_000, 5)));
    const [few, many] = [await make(2), await make(12)];
    const price = (ids: string[]) => () => bulk.setPrice(actor, ids, { mode: T.BULK_PRICE_MODE.PERCENT, percent: 10 });
    const stock = (ids: string[]) => () => bulk.setStock(actor, ids.map((productId) => ({ productId, orgAddressId: fx.orgAddressId, quantity: 8, seenQuantity: 5 })));
    const archive = (ids: string[]) => () => bulk.archive(actor, ids);
    for (const action of [price, stock, archive]) {
      const [small, large] = [await count(action(few)), await count(action(many))];
      expect(small, "the instrument is counting").toBeGreaterThan(0);
      expect(large).toBe(small);
    }
  });
});
