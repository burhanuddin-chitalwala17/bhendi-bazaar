/**
 * Reading a shop's marketplace listings against a real schema (channel-import). The marketplace is a
 * fake provider; under test is what we store and decide: rows keyed so a retry writes the same ones,
 * gone only after a finished read, one read at a time, a second shop's account refused, and the
 * owner's unlink never undone by a read.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { isDisposableDb, ensureFixtures } from "../helpers/test-db";
import type { ReadListing } from "@server/channels/channel-listing.repository";
import type { ListingSink } from "@server/channels/providers/listing-read";

const fake = vi.hoisted(() => {
  const state = {
    account: "ACCOUNT-A" as string,
    listings: [] as ReadListing[],
    /** Throw this after the first batch, to stand for a read cut short. */
    failAfterFirst: null as null | "busy" | "auth",
    /** Holds a read open until released, so a second read can try to start meanwhile. */
    gate: null as null | Promise<void>,
  };
  const provider = {
    channel: "flipkart",
    connectionCap: null as number | null,
    configured: () => true,
    consentUrl: (s: string) => `https://consent.example/?state=${encodeURIComponent(s)}`,
    readReturn: (p: URLSearchParams) => ({ state: p.get("state"), code: p.get("code"), declined: !p.get("code"), externalAccountId: null }),
    exchange: async () => ({
      accessToken: "access-1",
      accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      refreshToken: "refresh-1",
      refreshTokenExpiresAt: null,
    }),
    renew: async () => {
      throw new Error("not expected");
    },
    check: async () => undefined,
    readListings: async (token: () => Promise<string>, _known: string | null, sink: ListingSink) => {
      const { MarketplaceAuthError, MarketplaceUnavailableError } = await import("@server/channels/providers/marketplace-provider");
      await token();
      await sink.account(state.account);
      if (state.gate) await state.gate;
      const half = Math.ceil(state.listings.length / 2);
      await sink.batch(state.listings.slice(0, half), { done: half, total: state.listings.length });
      if (state.failAfterFirst === "busy") throw new MarketplaceUnavailableError(503);
      if (state.failAfterFirst === "auth") throw new MarketplaceAuthError("revoked");
      await sink.batch(state.listings.slice(half), { done: state.listings.length, total: state.listings.length });
    },
  };
  return { state, provider };
});

vi.mock("@server/channels/providers", () => ({ providerFor: () => fake.provider }));

const listing = (sku: string, extra: Partial<ReadListing> = {}): ReadListing => ({
  sku,
  skuKey: sku.trim().toLowerCase(),
  externalId: `FSN-${sku}`,
  title: `Title ${sku}`,
  imageUrl: null,
  status: "LIVE",
  pricePaise: 79_900,
  quantity: 3,
  parentSku: null,
  parentTitle: null,
  variationAxis: null,
  ...extra,
});

