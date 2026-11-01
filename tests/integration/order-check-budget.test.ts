/**
 * The marketplace order safety net costs the same number of database statements for one shop as for
 * many (inventory-sync Q26): every statement is a billed operation on Prisma Postgres, and a per-shop
 * loop of queries is how onboarding shops quietly became the bill. Counted through PRISMA_LOG_QUERIES,
 * as tests/integration/db-ops-budget.test.ts does.
 */
import "dotenv/config";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi, type MockInstance } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

process.env.PRISMA_LOG_QUERIES = "1";

const fake = vi.hoisted(() => ({
  failFor: new Set<string>(),
  linesFor: new Map<string, unknown[]>(),
  duringRead: null as null | ((account: string) => Promise<void>),
  provider: {
    // Asks for its token as the real providers do, so the token path runs on every shop.
    readOrders: async (token: () => Promise<string>, account: string | null) => {
      await token();
      if (fake.failFor.has(account ?? "")) throw new Error("marketplace down");
      if (fake.duringRead) await fake.duringRead(account ?? "");
      return { lines: fake.linesFor.get(account ?? "") ?? [], cursor: new Date().toISOString() };
    },
  },
}));
vi.mock("@server/channels/providers", () => ({ providerFor: () => fake.provider }));

let queryCount = 0;
let logSpy: MockInstance;

