/**
 * The look columns a shop starts with (storefront-themes U2; D1, D11; Q19, Q31; ADR-0020).
 * Every existing shop must read as unthemed at version 0, or Publish's compare-and-set has no
 * floor; and the member a publish is attributed to cannot be deleted out from under it.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("storefront look columns (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orgRepository: typeof import("@server/catalog/org.repository").orgRepository;
  const stamp = Date.now().toString(36);
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orgRepository } = await import("@server/catalog/org.repository"));
    const org = await orgRepository.create({
      code: `LOOK-T${stamp}`.slice(0, 20),
      handle: `look-test-${stamp}`,
      name: `Look Test ${stamp}`,
      email: `look-${stamp}@example.invalid`,
      isActive: true,
    });
    orgId = org.id;
    userId = (await prisma.user.create({ data: { email: `look-owner-${stamp}@example.invalid` } })).id;
  });

  afterAll(async () => {
    if (orgId) await prisma.org.delete({ where: { id: orgId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
  });

  it("a shop starts unthemed, at look version 0, with nothing to switch back to (Q19)", async () => {
    const profile = await prisma.orgProfile.findUnique({ where: { orgId } });
    expect(profile).toMatchObject({
      themeKey: null,
      paletteKey: null,
      lookVersion: 0,
      lookPublishedAt: null,
      lookPublishedByUserId: null,
      previousThemeKey: null,
      previousPaletteKey: null,
      previousLookUntil: null,
    });
  });

  it("refuses to delete the member a published look is attributed to (ADR-0020)", async () => {
    await prisma.orgProfile.update({
      where: { orgId },
      data: { themeKey: "darbar", paletteKey: "emerald", lookVersion: 1, lookPublishedByUserId: userId },
    });
    await expect(prisma.user.delete({ where: { id: userId } })).rejects.toThrow(/foreign key/i);
    await prisma.orgProfile.update({ where: { orgId }, data: { lookPublishedByUserId: null } });
  });
});
