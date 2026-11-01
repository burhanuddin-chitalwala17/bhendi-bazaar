/**
 * The marketplace order safety net costs the same number of database statements for one shop as for
 * many (inventory-sync Q26): every statement is a billed operation on Prisma Postgres, and a per-shop
 * loop of queries is how onboarding shops quietly became the bill. Counted through PRISMA_LOG_QUERIES,
 * as tests/integration/db-ops-budget.test.ts does.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

process.env.PRISMA_LOG_QUERIES = "1";

const fake = vi.hoisted(() => ({
  failFor: new Set<string>(),
  linesFor: new Map<string, unknown[]>(),
  provider: {
    readOrders: async (_token: unknown, account: string | null) => {
      if (fake.failFor.has(account ?? "")) throw new Error("marketplace down");
      return { lines: fake.linesFor.get(account ?? "") ?? [], cursor: new Date().toISOString() };
    },
  },
}));
vi.mock("@server/channels/providers", () => ({ providerFor: () => fake.provider }));

let queryCount = 0;
let spy: MockInstance;

describe.skipIf(!isDisposableDb)("order safety net: database cost does not grow with shops (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orders: typeof import("@server/channels/channel-orders.service").channelOrdersService;
  const stamp = Date.now();
  const orgIds: string[] = [];
  const accounts: string[] = [];
  let categoryId: string;

  const line = (account: string) => ({
    orderId: `${account}-ORDER`,
    lineId: `${account}-ORDER-1`,
    sku: `OCB-${stamp}-UNLINKED`,
    quantity: 1,
    locationExternalId: "DEFAULT",
    state: "open",
    amountPaise: 99_900,
    orderedAt: new Date(),
  });

  /** A shop with stock sync on, its one waiting order already recorded, due a check now. */
  async function shop(i: number) {
    const code = `OCB-${stamp}-${i}`;
    const org = await prisma.org.create({
      data: { code, handle: `ocb-${stamp}-${i}`, name: `Order budget ${i}`, email: `ocb-${stamp}-${i}@example.invalid`, profile: { create: {} }, listingDefaults: { create: {} } },
      select: { id: true },
    });
    orgIds.push(org.id);
    const account = `ACC-${stamp}-${i}`;
    accounts.push(account);
    await prisma.channelConnection.create({
      data: { orgId: org.id, channel: "amazon", state: "CONNECTED", externalAccountId: account, refreshToken: "sealed-test", stockSync: "on", stockSyncChangedAt: new Date(Date.now() - 3_600_000) },
    });
    fake.linesFor.set(account, [line(account)]);
  }

  /** Make every test shop due again, as the next ten-minute run would find them. */
  const due = () => prisma.channelConnection.updateMany({ where: { orgId: { in: orgIds } }, data: { ordersCheckedAt: null } });

  async function count(run: () => Promise<unknown>): Promise<number> {
    queryCount = 0;
    await run();
    return queryCount;
  }

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ channelOrdersService: orders } = await import("@server/channels/channel-orders.service"));
    ({ categoryId } = await ensureFixtures());
    void categoryId;
    // Only this file's shops may be claimed: park any other connection with sync on.
    await prisma.channelConnection.updateMany({ where: { stockSync: "on" }, data: { ordersCheckedAt: new Date() } });
    spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      if (typeof args[0] === "string" && args[0].startsWith("prisma:query")) queryCount++;
    });
  });

  beforeEach(() => {
    fake.failFor.clear();
  });

  afterAll(async () => {
    spy?.mockRestore();
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

  it("a quiet run costs the same for one shop as for six", async () => {
    await shop(0);
    await orders.checkDue(async () => {}); // records the waiting order: real work, not measured
    await due();
    const one = await count(() => orders.checkDue(async () => {}));

    for (let i = 1; i < 6; i++) await shop(i);
    await orders.checkDue(async () => {});
    await due();
    const six = await count(() => orders.checkDue(async () => {}));

    expect(await prisma.marketplaceOrder.count({ where: { orgId: { in: orgIds } } })).toBe(6);
    expect(six, `one shop cost ${one} statements, six cost ${six}`).toBe(one);
    expect(one).toBeLessThanOrEqual(3); // the claim, the read of recorded lines, nothing written
  });

  it("one shop's marketplace failing leaves the others checked and its own cursor where it was", async () => {
    const [first, ...rest] = accounts;
    const before = await prisma.channelConnection.findFirstOrThrow({ where: { externalAccountId: first }, select: { ordersCursor: true } });
    fake.failFor.add(first);
    for (const account of accounts) fake.linesFor.set(account, [line(account), { ...line(account), orderId: `${account}-SECOND`, lineId: `${account}-SECOND-1` }]);
    await due();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await orders.checkDue(async () => {});

    const recorded = await prisma.marketplaceOrder.findMany({ where: { orgId: { in: orgIds }, orderId: { endsWith: "-SECOND" } }, select: { orderId: true } });
    expect(recorded.map((r) => r.orderId).sort()).toEqual(rest.map((a) => `${a}-SECOND`).sort());
    const after = await prisma.channelConnection.findFirstOrThrow({ where: { externalAccountId: first }, select: { ordersCursor: true } });
    expect(after.ordersCursor).toBe(before.ordersCursor);
  });
});
