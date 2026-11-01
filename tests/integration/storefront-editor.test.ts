/**
 * The themed page's editor against a real schema (storefront-themes U6; D13; Q9, Q10, Q21, Q43,
 * Q44; A4, A7; ADR-0058). A save is a compare-and-set on the version the sheet read, so a second
 * member's save is "Changed by {Name}", not lost; a claim must be on the shop's own list; a
 * collection must be a category it sells; a slot's photo is a use the library can see; a hidden
 * section's words never reach a buyer's payload.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("storefront editor (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let storefrontService: typeof import("@server/catalog/storefront.service").storefrontService;
  let mediaAssetService: typeof import("@server/catalog/media-asset.service").mediaAssetService;
  let storefrontLookService: typeof import("@server/catalog/storefront-look.service").storefrontLookService;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const handle = `editor-test-${stamp}`;
  const prefix = `https://media.test/${stamp}/`;
  let orgId: string;
  let anaId: string;
  let ravId: string;
  let categoryId: string;
  let photoId: string;
  const productIds: string[] = [];

  const version = async () => (await storefrontService.getSettings(orgId)).updatedAt;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ storefrontService } = await import("@server/catalog/storefront.service"));
    ({ mediaAssetService } = await import("@server/catalog/media-asset.service"));
    ({ storefrontLookService } = await import("@server/catalog/storefront-look.service"));
    const { orgRepository } = await import("@server/catalog/org.repository");
    const { mediaAssetRepository } = await import("@server/catalog/media-asset.repository");
    const fixtures = await ensureFixtures();
    categoryId = fixtures.categoryId;
    orgId = (
      await orgRepository.create({
        code: `EDT-T${stamp}`.slice(0, 20),
        handle,
        name: `Editor Test ${stamp}`,
        email: `editor-${stamp}@example.invalid`,
        isActive: true,
        description: "Who we are.",
      })
    ).id;
    await prisma.orgProfile.update({ where: { orgId }, data: { themeKey: "darbar", paletteKey: "emerald" } });
    anaId = (await prisma.user.create({ data: { email: `ana-${stamp}@example.invalid`, name: "Ana" } })).id;
    ravId = (await prisma.user.create({ data: { email: `rav-${stamp}@example.invalid`, name: "Rav" } })).id;
    for (const key of ["ring", "chain"]) {
      const row = await prisma.product.create({
        data: {
          name: `Editor ${key}`,
          slug: `editor-${key}-${stamp}`,
          description: "fixture",
          price: 10_000,
          thumbnail: "https://example.invalid/editor.webp",
          categoryId,
          productType: "jewellery",
          orgId,
        },
        select: { id: true },
      });
      productIds.push(row.id);
    }
    photoId = (
      await mediaAssetRepository.createReady({
        orgId,
        uploaderId: null,
        ref: `${prefix}hero.webp`,
        objectKey: `test/${stamp}/hero.webp`,
        mimeType: "image/webp",
        bytes: 10,
        width: 1600,
        height: 900,
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.orgStorefrontSlot.deleteMany({ where: { orgId } });
    await prisma.mediaAsset.deleteMany({ where: { orgId } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.org.delete({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [anaId, ravId] } } });
  });

  it("refuses a save at a version another member has moved past, naming them (D13, Stale)", async () => {
    const seen = await version();
    await storefrontService.saveSettings(orgId, anaId, { expectedUpdatedAt: seen, heroLine: "Gold since 1952" });
    await expect(
      storefrontService.saveSettings(orgId, ravId, { expectedUpdatedAt: seen, heroLine: "Mine" }),
    ).rejects.toThrow("Changed by Ana just now. Load theirs?");
    const row = await prisma.orgProfile.findUnique({ where: { orgId } }).then((r) => r!);
    expect(row.heroLine).toBe("Gold since 1952");
    expect(row.contentEditedByUserId).toBe(anaId);
  });

  it("does not name the last content editor when Shop details moved the version (D13, Stale)", async () => {
    const { shopDetailsService } = await import("@server/catalog/shop-details.service");
    const seen = await version();
    await shopDetailsService.saveSection(orgId, { section: "place", location: "Bhendi Bazaar", expectedUpdatedAt: seen });
    await expect(
      storefrontService.saveSettings(orgId, anaId, { expectedUpdatedAt: seen, heroLine: "Late" }),
    ).rejects.toThrow("Changed by another member just now. Load theirs?");
  });

  it("saves twice in a row from the version each save returns", async () => {
    const first = await storefrontService.saveSettings(orgId, anaId, { expectedUpdatedAt: await version(), heroLine: "One" });
    const second = await storefrontService.saveSettings(orgId, anaId, { expectedUpdatedAt: first.updatedAt, heroLine: "Two" });
    expect(second.updatedAt).not.toBe(first.updatedAt);
  });

  it("takes only claims on the shop's own list, and shows their labels apart from figures (Q21, A7)", async () => {
    await expect(
      storefrontService.saveSettings(orgId, anaId, { expectedUpdatedAt: await version(), claims: [{ key: "alcoholFree" }] }),
    ).rejects.toThrow("That claim isn't on your shop's list.");
    await storefrontService.saveSettings(orgId, anaId, {
      expectedUpdatedAt: await version(),
      claims: [{ key: "hallmarked", detail: "Every piece, card in the box" }, { key: "giftWrap" }],
    });
    const page = await storefrontService.storefrontPage(handle);
    expect(page?.claims).toEqual([
      { label: "BIS hallmarked", detail: "Every piece, card in the box" },
      { label: "Gift wrapping on request", detail: null },
    ]);
  });

  it("suggests the theme for what the shop mostly sells (Q19, Q44)", async () => {
    expect((await storefrontLookService.getLook(orgId)).suggested).toEqual({ theme: "darbar", label: "Jewellery" });
  });

  it("refuses a collection the shop does not sell in, and a photo that is not its own (Q10)", async () => {
    await expect(
      storefrontService.saveSettings(orgId, anaId, { expectedUpdatedAt: await version(), collections: [{ categoryId: "not-sold-here" }] }),
    ).rejects.toThrow("Pick a category your shop sells in.");
    await expect(
      storefrontService.saveSettings(orgId, anaId, { expectedUpdatedAt: await version(), heroPhotos: ["https://elsewhere.test/x.webp"] }),
    ).rejects.toThrow("Use a photo, not a PDF.");
  });

  it("stores hero photos and collections as slots, and the library counts them as uses (ADR-0058)", async () => {
    await storefrontService.saveSettings(orgId, anaId, {
      expectedUpdatedAt: await version(),
      heroPhotos: [`${prefix}hero.webp`],
      collections: [{ categoryId, photoUrl: `${prefix}hero.webp` }],
    });
    const page = await storefrontService.storefrontPage(handle);
    expect(page?.heroPhotos).toEqual([`${prefix}hero.webp`]);
    expect(page?.collections).toHaveLength(1);
    expect(page?.collections[0].photoUrl).toBe(`${prefix}hero.webp`);
    const detail = await mediaAssetService.assetDetail(orgId, photoId);
    expect(detail.uses.map((u) => u.kind).sort()).toEqual(["storefront-collection", "storefront-hero"]);
    await expect(mediaAssetService.retire(orgId, photoId)).rejects.toThrow(
      "This image is still used by 1 storefront hero and 1 storefront collection. Remove it there first.",
    );
  });

  it("leaves a hidden section's words out of the buyer's payload, keys kept for the preview (Q9, Q43)", async () => {
    await storefrontService.saveSettings(orgId, anaId, {
      expectedUpdatedAt: await version(),
      storefrontHiddenSections: ["story", "collections"],
      openingHours: { open: "10:30", close: "21:00", closedDays: [] },
    });
    const page = await storefrontService.storefrontPage(handle);
    expect(page?.about).toBeNull();
    expect(page?.collections).toEqual([]);
    expect(page?.openingHours).toEqual({ open: "10:30", close: "21:00", closedDays: [] });
    expect(page?.themedHiddenSections).toEqual(["story", "collections"]);
  });

  it("a section's save leaves every other section's content as it was (D13: only the fields sent)", async () => {
    await storefrontService.saveSettings(orgId, anaId, { expectedUpdatedAt: await version(), heroLine: "New line" });
    const settings = await storefrontService.getSettings(orgId);
    expect(settings.heroLine).toBe("New line");
    expect(settings.claims.map((c) => c.key)).toEqual(["hallmarked", "giftWrap"]);
    expect(settings.heroPhotos).toEqual([`${prefix}hero.webp`]);
  });
});
