/**
 * subscriptions/feature-access against a real schema: an absent row is locked, the home brand holds
 * every feature with no row, and the admin's switch is stored, audited and read back (spec A1, A6; D3, D4, D12).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("feature access (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let access: typeof import("@server/subscriptions/feature-access.service").featureAccessService;
  let FEATURE: typeof import("@server/subscriptions/feature-access.types").FEATURE;
  let FeatureLockedError: typeof import("@server/shared/domain-error").FeatureLockedError;

  const stamp = `fa${Date.now().toString(36)}`;
  let lockedOrg: string;
  let homeOrg: string;
  let adminId: string;
  const homeWas = process.env.HOME_BRAND_ORG_ID;

  const makeOrg = (suffix: string) =>
    prisma.org.create({
      data: { code: `${stamp}-${suffix}`, handle: `${stamp}-${suffix}`, name: `Feature ${suffix}`, email: `${stamp}-${suffix}@example.invalid` },
      select: { id: true },
    });

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ featureAccessService: access } = await import("@server/subscriptions/feature-access.service"));
    ({ FEATURE } = await import("@server/subscriptions/feature-access.types"));
    ({ FeatureLockedError } = await import("@server/shared/domain-error"));
    ({ userId: adminId } = await ensureFixtures());
    lockedOrg = (await makeOrg("new")).id;
    homeOrg = (await makeOrg("home")).id;
    process.env.HOME_BRAND_ORG_ID = homeOrg;
  });

  afterAll(async () => {
    process.env.HOME_BRAND_ORG_ID = homeWas;
    await prisma.adminLog.deleteMany({ where: { resourceId: { in: [lockedOrg, homeOrg] } } });
    await prisma.org.deleteMany({ where: { id: { in: [lockedOrg, homeOrg] } } });
  });

  it("locks every feature of a shop no admin has switched (spec A6, Q15)", async () => {
    expect(await access.forOrg(lockedOrg)).toEqual({ channels: false, storefront: false, imageEnhancement: false });
    await expect(access.assert(lockedOrg, FEATURE.CHANNELS)).rejects.toBeInstanceOf(FeatureLockedError);
  });

  it("holds every feature for the home brand with no row at all (spec A6, Q13)", async () => {
    expect(await prisma.orgFeature.count({ where: { orgId: homeOrg } })).toBe(0);
    expect(await access.forOrg(homeOrg)).toEqual({ channels: true, storefront: true, imageEnhancement: true });
    expect((await access.allowedOrgs(FEATURE.STOREFRONT, [homeOrg, lockedOrg])).has(homeOrg)).toBe(true);
    await expect(access.set(adminId, homeOrg, FEATURE.CHANNELS, false)).rejects.toThrow(/home brand/);
  });

  it("stores the admin's switch, audits it, and reads it back on the next call (spec A1, D12, Q17)", async () => {
    const row = await access.set(adminId, lockedOrg, FEATURE.CHANNELS, true);
    expect(row).toMatchObject({ feature: FEATURE.CHANNELS, enabled: true });
    expect(await access.can(lockedOrg, FEATURE.CHANNELS)).toBe(true);
    expect(await access.can(lockedOrg, FEATURE.STOREFRONT)).toBe(false);

    await access.set(adminId, lockedOrg, FEATURE.CHANNELS, false);
    expect(await access.can(lockedOrg, FEATURE.CHANNELS)).toBe(false);

    const log = await prisma.adminLog.findMany({ where: { resourceId: lockedOrg }, select: { action: true }, orderBy: { createdAt: "asc" } });
    expect(log.map((l) => l.action)).toEqual(["feature.enabled", "feature.disabled"]);

    const plan = await access.planFor(lockedOrg);
    expect(plan.switches.find((s) => s.feature === FEATURE.CHANNELS)).toMatchObject({ enabled: false });
    expect(plan.switches.find((s) => s.feature === FEATURE.STOREFRONT)).toMatchObject({ enabled: false, changedAt: null });
  });

  it("answers a pass over many shops in one read (D8)", async () => {
    await access.set(adminId, lockedOrg, FEATURE.IMAGE_ENHANCEMENT, true);
    const allowed = await access.allowedOrgs(FEATURE.IMAGE_ENHANCEMENT, [lockedOrg]);
    expect([...allowed]).toEqual([lockedOrg]);
  });
});
