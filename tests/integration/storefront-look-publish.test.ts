/**
 * storefront-themes U5 (D11; Q4, Q31, Q42): a look is published at the version the picker saw,
 * by the owner alone, audited, and the one it replaced is kept 30 days for "Switch back".
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OrgRole } from "@prisma/client";
import { isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("storefront look publish (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let service: typeof import("@server/catalog/storefront-look.service").storefrontLookService;
  let LOOK_AUDIT: typeof import("@server/catalog/storefront-look.service").LOOK_AUDIT;
  let types: typeof import("@server/catalog/storefront-look.types");
  const stamp = Date.now().toString(36);
  const handle = `look-pub-${stamp}`;
  let orgId: string;
  let ownerId: string;
  let otherOwnerId: string;
  let staffId: string;
  const owner = () => ({ userId: ownerId, role: OrgRole.OWNER });

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ storefrontLookService: service, LOOK_AUDIT } = await import("@server/catalog/storefront-look.service"));
    types = await import("@server/catalog/storefront-look.types");
    const { orgRepository } = await import("@server/catalog/org.repository");
    const org = await orgRepository.create({
      code: `LKP-T${stamp}`.slice(0, 20),
      handle,
      name: `Look Pub ${stamp}`,
      email: `lookpub-${stamp}@example.invalid`,
      isActive: true,
    });
    orgId = org.id;
    const user = (name: string) => prisma.user.create({ data: { email: `${name}-${stamp}@example.invalid`, name } });
    ownerId = (await user("Zainab")).id;
    otherOwnerId = (await user("Murtaza")).id;
    staffId = (await user("Staff")).id;
  });

  afterAll(async () => {
    const users = [ownerId, otherOwnerId, staffId].filter(Boolean);
    await prisma.adminLog.deleteMany({ where: { adminId: { in: users } } });
    if (orgId) await prisma.org.delete({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  it("an unthemed shop reads at version 0 with nothing to switch back to (Q19)", async () => {
    const look = await service.getLook(orgId);
    expect(look).toMatchObject({ handle, live: { theme: null, palette: null }, lookVersion: 0, previous: null });
  });

  it("STAFF is refused with ux.md's words and nothing is written (Q31)", async () => {
    await expect(
      service.publish(orgId, { userId: staffId, role: OrgRole.STAFF }, { theme: "darbar", palette: "navy", lookVersion: 0 }),
    ).rejects.toMatchObject({ status: 403, message: types.LOOK_OWNER_ONLY });
    expect((await service.getLook(orgId)).lookVersion).toBe(0);
  });

  it("publish makes the look live, bumps the version, keeps the old page 30 days, and is audited (D11, Q4)", async () => {
    const look = await service.publish(orgId, owner(), { theme: "darbar", palette: "navy", lookVersion: 0 });
    expect(look.live).toEqual({ theme: "darbar", palette: "navy" });
    expect(look.lookVersion).toBe(1);
    expect(look.previous).toMatchObject({ theme: null, palette: null });
    const days = (new Date(look.previous!.until).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
    const { storefrontService } = await import("@server/catalog/storefront.service");
    expect(await storefrontService.storefrontPage(handle)).toMatchObject({ themeKey: "darbar", paletteKey: "navy" });
    const audit = await prisma.adminLog.findFirst({ where: { adminId: ownerId, action: LOOK_AUDIT.PUBLISHED, resourceId: orgId } });
    expect(audit).not.toBeNull();
  });

  it("a stale version is 409 naming who published what, and writes nothing (Q31)", async () => {
    await prisma.orgMember.create({ data: { orgId, userId: otherOwnerId, role: OrgRole.OWNER } });
    await service.publish(orgId, { userId: otherOwnerId, role: OrgRole.OWNER }, { theme: "edge", palette: "carbon", lookVersion: 1 });
    await expect(
      service.publish(orgId, owner(), { theme: "bloom", palette: "peach", lookVersion: 1 }),
    ).rejects.toMatchObject({ status: 409, message: "Murtaza published Edge 1 min ago." });
    const look = await service.getLook(orgId);
    expect(look).toMatchObject({ live: { theme: "edge", palette: "carbon" }, lookVersion: 2 });
    expect(look.previous).toMatchObject({ theme: "darbar", palette: "navy" });
  });

  it("'Publish mine anyway' resends at the new version and wins", async () => {
    const look = await service.publish(orgId, owner(), { theme: "bloom", palette: "peach", lookVersion: 2 });
    expect(look).toMatchObject({ live: { theme: "bloom", palette: "peach" }, lookVersion: 3, previous: { theme: "edge" } });
  });

  it("switch back restores the kept look and keeps the one it left (Q4)", async () => {
    const look = await service.revert(orgId, owner(), { lookVersion: 3 });
    expect(look).toMatchObject({
      live: { theme: "edge", palette: "carbon" },
      lookVersion: 4,
      previous: { theme: "bloom", palette: "peach" },
    });
    expect(await prisma.adminLog.count({ where: { adminId: ownerId, action: LOOK_AUDIT.REVERTED } })).toBe(1);
  });

  it("switch back after the 30 days is refused and changes nothing (Q4)", async () => {
    await prisma.orgProfile.update({ where: { orgId }, data: { previousLookUntil: new Date(Date.now() - 1000) } });
    expect((await service.getLook(orgId)).previous).toBeNull();
    await expect(service.revert(orgId, owner(), { lookVersion: 4 })).rejects.toMatchObject({
      status: 410,
      message: types.LOOK_NOT_KEPT,
    });
    expect((await service.getLook(orgId)).live).toEqual({ theme: "edge", palette: "carbon" });
  });

  it("STAFF cannot switch back either (Q31)", async () => {
    await expect(service.revert(orgId, { userId: staffId, role: OrgRole.STAFF }, { lookVersion: 4 })).rejects.toMatchObject({
      status: 403,
    });
  });
});
