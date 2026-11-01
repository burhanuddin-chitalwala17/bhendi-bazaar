/**
 * A pickup address's name is refused when the shop already has it (seller-onboarding U5; R8, A4;
 * D11; Q29). Case-insensitive and in the service, so "main shop" collides with "Main Shop" while
 * another shop's "Main Shop" does not. Owns its world: two fresh orgs.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isDisposableDb } from "../helpers/test-db";
import { ConflictError } from "@server/shared/domain-error";

describe.skipIf(!isDisposableDb)("pickup address names (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orgAddressService: typeof import("@server/catalog/org.address.service").orgAddressService;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const orgIds: string[] = [];

  const location = {
    name: "Main Shop",
    contactName: "Hussain",
    contactPhone: "9000000052",
    addressLine1: "2 Pickup Lane",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400003",
  };

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orgAddressService } = await import("@server/catalog/org.address.service"));
    const { orgRepository } = await import("@server/catalog/org.repository");
    for (const suffix of ["a", "b"]) {
      const org = await orgRepository.create({
        code: `PICK${suffix.toUpperCase()}${stamp}`.slice(0, 20),
        handle: `pickup-${suffix}-${stamp}`,
        name: `Pickup ${suffix} ${stamp}`,
        email: `pickup-${suffix}-${stamp}@example.invalid`,
        isActive: true,
      });
      orgIds.push(org.id);
    }
  });

  afterAll(async () => {
    const links = await prisma.orgAddress.findMany({ where: { orgId: { in: orgIds } }, select: { addressId: true } });
    await prisma.orgAddress.deleteMany({ where: { orgId: { in: orgIds } } });
    await prisma.address.deleteMany({ where: { id: { in: links.map((link) => link.addressId) } } });
    await prisma.org.deleteMany({ where: { id: { in: orgIds } } });
  });

  it("refuses a second 'main shop' with ux copy on the name field, and writes nothing (Q29)", async () => {
    const [orgId] = orgIds;
    await orgAddressService.addLocation(orgId, location);
    const refused = orgAddressService.addLocation(orgId, { ...location, name: "  main shop " });
    await expect(refused).rejects.toBeInstanceOf(ConflictError);
    await expect(refused).rejects.toMatchObject({
      message: "You already have 'Main Shop'. Use another name.",
      field: "name",
    });
    expect(await prisma.orgAddress.count({ where: { orgId } })).toBe(1);
  });

  it("lets another shop use the same name (Q29)", async () => {
    const [, otherOrgId] = orgIds;
    await expect(orgAddressService.addLocation(otherOrgId, location)).resolves.toMatchObject({ name: "Main Shop" });
  });

  it("refuses renaming one address onto another's name, but not onto its own (Q29)", async () => {
    const [orgId] = orgIds;
    const godown = await orgAddressService.addLocation(orgId, { ...location, name: "Godown" });
    await expect(orgAddressService.updateLocation(orgId, godown.id, { name: "MAIN SHOP" })).rejects.toBeInstanceOf(ConflictError);
    await expect(orgAddressService.updateLocation(orgId, godown.id, { name: "godown" })).resolves.toMatchObject({ name: "godown" });
  });
});
