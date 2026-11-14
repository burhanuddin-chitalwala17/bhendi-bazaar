/**
 * A locked shop is absent from every public output (subscriptions/feature-access spec A2, A4; D10, D11):
 * the `/store` directory and the sitemap's shop list, the Google feed, the product page's "Sold by" link,
 * and a non-member's view of its storefront. Its products still sell on Bhendi Bazaar (Q8).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CHANNEL } from "@server/shared/channels";

import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

let viewer: { user: { id: string; platformRole: string } } | null = null;
vi.mock("@/lib/admin-auth", () => ({
  optionalActiveSession: async () => viewer,
  isPlatformAdminSession: (session: { user: { platformRole: string } }) => session.user.platformRole === "ADMIN",
}));

describe.skipIf(!isDisposableDb)("feature locks on public reads (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let access: typeof import("@server/subscriptions/feature-access.service").featureAccessService;
  let FEATURE: typeof import("@server/subscriptions/feature-access.types").FEATURE;
  let storefrontAccessDAL: typeof import("@/data-access-layer/storefront-access.dal").storefrontAccessDAL;

  const stamp = `fp${Date.now().toString(36)}`;
  let shopId: string;
  let productId: string;
  let memberId: string;
  let adminId: string;
  let strangerId: string;

  beforeAll(async () => {
    delete process.env.BLOCK_CRAWLERS;
    ({ prisma } = await import("@server/shared/prisma"));
    ({ featureAccessService: access } = await import("@server/subscriptions/feature-access.service"));
    ({ FEATURE } = await import("@server/subscriptions/feature-access.types"));
    ({ storefrontAccessDAL } = await import("@/data-access-layer/storefront-access.dal"));
    const fixtures = await ensureFixtures();
    adminId = fixtures.userId;
    const shop = await prisma.org.create({
      data: {
        code: stamp, handle: stamp, name: `${stamp} shop`, email: `${stamp}@example.invalid`,
        profile: { create: {} }, listingDefaults: { create: {} },
        orgAddresses: { create: { name: "Pickup", contactName: "A", contactPhone: "9999999999", isActive: true, address: { create: { addressLine1: "1 Road", city: "Mumbai", state: "Maharashtra", pincode: "400001" } } } },
      },
      select: { id: true, orgAddresses: { select: { id: true } } },
    });
    shopId = shop.id;
    productId = (
      await prisma.product.create({
        data: {
          slug: `${stamp}-p`, name: `${stamp} product`, description: "A fixture product.", price: 99900,
          thumbnail: "/brand/bhendi-bazaar.png", categoryId: fixtures.categoryId, orgId: shopId,
          media: { create: [{ kind: "IMAGE", ref: "/brand/bhendi-bazaar.png", position: 0, isThumbnail: true }] },
          stockLocations: { create: [{ orgAddressId: shop.orgAddresses[0].id, quantity: 3 }] },
        },
        select: { id: true },
      })
    ).id;
    await prisma.orgChannel.create({ data: { orgId: shopId, channel: CHANNEL.GOOGLE, enabled: true } });
    const member = await prisma.user.create({ data: { email: `${stamp}-m@example.invalid` }, select: { id: true } });
    const stranger = await prisma.user.create({ data: { email: `${stamp}-s@example.invalid` }, select: { id: true } });
    memberId = member.id;
    strangerId = stranger.id;
    await prisma.orgMember.create({ data: { orgId: shopId, userId: memberId, role: "OWNER" } });
  });

  afterAll(async () => {
    // An undefined id is no filter to Prisma: a failed setup would otherwise delete every row.
    if (!shopId || !productId) return;
    await prisma.adminLog.deleteMany({ where: { resourceId: shopId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    const links = await prisma.orgAddress.findMany({ where: { orgId: shopId }, select: { addressId: true } });
    await prisma.orgAddress.deleteMany({ where: { orgId: shopId } });
    await prisma.address.deleteMany({ where: { id: { in: links.map((link) => link.addressId) } } });
    await prisma.org.deleteMany({ where: { id: shopId } });
    await prisma.user.deleteMany({ where: { id: { in: [memberId, strangerId] } } });
  });

  it("keeps a locked storefront out of the directory and the sitemap, and lists it once open (spec A4, Q7)", async () => {
    const { storefrontDAL } = await import("@/data-access-layer/storefront.dal");
    expect((await storefrontDAL.listShops()).map((s) => s.handle)).not.toContain(stamp);
    await access.set(adminId, shopId, FEATURE.STOREFRONT, true);
    // `listShops` is memoised per request; a new request is a new call outside React's cache.
    const { orgProfileRepository } = await import("@server/catalog/org-profile.repository");
    const open = await access.allowedOrgs(FEATURE.STOREFRONT, (await orgProfileRepository.listPublicShops()).map((r) => r.orgId));
    expect(open.has(shopId)).toBe(true);
    await access.set(adminId, shopId, FEATURE.STOREFRONT, false);
  });

  it("closes a locked storefront to a guest and a stranger, and opens it to its team and the admin (spec A4, Q6)", async () => {
    viewer = null;
    expect(await storefrontAccessDAL.forViewer(shopId)).toBe("closed");
    viewer = { user: { id: strangerId, platformRole: "USER" } };
    expect(await storefrontAccessDAL.forViewer(shopId)).toBe("closed");
    viewer = { user: { id: memberId, platformRole: "USER" } };
    expect(await storefrontAccessDAL.forViewer(shopId)).toBe("team");
    viewer = { user: { id: adminId, platformRole: "ADMIN" } };
    expect(await storefrontAccessDAL.forViewer(shopId)).toBe("team");
    expect(await storefrontAccessDAL.isOpen(shopId)).toBe(false);
  });

  it("leaves a shop without Channels out of the Google feed, and puts it in once on (spec A2)", async () => {
    const { shopfrontFeedXml } = await import("@/data-access-layer/shopfront-feed.dal");
    expect(await shopfrontFeedXml(CHANNEL.GOOGLE)).not.toContain(`<g:id>${productId}</g:id>`);
    await access.set(adminId, shopId, FEATURE.CHANNELS, true);
    expect(await shopfrontFeedXml(CHANNEL.GOOGLE)).toContain(`<g:id>${productId}</g:id>`);
    await access.set(adminId, shopId, FEATURE.CHANNELS, false);
  });

  it("still sells a locked shop's product on Bhendi Bazaar (Q8)", async () => {
    const { productsDAL } = await import("@/data-access-layer/products.dal");
    const product = await productsDAL.getProductBySlug(`${stamp}-p`);
    expect(product?.id).toBe(productId);
  });
});
