/**
 * The feed against a real schema ([shopfront-feeds](../../docs/specs/shopfront-feeds/) D2, D6).
 * The serialiser is unit-tested in `tests/unit/shopfront-feed.test.ts`; what is checked here is
 * what only the database answers — which shops and which products reach which feed, and that the
 * declared price is the product page's price for the same moment.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { CHANNEL } from "@server/shared/channels";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("shopfront feeds, read through (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let feedXml: typeof import("@/data-access-layer/shopfront-feed.dal").shopfrontFeedXml;
  let productsDAL: typeof import("@/data-access-layer/products.dal").productsDAL;

  const stamp = `sff-${Date.now().toString(36)}`;
  const ids: Record<"live" | "onOffer" | "soldOut" | "archived" | "otherShop" | "withdrawn", string> = {
    withdrawn: "",
    live: "",
    onOffer: "",
    soldOut: "",
    archived: "",
    otherShop: "",
  };
  let orgId: string;
  let otherOrgId: string;
  let withdrawnOrgId = "";
  let savedChannels: { orgId: string; channel: string; enabled: boolean }[] = [];

  const itemFor = (xml: string, id: string) =>
    xml.split("<item>").find((item) => item.includes(`<g:id>${id}</g:id>`));

  beforeAll(async () => {
    delete process.env.BLOCK_CRAWLERS;
    ({ prisma } = await import("@server/shared/prisma"));
    ({ shopfrontFeedXml: feedXml } = await import("@/data-access-layer/shopfront-feed.dal"));
    ({ productsDAL } = await import("@/data-access-layer/products.dal"));
    const { promotionService } = await import("@server/promotions/promotion.service");
    const fixtures = await ensureFixtures();
    ({ orgId, otherOrgId } = fixtures);

    savedChannels = await prisma.orgChannel.findMany({
      where: { orgId: { in: [orgId, otherOrgId] } },
      select: { orgId: true, channel: true, enabled: true },
    });
    await prisma.orgChannel.deleteMany({ where: { orgId: { in: [orgId, otherOrgId] } } });
    // Google on and Meta off for one shop; the other shop never asked (spec R5).
    await prisma.orgChannel.createMany({
      data: [
        { orgId, channel: CHANNEL.GOOGLE, enabled: true },
        { orgId, channel: CHANNEL.META, enabled: false },
      ],
    });

    const make = async (key: keyof typeof ids, shop: string, stock: number, archived = false) => {
      const product = await prisma.product.create({
        data: {
          slug: `${stamp}-${key.toLowerCase()}`,
          name: `${stamp} ${key}`,
          description: "A fixture product.",
          price: 249900,
          thumbnail: "/brand/bhendi-bazaar.png",
          categoryId: fixtures.categoryId,
          orgId: shop,
          archivedAt: archived ? new Date() : null,
          media: { create: [{ kind: "IMAGE", ref: "/brand/bhendi-bazaar.png", position: 0, isThumbnail: true }] },
          ...(stock > 0 && shop === orgId
            ? { stockLocations: { create: [{ orgAddressId: fixtures.orgAddressId, quantity: stock }] } }
            : {}),
        },
        select: { id: true },
      });
      ids[key] = product.id;
    };
    await make("live", orgId, 3);
    await make("onOffer", orgId, 3);
    await make("soldOut", orgId, 0);
    await make("archived", orgId, 3, true);
    await make("otherShop", otherOrgId, 0);

    // A shop that said yes to Google and has since been withdrawn (FROM_ACTIVE_ORG).
    const withdrawn = await prisma.org.create({
      data: { code: stamp.toUpperCase(), handle: stamp, name: `${stamp} withdrawn`, email: `${stamp}@example.invalid`, isActive: false },
      select: { id: true },
    });
    withdrawnOrgId = withdrawn.id;
    await prisma.orgChannel.create({ data: { orgId: withdrawnOrgId, channel: CHANNEL.GOOGLE, enabled: true } });
    await make("withdrawn", withdrawnOrgId, 0);

    await promotionService.setProductMarkdown({
      productId: ids.onOffer,
      productName: `${stamp} onOffer`,
      orgId,
      fixedPricePaise: 199900,
    });
  });

  afterAll(async () => {
    if (!orgId) return;
    await prisma.promotion.deleteMany({ where: { id: `mkdn_${ids.onOffer}` } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: stamp } } });
    if (withdrawnOrgId) {
      await prisma.orgChannel.deleteMany({ where: { orgId: withdrawnOrgId } });
      await prisma.org.delete({ where: { id: withdrawnOrgId } });
    }
    await prisma.orgChannel.deleteMany({ where: { orgId: { in: [orgId, otherOrgId] } } });
    if (savedChannels.length > 0) await prisma.orgChannel.createMany({ data: savedChannels });
  });

  it("lists a shop's new product in the feed of a channel it turned on (spec A1)", async () => {
    const item = itemFor(await feedXml(CHANNEL.GOOGLE), ids.live);
    expect(item).toBeDefined();
    expect(item).toContain("<g:availability>in_stock</g:availability>");
  });

  it("declares the product page's own offer price, with the list price beside it (spec A2)", async () => {
    const page = await productsDAL.getProductById(ids.onOffer);
    const item = itemFor(await feedXml(CHANNEL.GOOGLE), ids.onOffer);
    expect(page.salePrice).toBe(199900);
    expect(item).toContain("<g:price>2499.00 INR</g:price>");
    expect(item).toContain("<g:sale_price>1999.00 INR</g:sale_price>");
  });

  it("declares sold out as out of stock and leaves archived goods out (spec A3)", async () => {
    const xml = await feedXml(CHANNEL.GOOGLE);
    expect(itemFor(xml, ids.soldOut)).toContain("<g:availability>out_of_stock</g:availability>");
    expect(itemFor(xml, ids.archived)).toBeUndefined();
  });

  it("leaves out a withdrawn shop's goods though it turned the channel on (spec R4)", async () => {
    expect(itemFor(await feedXml(CHANNEL.GOOGLE), ids.withdrawn)).toBeUndefined();
  });

  it("keeps each channel its own answer: Google on and Meta off is one feed only (spec A4)", async () => {
    const [google, meta] = await Promise.all([feedXml(CHANNEL.GOOGLE), feedXml(CHANNEL.META)]);
    expect(itemFor(google, ids.live)).toBeDefined();
    expect(itemFor(meta, ids.live)).toBeUndefined();
    // A shop that was never asked is in neither.
    expect(itemFor(google, ids.otherShop)).toBeUndefined();
    expect(itemFor(meta, ids.otherShop)).toBeUndefined();
  });

  it("lists nothing while the pre-launch crawl block is on (spec R8)", async () => {
    process.env.BLOCK_CRAWLERS = "1";
    try {
      expect(itemFor(await feedXml(CHANNEL.GOOGLE), ids.live)).toBeUndefined();
    } finally {
      delete process.env.BLOCK_CRAWLERS;
    }
  });
});
