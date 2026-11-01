/**
 * Each product's marketplace listing against a real schema (channel-listings D1–D6): made with what
 * is live, computed from the product, saved as only what differs, compared on its version.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

vi.mock("@server/channels/providers", async () => {
  const { AMAZON_LISTING_RULES, amazonTheirsFromRead } = await import("@server/channels/providers/amazon/amazon.publish");
  const { FLIPKART_LISTING_RULES, flipkartTheirsFromRead } = await import("@server/channels/providers/flipkart/flipkart.publish");
  const providers = {
    amazon: { listingRules: AMAZON_LISTING_RULES, theirsFromRead: amazonTheirsFromRead },
    flipkart: { listingRules: FLIPKART_LISTING_RULES, theirsFromRead: flipkartTheirsFromRead },
  };
  return { providerFor: (channel: "amazon" | "flipkart") => providers[channel] };
});

describe.skipIf(!isDisposableDb)("channel listings (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let listings: typeof import("@server/channels/platform-listing.service").platformListingService;
  let orgId: string;
  let categoryId: string;
  const connections: Record<string, string> = {};
  const stamp = Date.now();

  const product = async (s: string, mirror: { channel: "amazon" | "flipkart"; title?: string; pricePaise?: number; bullets?: string[] }) => {
    const p = await prisma.product.create({
      data: { name: `Abaya ${s}`, slug: `cl-${stamp}-${s}`, description: "Ours.", price: 129_900, categoryId, thumbnail: "/brand/bhendi-bazaar.png", orgId, sku: `CL-${stamp}-${s}` },
      select: { id: true },
    });
    await prisma.channelListing.create({
      data: {
        connectionId: connections[mirror.channel], orgId, channel: mirror.channel, sku: `CL-${stamp}-${s}`, skuKey: `cl-${stamp}-${s}`,
        productId: p.id, linkSource: "SKU", linkedAt: new Date(), lastSeenAt: new Date(),
        title: mirror.title ?? `Abaya ${s}`, pricePaise: mirror.pricePaise ?? 129_900,
        attributes: mirror.bullets ? { type: "ABAYA", attributes: { bullet_point: mirror.bullets }, details: {} } : undefined,
      },
    });
    return p.id;
  };

  const cleanup = async () => {
    await prisma.platformListing.deleteMany({ where: { orgId } });
    await prisma.channelListing.deleteMany({ where: { orgId, sku: { startsWith: `CL-${stamp}` } } });
    await prisma.product.deleteMany({ where: { orgId, sku: { startsWith: `CL-${stamp}` } } });
  };

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ platformListingService: listings } = await import("@server/channels/platform-listing.service"));
    ({ orgId, categoryId } = await ensureFixtures());
    await prisma.platformListing.deleteMany({ where: { orgId } });
    await prisma.channelListing.deleteMany({ where: { orgId } });
    await prisma.channelLocation.deleteMany({ where: { orgId } });
    await prisma.channelConnection.deleteMany({ where: { orgId } });
    for (const channel of ["amazon", "flipkart"] as const) {
      connections[channel] = (
        await prisma.channelConnection.create({ data: { orgId, channel, state: "CONNECTED", externalAccountId: `${channel}-${stamp}`, refreshToken: "sealed-test" }, select: { id: true } })
      ).id;
    }
  });
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.channelConnection.deleteMany({ where: { orgId } });
  });

  it("keeps what is live where it differs from the product, with nothing waiting (spec A4)", async () => {
    const id = await product("LIVE", { channel: "amazon", title: "Premium Nida abaya burqa", pricePaise: 134_900, bullets: ["Soft fabric"] });
    const screen = await listings.screen(orgId, id, "amazon");
    expect(screen.values.title).toBe("Premium Nida abaya burqa");
    expect(screen.values.price).toBe(134_900);
    expect(screen.values.features).toEqual(["Soft fabric"]);
    expect(screen.own).toMatchObject({ title: true, price: true, features: true, description: false });
    expect(screen.waitingFields).toEqual([]);
    expect(screen.status.status).toBe("live");
  });

  it("shows a product change as waiting on a listing that inherits it (spec A6)", async () => {
    const id = await product("INHERIT", { channel: "amazon" });
    await listings.screen(orgId, id, "amazon");
    await prisma.product.update({ where: { id }, data: { description: "New words." } });
    const screen = await listings.screen(orgId, id, "amazon");
    expect(screen.waitingFields).toEqual(["description"]);
    expect(screen.status.status).toBe("waiting");
  });

  it("saves an override, and going back to the product's clears it (spec A1, A2)", async () => {
    const id = await product("SAVE", { channel: "amazon" });
    const opened = await listings.screen(orgId, id, "amazon");
    const saved = await listings.save(orgId, id, "amazon", { seenVersion: opened.version, overrides: { title: "Short title" } });
    expect(saved.waiting).toBe(1);
    const changed = await listings.screen(orgId, id, "amazon");
    expect(changed.own.title).toBe(true);
    expect(changed.product.title).toBe("Abaya SAVE");
    await listings.save(orgId, id, "amazon", { seenVersion: changed.version, overrides: {} });
    const back = await listings.screen(orgId, id, "amazon");
    expect(back.own.title).toBe(false);
    expect(back.waitingFields).toEqual([]);
  });

  it("refuses a save from a screen opened before another save (D4)", async () => {
    const id = await product("STALE", { channel: "amazon" });
    const opened = await listings.screen(orgId, id, "amazon");
    await listings.save(orgId, id, "amazon", { seenVersion: opened.version, overrides: { title: "First" } });
    await expect(listings.save(orgId, id, "amazon", { seenVersion: opened.version, overrides: { title: "Second" } })).rejects.toThrow(/changed since you opened it/);
  });

  it("keeps only what Flipkart takes: price and on sale, never its catalogue's title (spec A5, Q4)", async () => {
    const id = await product("FK", { channel: "flipkart", title: "Niqab Boutique Nida Solid Abaya", pricePaise: 129_900 });
    const opened = await listings.screen(orgId, id, "flipkart");
    expect(opened.theirs.title).toBe("Niqab Boutique Nida Solid Abaya");
    expect(opened.own.title).toBe(false);
    await listings.save(orgId, id, "flipkart", { seenVersion: opened.version, overrides: { title: "Ignored", price: 124_900 } });
    const after = await listings.screen(orgId, id, "flipkart");
    expect(after.own.title).toBe(false);
    expect(after.waitingFields).toEqual(["price"]);
  });

  it("makes one row however many times it is opened at once (D3)", async () => {
    const id = await product("ONCE", { channel: "amazon" });
    await Promise.all([listings.screen(orgId, id, "amazon"), listings.screen(orgId, id, "amazon"), listings.summaries(orgId, id)]);
    expect(await prisma.platformListing.count({ where: { productId: id } })).toBe(1);
  });
});
