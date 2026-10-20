/**
 * A shop's marketplace connections against a real schema (channel-connectors). The marketplace is
 * a fake provider; what is under test is what we store and decide: tokens sealed, one shop per
 * account, the channel turned on and off with the connection, renewals that cannot lose a refresh
 * token, and the card states the Channels page renders.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

const fake = vi.hoisted(() => {
  const state = { renewCalls: 0, exchangeAccount: "SELLER-A" as string | null, checkFails: null as null | "auth" | "down" };
  const provider = {
    channel: "amazon",
    connectionCap: 25 as number | null,
    configured: () => true,
    consentUrl: (s: string, r: string) => `https://consent.example/?state=${encodeURIComponent(s)}&redirect=${encodeURIComponent(r)}`,
    readReturn: (p: URLSearchParams) => ({
      state: p.get("state"),
      code: p.get("code"),
      declined: !p.get("code"),
      externalAccountId: p.get("account"),
    }),
    exchange: async () => ({
      accessToken: "access-1",
      accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      refreshToken: "refresh-1",
      refreshTokenExpiresAt: null,
    }),
    renew: async (refresh: string) => {
      state.renewCalls++;
      await new Promise((r) => setTimeout(r, 50));
      return {
        accessToken: `access-after-${refresh}`,
        accessTokenExpiresAt: new Date(Date.now() + 3600_000),
        refreshToken: `${refresh}-next`,
        refreshTokenExpiresAt: null,
      };
    },
    check: async () => {
      const { MarketplaceAuthError, MarketplaceUnavailableError } = await import(
        "@server/channels/providers/marketplace-provider"
      );
      if (state.checkFails === "auth") throw new MarketplaceAuthError("revoked");
      if (state.checkFails === "down") throw new MarketplaceUnavailableError(503);
    },
  };
  return { state, provider };
});

vi.mock("@server/channels/providers", () => ({ providerFor: () => fake.provider }));

describe.skipIf(!isDisposableDb)("marketplace connections (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let service: typeof import("@server/channels/channel-connection.service").channelConnectionService;
  let verify: typeof import("@server/channels/connect-state").verifyConnectState;
  let orgId: string;
  let otherOrgId: string;
  let userId: string;

  const cleanup = async () => {
    await prisma.channelConnection.deleteMany({ where: { orgId: { in: [orgId, otherOrgId] } } });
    await prisma.orgChannel.deleteMany({ where: { orgId: { in: [orgId, otherOrgId] } } });
  };

  /** Start a connect and come back from the fake marketplace with this account. */
  async function connect(shop: string, account: string | null) {
    const start = await service.startConnect(shop, userId, "amazon");
    if (!("redirectTo" in start)) throw new Error(`no redirect: ${JSON.stringify(start)}`);
    const state = new URL(start.redirectTo).searchParams.get("state")!;
    const params = new URLSearchParams({ state, code: "CODE", ...(account ? { account } : {}) });
    const { consent, check } = service.readReturn("amazon", params);
    if (!check.ok) throw new Error("state did not verify");
    return await service.completeConnect(check.state, consent);
  }

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ channelConnectionService: service } = await import("@server/channels/channel-connection.service"));
    ({ verifyConnectState: verify } = await import("@server/channels/connect-state"));
    ({ orgId, otherOrgId, userId } = await ensureFixtures());
    process.env.CHANNELS_CONNECT = "amazon,flipkart";
    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();
    fake.state.renewCalls = 0;
    fake.state.checkFails = null;
    fake.provider.connectionCap = 25;
    await prisma.org.updateMany({ where: { id: { in: [orgId, otherOrgId] } }, data: { isBlocked: false } });
  });

  afterAll(async () => {
    await cleanup();
  });

  it("connects, seals the tokens, and turns the channel on in the same step (spec A1, A6, D11)", async () => {
    expect(await connect(orgId, "SELLER-A")).toBe("connected");
    const row = await prisma.channelConnection.findUniqueOrThrow({ where: { orgId_channel: { orgId, channel: "amazon" } } });
    expect(row.state).toBe("CONNECTED");
    expect(row.accessToken).not.toContain("access-1");
    expect(row.refreshToken).toMatch(/^v1:/);
    const choice = await prisma.orgChannel.findUnique({ where: { orgId_channel: { orgId, channel: "amazon" } } });
    expect(choice?.enabled).toBe(true);
  });

  it("refuses an Amazon account already connected to another shop (spec A3)", async () => {
    expect(await connect(otherOrgId, "SELLER-A")).toBe("connected");
    expect(await connect(orgId, "SELLER-A")).toBe("other_shop");
    expect(await prisma.channelConnection.count({ where: { orgId } })).toBe(0);
  });

  it("refuses a different account on reconnect; switching is disconnect, then connect (Q8)", async () => {
    await connect(orgId, "SELLER-A");
    expect(await connect(orgId, "SELLER-B")).toBe("different_account");
    await service.disconnect(orgId, userId, "amazon");
    expect(await connect(orgId, "SELLER-B")).toBe("connected");
  });

  it("calls a declined consent cancelled and stores nothing (Q7)", async () => {
    const start = await service.startConnect(orgId, userId, "amazon");
    if (!("redirectTo" in start)) throw new Error("no redirect");
    const state = new URL(start.redirectTo).searchParams.get("state")!;
    const { consent, check } = service.readReturn("amazon", new URLSearchParams({ state }));
    if (!check.ok) throw new Error("state did not verify");
    expect(await service.completeConnect(check.state, consent)).toBe("cancelled");
    expect(await prisma.channelConnection.count({ where: { orgId } })).toBe(0);
  });

  it("connects nothing when the return's state is forged (spec A2)", () => {
    expect(verify("forged.state").ok).toBe(false);
  });

  it("disconnect deletes the tokens, keeps who and when, and turns the channel off (spec A5, Q4)", async () => {
    await connect(orgId, "SELLER-A");
    await service.disconnect(orgId, userId, "amazon");
    const row = await prisma.channelConnection.findUniqueOrThrow({ where: { orgId_channel: { orgId, channel: "amazon" } } });
    expect(row).toMatchObject({ state: "DISCONNECTED", accessToken: null, refreshToken: null, disconnectedById: userId });
    expect(row.connectedById).toBe(userId);
    const choice = await prisma.orgChannel.findUnique({ where: { orgId_channel: { orgId, channel: "amazon" } } });
    expect(choice?.enabled).toBe(false);
  });

  it("two renewals at once spend the refresh token once and agree on the result (hazard 1, D8)", async () => {
    await connect(orgId, "SELLER-A");
    const row = await prisma.channelConnection.findUniqueOrThrow({ where: { orgId_channel: { orgId, channel: "amazon" } } });
    await prisma.channelConnection.update({ where: { id: row.id }, data: { accessTokenExpiresAt: new Date(Date.now() - 1000) } });

    const [a, b] = await Promise.all([service.accessToken(row.id), service.accessToken(row.id)]);
    expect(fake.state.renewCalls).toBe(1);
    expect(a).toBe("access-after-refresh-1");
    expect(b).toBe(a);
  });

  it("a refused health check marks the connection for reconnecting, with a reason (R5)", async () => {
    await connect(orgId, "SELLER-A");
    fake.state.checkFails = "auth";
    expect(await service.check(orgId, "amazon")).toBe("needs_reconnect");
    const card = (await service.overview(orgId)).cards.find((c) => c.channel === "amazon");
    expect(card).toMatchObject({ state: "needs_reconnect", reason: "revoked" });
  });

  it("an unreachable marketplace leaves the connection as it was", async () => {
    await connect(orgId, "SELLER-A");
    fake.state.checkFails = "down";
    expect(await service.check(orgId, "amazon")).toBe("unreachable");
    expect((await service.overview(orgId)).cards.find((c) => c.channel === "amazon")?.state).toBe("connected");
  });

  it("derives renewal due 30 days before Amazon's yearly re-approval, and raises it on the dashboard (R5, R9)", async () => {
    await connect(orgId, "SELLER-A");
    const now = new Date();
    const authorizedAt = new Date(now.getTime() - (365 - 20) * 86_400_000);
    await prisma.channelConnection.updateMany({ where: { orgId }, data: { authorizedAt } });
    const overview = await service.overview(orgId, now);
    expect(overview.cards.find((c) => c.channel === "amazon")?.state).toBe("renewal_due");
    expect(overview.attention).toEqual([expect.objectContaining({ channel: "amazon", state: "renewal_due" })]);

    await prisma.channelConnection.updateMany({ where: { orgId }, data: { authorizedAt: new Date(now.getTime() - 300 * 86_400_000) } });
    expect((await service.overview(orgId, now)).cards.find((c) => c.channel === "amazon")?.state).toBe("connected");
  });

  it("shows a marketplace outside the switch as unavailable, and refuses to start it (Q10)", async () => {
    process.env.CHANNELS_CONNECT = "flipkart";
    try {
      expect((await service.overview(orgId)).cards.find((c) => c.channel === "amazon")?.state).toBe("unavailable");
      expect(await service.startConnect(orgId, userId, "amazon")).toEqual({ result: "unavailable" });
    } finally {
      process.env.CHANNELS_CONNECT = "amazon,flipkart";
    }
  });

  it("shows Amazon full at its cap, and refuses a new shop while letting a connected one reconnect (R10)", async () => {
    await connect(otherOrgId, "SELLER-A");
    fake.provider.connectionCap = 1;
    expect((await service.overview(orgId)).cards.find((c) => c.channel === "amazon")?.state).toBe("full");
    expect(await service.startConnect(orgId, userId, "amazon")).toEqual({ result: "full" });
    expect("redirectTo" in (await service.startConnect(otherOrgId, userId, "amazon"))).toBe(true);
  });

  it("lists cards in display order: own store, marketplaces, then feeds", async () => {
    const order = (await service.overview(orgId)).cards.map((c) => c.channel);
    expect(order).toEqual(["store", "amazon", "flipkart", "google", "meta"]);
  });

  it("the daily pass checks live connections and skips a suspended shop (D7, Q11)", async () => {
    await connect(orgId, "SELLER-A");
    await connect(otherOrgId, "SELLER-B");
    const suspended = new Set([otherOrgId]);
    const summary = await service.maintain(async (id) => suspended.has(id));
    expect(summary.skipped).toBe(1);
    expect(summary.checked).toBe(1);
  });
});
