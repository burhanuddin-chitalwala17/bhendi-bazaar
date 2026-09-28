/**
 * The platform's numbers against the real schema (image-enhancement spec R7, trd D5): the settings
 * are one row however often they are saved, an org with no row of its own resolves to the
 * platform's default, an override wins over it, and the owner's table counts this month only and
 * names every org in one read rather than one per row. The store is stubbed — no bucket is
 * reached — and the suite puts back whatever it found.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";
import { ENHANCEMENT_SETTINGS_ID, FALLBACK_MONTHLY_ALLOWANCE } from "@server/content/enhancement.types";

vi.mock("@server/catalog/object-store", () => ({
  headObject: vi.fn(),
  getObject: vi.fn(),
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  presignUpload: vi.fn(),
  publicUrlFor: (key: string) => `https://media.test/${key}`,
  pathnameFor: (url: string) => url.replace("https://media.test/", ""),
  isOwnObjectUrl: (url: string) => url.startsWith("https://media.test/"),
}));

describe.skipIf(!isDisposableDb)("the platform's enhancement settings (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let service: typeof import("@server/content/enhancement.service").enhancementService;
  let settings: typeof import("@server/content/enhancement-settings.repository").enhancementSettingsRepository;
  const stamp = Date.now().toString(36);
  const enhancements: string[] = [];
  const assets: string[] = [];
  let orgId: string;
  let userId: string;
  let assetId: string;
  let priorSettings: { defaultMonthlyAllowance: number; dailyCapPaise: number } | null = null;
  let hadPolicy = false;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ enhancementService: service } = await import("@server/content/enhancement.service"));
    ({ enhancementSettingsRepository: settings } = await import("@server/content/enhancement-settings.repository"));
    const { mediaAssetRepository } = await import("@server/catalog/media-asset.repository");
    ({ orgId, userId } = await ensureFixtures());

    // The settings row and the org's policy are the platform's, not this suite's: whatever they
    // hold now is put back in afterAll, so a dev database is left as it was found.
    priorSettings = await settings.read();
    hadPolicy = (await prisma.orgEnhancementPolicy.findUnique({ where: { orgId } })) !== null;

    const objectKey = `${stamp}/settings-source.webp`;
    const photo = await mediaAssetRepository.createReady({
      orgId,
      uploaderId: userId,
      ref: `https://media.test/${objectKey}`,
      objectKey,
      mimeType: "image/webp",
      bytes: 1234,
      width: 1600,
      height: 1200,
    });
    assetId = photo.id;
    assets.push(photo.id);
  });

  afterAll(async () => {
    await prisma.enhancement.deleteMany({ where: { id: { in: enhancements } } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: assets } } });
    if (!hadPolicy) await prisma.orgEnhancementPolicy.deleteMany({ where: { orgId } });
    if (priorSettings) await settings.save(priorSettings);
    else await prisma.enhancementSettings.deleteMany({ where: { id: ENHANCEMENT_SETTINGS_ID } });
  });

  /** A run recorded directly, so its month and its cost can be chosen. */
  const recordRun = async (createdAt: Date, costPaise: number) => {
    const row = await prisma.enhancement.create({
      data: {
        orgId,
        requesterId: userId,
        sourceAssetId: assetId,
        tool: "LIGHT",
        provider: "sharp",
        state: "ACCEPTED",
        costPaise,
        createdAt,
      },
      select: { id: true },
    });
    enhancements.push(row.id);
    return row.id;
  };

  it("keeps exactly one settings row however often it is saved", async () => {
    await service.saveSettings({ defaultMonthlyAllowance: 111, dailyCapPaise: 11_100 });
    await service.saveSettings({ defaultMonthlyAllowance: 222, dailyCapPaise: 22_200 });

    expect(await prisma.enhancementSettings.count()).toBe(1);
    await expect(service.settings()).resolves.toEqual({
      defaultMonthlyAllowance: 222,
      dailyCapPaise: 22_200,
      configured: true,
    });
  });

  it("resolves an org with no row of its own to the platform's default", async () => {
    await prisma.orgEnhancementPolicy.deleteMany({ where: { orgId } });
    await service.saveSettings({ defaultMonthlyAllowance: 222, dailyCapPaise: 22_200 });

    const usage = await service.usage(orgId);
    expect(usage.allowance).toBe(222);
    expect(usage.allowance).not.toBe(FALLBACK_MONTHLY_ALLOWANCE);
    expect(await prisma.orgEnhancementPolicy.count({ where: { orgId } })).toBe(0);
  });

  it("lets the org's own number win, and drops the row when it goes back to the default", async () => {
    await service.setOrgPolicy(orgId, { monthlyAllowance: 9, paused: false, pauseReason: null });
    expect((await service.usage(orgId)).allowance).toBe(9);
    expect(await prisma.orgEnhancementPolicy.count({ where: { orgId } })).toBe(1);

    await service.setOrgPolicy(orgId, { monthlyAllowance: null, paused: false, pauseReason: null });
    expect((await service.usage(orgId)).allowance).toBe(222);
    expect(await prisma.orgEnhancementPolicy.count({ where: { orgId } })).toBe(0);
  });

  it("counts this month only, and answers one row per org with its name beside it", async () => {
    const now = new Date();
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12));
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12));
    await recordRun(thisMonth, 300);
    await recordRun(thisMonth, 200);
    await recordRun(lastMonth, 900);

    const rows = await service.listOrgUsage({ month: now });
    const mine = rows.filter((row) => row.orgId === orgId);

    // Two runs, one org: a listing that grew a row per run would be a join gone wrong, and one
    // that grew a query per row is the N+1 this shape exists to rule out.
    expect(mine).toHaveLength(1);
    expect(mine[0].used).toBeGreaterThanOrEqual(2);
    expect(mine[0].spentPaise).toBeGreaterThanOrEqual(500);
    expect(mine[0].spentPaise).toBeLessThan(1400);
    expect(mine[0].name).toEqual(expect.any(String));
    expect(mine[0].code).toEqual(expect.any(String));
    expect(mine[0].monthlyAllowance).toBe(222);
    expect(mine[0].monthlyAllowanceOverride).toBeNull();
    expect(mine[0].paused).toBe(false);

    const lastMonthRows = await service.listOrgUsage({ month: lastMonth });
    expect(lastMonthRows.find((row) => row.orgId === orgId)?.used).toBe(1);
  });
});
