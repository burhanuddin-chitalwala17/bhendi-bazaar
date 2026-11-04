/**
 * Image slots against a real database (image-slots spec R2, R4, R7, R8, R9): a banner saved with a
 * desktop crop and a phone version comes back on the storefront read with both; another shop
 * cannot use this shop's picture; a banner saved before image slots still renders; a picture used
 * only as a phone version counts as used and cannot be retired.
 *
 * Needs the local database; skips anywhere else.
 */
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const RUN = Date.now().toString(36);
const ref = (name: string) => `https://cdn.bhendi-bazaar.com/test/image-slots-${RUN}-${name}.webp`;

describe.runIf(isDisposableDb)("image slots round trip", () => {
  const assetIds: string[] = [];
  const orgBannerIds: string[] = [];
  const bannerIds: string[] = [];

  const makeAsset = async (orgId: string | null, name: string, width: number, height: number) => {
    const { prisma } = await import("@server/shared/prisma");
    const asset = await prisma.mediaAsset.create({
      data: { kind: "IMAGE", source: "UPLOAD", state: "READY", orgId, ref: ref(name), width, height },
    });
    assetIds.push(asset.id);
    return asset;
  };

  afterAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    // Also every banner carrying this run's pictures: a save the test expects refused is never pushed,
    // so a broken guard (or a mutation run) would otherwise leave a live banner on the dev Home.
    const mine = { startsWith: `https://cdn.bhendi-bazaar.com/test/image-slots-${RUN}-` };
    const byPicture = { OR: [{ imageUrl: mine }, { phoneImageUrl: mine }] };
    await prisma.orgBanner.deleteMany({ where: { OR: [{ id: { in: orgBannerIds } }, byPicture] } });
    await prisma.banner.deleteMany({ where: { OR: [{ id: { in: bannerIds } }, byPicture] } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: assetIds } } });
  });

  it("saves a shop banner's desktop crop and phone version, and the storefront reads both back", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { storefrontService } = await import("@server/catalog/storefront.service");
    const { storefrontDAL } = await import("@/data-access-layer/storefront.dal");
    const { orgBannerSchema } = await import("@/lib/validation/schemas/org-banner.schema");
    const { mediaAssetRepository } = await import("@server/catalog/media-asset.repository");
    const { orgId } = await ensureFixtures();

    const desktop = await makeAsset(orgId, "desktop", 1600, 660);
    const phone = await makeAsset(orgId, "phone", 1080, 1350);
    // Exactly what the field posts: the frame flush with the bottom of a picture a little too tall.
    const body = orgBannerSchema.parse({
      title: "Image slots probe",
      image: {
        desktop: { url: desktop.ref, fit: "crop", crop: { x: 0, y: 20 / 660, width: 1, height: 640 / 660 } },
        phone: { url: phone.ref, fit: "contain", fill: "#203040" },
      },
    });
    const created = await storefrontService.addBanner(orgId, body);
    orgBannerIds.push(created.id);

    const stored = await prisma.orgBanner.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored).toMatchObject({ imageAssetId: desktop.id, phoneImageAssetId: phone.id, phoneImageUrl: phone.ref });
    expect(stored.imageFraming).toMatchObject({ desktop: { crop: { x: 0, y: 20, width: 1600, height: 640 } } });

    const [promotion] = (await storefrontDAL.promotionsFor(orgId)).filter((p) => p.id === created.id);
    expect(promotion.image?.desktop).toEqual({ src: desktop.ref, fit: "crop", position: { x: 0.5, y: 1 }, fill: null });
    expect(promotion.image?.phone).toEqual({ src: phone.ref, fit: "contain", position: { x: 0.5, y: 0.5 }, fill: "#203040" });

    // A phone version is a use (R9): listed, and the picture cannot be retired from under the banner.
    const uses = await mediaAssetRepository.usesOf(phone.id);
    expect(uses.map((u) => u.label)).toContain("Image slots probe (phone)");
    expect(await mediaAssetRepository.retireUnused(orgId, phone.id)).toBe(false);
  });

  it("refuses another shop's picture on this shop's banner", async () => {
    const { storefrontService } = await import("@server/catalog/storefront.service");
    const { orgBannerSchema } = await import("@/lib/validation/schemas/org-banner.schema");
    const { orgId, otherOrgId } = await ensureFixtures();
    const theirs = await makeAsset(otherOrgId, "theirs", 1600, 640);

    const body = orgBannerSchema.parse({ title: "Not mine", image: { desktop: { url: theirs.ref, fit: "crop" } } });
    await expect(storefrontService.addBanner(orgId, body)).rejects.toThrow(/your own library/);
  });

  it("keeps a banner saved before image slots rendering, phones included", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { storefrontDAL } = await import("@/data-access-layer/storefront.dal");
    const { orgId } = await ensureFixtures();
    const legacy = await prisma.orgBanner.create({
      data: { orgId, title: "Before image slots", imageUrl: ref("legacy"), order: 999 },
    });
    orgBannerIds.push(legacy.id);

    const [promotion] = (await storefrontDAL.promotionsFor(orgId)).filter((p) => p.id === legacy.id);
    expect(promotion.image?.desktop.src).toBe(ref("legacy"));
    expect(promotion.image?.phone).toEqual({ src: ref("legacy"), fit: "crop", position: { x: 0.5, y: 0.5 }, fill: null });
  });

  it("saves a home banner from the platform's library and refuses a shop's picture there", async () => {
    const { bannerService } = await import("@server/catalog/banner.service");
    const { bannerFormSchema } = await import("@/lib/validation/schemas/banner.schema");
    const { toHeroBanner } = await import("@/data-access-layer/banners.dal");
    const { orgId, userId } = await ensureFixtures();
    const platform = await makeAsset(null, "platform", 1080, 1350);
    const shops = await makeAsset(orgId, "shops", 1080, 1350);

    const banner = await bannerService.create(
      userId,
      bannerFormSchema.parse({ title: "Home probe", image: { phone: { url: platform.ref, fit: "crop" } } }),
    );
    bannerIds.push(banner.id);
    expect(toHeroBanner(banner).image?.phone.src).toBe(platform.ref);
    // No desktop version: a wide screen draws the phone picture rather than nothing.
    expect(toHeroBanner(banner).image?.desktop.src).toBe(platform.ref);

    await expect(
      bannerService.create(userId, bannerFormSchema.parse({ title: "Home probe 2", image: { desktop: { url: shops.ref, fit: "crop" } } })),
    ).rejects.toThrow(/your own library/);
  });
});