describe.skipIf(!isDisposableDb)("marketplace listing reads (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let connections: typeof import("@server/channels/channel-connection.service").channelConnectionService;
  let imports: typeof import("@server/channels/channel-import.service").channelImportService;
  let orgId: string;
  let otherOrgId: string;
  let userId: string;
  let categoryId: string;
  const productIds: string[] = [];

  const cleanup = async () => {
    const orgs = { orgId: { in: [orgId, otherOrgId] } };
    await prisma.channelListing.deleteMany({ where: orgs });
    await prisma.channelConnection.deleteMany({ where: orgs });
    await prisma.orgChannel.deleteMany({ where: orgs });
  };

  async function connect(shop: string): Promise<string> {
    const start = await connections.startConnect(shop, userId, "flipkart");
    if (!("redirectTo" in start)) throw new Error(`no redirect: ${JSON.stringify(start)}`);
    const state = new URL(start.redirectTo).searchParams.get("state")!;
    const { consent, check } = connections.readReturn("flipkart", new URLSearchParams({ state, code: "CODE" }));
    if (!check.ok) throw new Error("state did not verify");
    await connections.completeConnect(check.state, consent);
    const row = await prisma.channelConnection.findUniqueOrThrow({ where: { orgId_channel: { orgId: shop, channel: "flipkart" } } });
    return row.id;
  }

  const rows = (connectionId: string) =>
    prisma.channelListing.findMany({ where: { connectionId }, orderBy: { sku: "asc" } });

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ channelConnectionService: connections } = await import("@server/channels/channel-connection.service"));
    ({ channelImportService: imports } = await import("@server/channels/channel-import.service"));
    ({ orgId, otherOrgId, userId, categoryId } = await ensureFixtures());
    process.env.CHANNELS_CONNECT = "amazon,flipkart";
    await cleanup();
    const stamp = Date.now();
    for (const sku of ["KRT-1", "PINS-24"]) {
      const row = await prisma.product.create({
        data: {
          name: `Import ${sku}`,
          slug: `import-${sku.toLowerCase()}-${stamp}`,
          description: "Created by tests/integration/channel-import.test.ts",
          price: 99_900,
          thumbnail: "https://placehold.co/600x600",
          categoryId,
          orgId,
          sku,
        },
        select: { id: true },
      });
      productIds.push(row.id);
    }
  });

  beforeEach(async () => {
    await cleanup();
    Object.assign(fake.state, { account: "ACCOUNT-A", listings: [], failAfterFirst: null, gate: null });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  });

  it("links by SKU ignoring case and spaces, a second read writes the same rows, and no product is made (spec A2, A4, A6)", async () => {
    const id = await connect(orgId);
    const productsBefore = await prisma.product.count({ where: { orgId } });
    fake.state.listings = [listing(" krt-1 "), listing("NEW-9")];
    await imports.runRead(id);
    await imports.runRead(id);
    expect(await prisma.product.count({ where: { orgId } })).toBe(productsBefore);

    const after = await rows(id);
    expect(after.map((r) => r.sku)).toEqual([" krt-1 ", "NEW-9"]);
    expect(after[0]).toMatchObject({ productId: productIds[0], linkSource: "SKU", goneAt: null });
    expect(after[1].productId).toBeNull();
    const connection = await prisma.channelConnection.findUniqueOrThrow({ where: { id } });
    expect(connection).toMatchObject({ readState: "DONE", readDone: 2, externalAccountId: "ACCOUNT-A" });
  });

  it("marks unseen rows gone only when a read finishes (spec A5, D8)", async () => {
    const id = await connect(orgId);
    fake.state.listings = [listing("KRT-1"), listing("OLD-1")];
    await imports.runRead(id);

    // Cut short after its first half: OLD-1 was not seen, but the read did not finish.
    fake.state.listings = [listing("KRT-1"), listing("NEW-2")];
    fake.state.failAfterFirst = "busy";
    await expect(imports.runRead(id)).rejects.toThrow(/unavailable|503/i);
    expect((await rows(id)).every((r) => r.goneAt === null)).toBe(true);
    expect(await prisma.channelConnection.findUniqueOrThrow({ where: { id } })).toMatchObject({ readState: "STOPPED", readErrorCode: "busy" });

    fake.state.failAfterFirst = null;
    await imports.runRead(id);
    const after = await rows(id);
    expect(after.find((r) => r.sku === "OLD-1")?.goneAt).not.toBeNull();
    expect(after.find((r) => r.sku === "KRT-1")?.goneAt).toBeNull();
  });

  it("runs one read at a time; a second finds it claimed and exits (D3)", async () => {
    const id = await connect(orgId);
    fake.state.listings = [listing("KRT-1")];
    let release!: () => void;
    fake.state.gate = new Promise<void>((resolve) => (release = resolve));

    const first = imports.runRead(id);
    await vi.waitFor(async () =>
      expect((await prisma.channelConnection.findUniqueOrThrow({ where: { id } })).readState).toBe("RUNNING"),
    );
    expect(await imports.runRead(id)).toEqual({ claimed: false });
    release();
    expect(await first).toMatchObject({ claimed: true, seen: 1 });
  });

  it("refuses an account already connected to another shop, before writing a row (D6, Q10)", async () => {
    const first = await connect(otherOrgId);
    await imports.runRead(first);
    const second = await connect(orgId);
    fake.state.listings = [listing("KRT-1")];

    expect(await imports.runRead(second)).toMatchObject({ stopped: "other_shop" });
    expect(await rows(second)).toEqual([]);
    const row = await prisma.channelConnection.findUniqueOrThrow({ where: { id: second } });
    expect(row).toMatchObject({ state: "DISCONNECTED", accessToken: null, refreshToken: null, lastErrorCode: "other_shop" });
    const sells = await prisma.orgChannel.findFirst({ where: { orgId, channel: "flipkart" } });
    expect(sells?.enabled ?? false).toBe(false);
  });

  it("stops as needs-reconnecting when the marketplace refuses our access (D9)", async () => {
    const id = await connect(orgId);
    fake.state.listings = [listing("KRT-1"), listing("NEW-2")];
    fake.state.failAfterFirst = "auth";
    expect(await imports.runRead(id)).toMatchObject({ stopped: "auth" });
    expect(await prisma.channelConnection.findUniqueOrThrow({ where: { id } })).toMatchObject({
      state: "NEEDS_RECONNECT",
      readState: "STOPPED",
      readErrorCode: "auth",
    });
  });

  it("an unlink survives the next read, and Link back restores only that SKU match (spec A3, Q16)", async () => {
    const id = await connect(orgId);
    fake.state.listings = [listing("PINS-24")];
    await imports.runRead(id);
    const [row] = await rows(id);

    await imports.unlink(orgId, userId, row.id);
    await imports.runRead(id);
    expect((await rows(id))[0]).toMatchObject({ productId: null, unlinkedById: userId });

    await expect(imports.linkBack(otherOrgId, row.id)).rejects.toThrow(/Unlinked listing/);
    const back = await imports.linkBack(orgId, row.id);
    expect(back.product?.id).toBe(productIds[1]);
    expect((await rows(id))[0]).toMatchObject({ productId: productIds[1], linkSource: "SKU", unlinkedAt: null });
  });

  it("stops when the account read is not the one this connection learned, writing nothing (D6)", async () => {
    const id = await connect(orgId);
    await prisma.channelConnection.update({ where: { id }, data: { externalAccountId: "ACCOUNT-OLD" } });
    fake.state.listings = [listing("KRT-1")];
    expect(await imports.runRead(id)).toMatchObject({ stopped: "different_account" });
    expect(await rows(id)).toEqual([]);
    expect(await prisma.channelConnection.findUniqueOrThrow({ where: { id } })).toMatchObject({ state: "CONNECTED", externalAccountId: "ACCOUNT-OLD" });
  });

  it("takes over a read whose worker went silent, and only then (D3)", async () => {
    const id = await connect(orgId);
    fake.state.listings = [listing("KRT-1")];
    const recent = new Date(Date.now() - 60_000);
    await prisma.channelConnection.update({ where: { id }, data: { readState: "RUNNING", readTouchedAt: recent } });
    expect(await imports.runRead(id)).toEqual({ claimed: false });
    await prisma.channelConnection.update({ where: { id }, data: { readTouchedAt: new Date(Date.now() - 10 * 60_000) } });
    expect(await imports.runRead(id)).toMatchObject({ claimed: true, seen: 1 });
  });

  it("refuses to delete a product a listing links to (D1)", async () => {
    const id = await connect(orgId);
    fake.state.listings = [listing("KRT-1")];
    await imports.runRead(id);
    const { productsService } = await import("@server/catalog/admin.product.service");
    await expect(productsService.deleteProduct(productIds[0])).rejects.toThrow(/1 marketplace listing/);
  });
});