describe.skipIf(!isDisposableDb)("order safety net: database cost does not grow with shops (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orders: typeof import("@server/channels/channel-orders.service").channelOrdersService;
  let READ_CONCURRENCY: number;
  let encryptSecret: (plain: string) => string;
  const stamp = Date.now();
  const orgIds: string[] = [];
  const accounts: string[] = [];

  const line = (account: string, suffix = "ORDER") => ({
    orderId: `${account}-${suffix}`,
    lineId: `${account}-${suffix}-1`,
    sku: `OCB-${stamp}-UNLINKED`,
    quantity: 1,
    locationExternalId: "DEFAULT",
    state: "open",
    amountPaise: 99_900,
    orderedAt: new Date(),
  });

  /** A shop with stock sync on and a valid stored token, its one waiting order reported each check. */
  async function shop(i: number) {
    const org = await prisma.org.create({
      data: { code: `OCB-${stamp}-${i}`, handle: `ocb-${stamp}-${i}`, name: `Order budget ${i}`, email: `ocb-${stamp}-${i}@example.invalid`, profile: { create: {} }, listingDefaults: { create: {} } },
      select: { id: true },
    });
    orgIds.push(org.id);
    const account = `ACC-${stamp}-${i}`;
    accounts.push(account);
    await prisma.channelConnection.create({
      data: {
        orgId: org.id, channel: "amazon", state: "CONNECTED", externalAccountId: account, stockSync: "on",
        stockSyncChangedAt: new Date(Date.now() - 3_600_000),
        refreshToken: encryptSecret("refresh"), accessToken: encryptSecret("access"), accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    fake.linesFor.set(account, [line(account)]);
  }

  /** Make every test shop due again, as the next ten-minute run would find them. */
  const due = () => prisma.channelConnection.updateMany({ where: { orgId: { in: orgIds } }, data: { ordersCheckedAt: null } });
  const cursorOf = async (account: string) =>
    (await prisma.channelConnection.findFirstOrThrow({ where: { externalAccountId: account }, select: { ordersCursor: true } })).ordersCursor;

  async function count(run: () => Promise<unknown>): Promise<number> {
    queryCount = 0;
    await run();
    return queryCount;
  }

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ channelOrdersService: orders, READ_CONCURRENCY } = await import("@server/channels/channel-orders.service"));
    ({ encryptSecret } = await import("@server/shared/crypto"));
    await ensureFixtures();
    // Only this file's shops may be claimed: park any other connection with sync on.
    await prisma.channelConnection.updateMany({ where: { stockSync: "on" }, data: { ordersCheckedAt: new Date() } });
    logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      if (typeof args[0] === "string" && args[0].startsWith("prisma:query")) queryCount++;
    });
  });

  afterEach(() => {
    fake.failFor.clear();
    fake.duringRead = null;
  });

  afterAll(async () => {
    logSpy?.mockRestore();
    await prisma.marketplaceOrder.deleteMany({ where: { orgId: { in: orgIds } } });
    await prisma.channelConnection.deleteMany({ where: { orgId: { in: orgIds } } });
    await prisma.orgProfile.deleteMany({ where: { orgId: { in: orgIds } } });
    await prisma.orgListingDefaults.deleteMany({ where: { orgId: { in: orgIds } } });
    await prisma.org.deleteMany({ where: { id: { in: orgIds } } });
  });

  it("is actually counting statements", async () => {
    const n = await count(() => prisma.org.count());
    expect(n, "PRISMA_LOG_QUERIES is not reaching the client").toBeGreaterThan(0);
  });

  it("a quiet run costs the same for one shop as for more shops than read at once", async () => {
    // More than two rounds of concurrent reads: Prisma folds concurrent findUniques into one
    // statement, so a per-shop read would hide below this many.
    const many = READ_CONCURRENCY * 2 + 1;

    await shop(0);
    await orders.checkDue(async () => {}); // records the waiting order: real work, not measured
    await due();
    const one = await count(() => orders.checkDue(async () => {}));

    for (let i = 1; i < many; i++) await shop(i);
    await orders.checkDue(async () => {});
    await due();
    const all = await count(() => orders.checkDue(async () => {}));

    expect(await prisma.marketplaceOrder.count({ where: { orgId: { in: orgIds } } })).toBe(many);
    expect(all, `one shop cost ${one} statements, ${many} cost ${all}`).toBe(one);
    expect(one).toBeLessThanOrEqual(3); // the claim, the read of recorded lines, nothing written
  });

  it("one shop's marketplace failing leaves the others checked and its own cursor where it was", async () => {
    const [first, ...rest] = accounts;
    const before = await cursorOf(first);
    fake.failFor.add(first);
    for (const account of accounts) fake.linesFor.set(account, [line(account), line(account, "SECOND")]);
    await due();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    await orders.checkDue(async () => {});
    errors.mockRestore();

    const recorded = await prisma.marketplaceOrder.findMany({ where: { orgId: { in: orgIds }, orderId: { endsWith: "-SECOND" } }, select: { orderId: true } });
    expect(recorded.map((r) => r.orderId).sort()).toEqual(rest.map((a) => `${a}-SECOND`).sort());
    expect(await cursorOf(first)).toBe(before);
  });

  it("one shop's unreadable stored token is that shop's failure, not the run's", async () => {
    const [first, ...rest] = accounts;
    await prisma.channelConnection.updateMany({ where: { externalAccountId: first }, data: { accessToken: "not-a-sealed-secret" } });
    for (const account of accounts) fake.linesFor.set(account, [line(account), line(account, "THIRD")]);
    await due();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    await orders.checkDue(async () => {});
    errors.mockRestore();

    const recorded = await prisma.marketplaceOrder.findMany({ where: { orgId: { in: orgIds }, orderId: { endsWith: "-THIRD" } }, select: { orderId: true } });
    expect(recorded.map((r) => r.orderId).sort()).toEqual(rest.map((a) => `${a}-THIRD`).sort());
  });

  it("never overwrites a cursor that moved while the run was reading (sync turned off and on)", async () => {
    const account = accounts[1];
    for (const a of accounts) fake.linesFor.set(a, [line(a), line(a, "FOURTH")]);
    fake.duringRead = async (reading) => {
      if (reading === account) await prisma.channelConnection.updateMany({ where: { externalAccountId: account }, data: { ordersCursor: "2026-11-01T00:00:00.000Z" } });
    };
    await due();

    await orders.checkDue(async () => {});

    expect(await cursorOf(account)).toBe("2026-11-01T00:00:00.000Z");
    expect(await cursorOf(accounts[2])).not.toBe("2026-11-01T00:00:00.000Z");
  });
});
