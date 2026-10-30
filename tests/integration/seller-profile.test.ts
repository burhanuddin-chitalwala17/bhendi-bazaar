/**
 * An organisation is born with its profile and its defaults (seller-profile trd D4), its
 * storefront settings live on the profile, and a brand is retired rather than deleted (R9).
 * Owns its fixtures: a migrated schema is all it needs.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("seller profile (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orgRepository: typeof import("@server/catalog/org.repository").orgRepository;
  let orgProfileRepository: typeof import("@server/catalog/org-profile.repository").orgProfileRepository;
  let brandRepository: typeof import("@server/catalog/brand.repository").brandRepository;
  let storefrontService: typeof import("@server/catalog/storefront.service").storefrontService;
  const stamp = Date.now().toString(36);
  let orgId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orgRepository } = await import("@server/catalog/org.repository"));
    ({ orgProfileRepository } = await import("@server/catalog/org-profile.repository"));
    ({ brandRepository } = await import("@server/catalog/brand.repository"));
    ({ storefrontService } = await import("@server/catalog/storefront.service"));
    const org = await orgRepository.create({
      code: `SEL-T${stamp}`.slice(0, 20),
      handle: `profile-test-${stamp}`,
      name: `Profile Test ${stamp}`,
      email: `profile-${stamp}@example.invalid`,
      isActive: true,
      description: "Typed at creation",
    });
    orgId = org.id;
  });

  afterAll(async () => {
    // Brands, profile and defaults cascade with the org; this is the one place an org row goes.
    await prisma.org.delete({ where: { id: orgId } });
  });

  it("creates the profile and the defaults with the org, and the introduction lands on the profile", async () => {
    const [profile, defaults] = await Promise.all([
      prisma.orgProfile.findUnique({ where: { orgId } }),
      prisma.orgListingDefaults.findUnique({ where: { orgId } }),
    ]);
    expect(profile?.description).toBe("Typed at creation");
    expect(defaults).not.toBeNull();
  });

  it("round-trips storefront looks through the profile, leaving the facts alone (org-profile Q17)", async () => {
    const saved = await storefrontService.saveSettings(orgId, { accent: "primary", heroUrl: "" });
    expect(saved.accent).toBe("primary");
    expect(saved.heroUrl).toBeNull();
    expect(saved.description).toBe("Typed at creation");
    const publicRead = await orgProfileRepository.findPublicByHandle(`profile-test-${stamp}`);
    expect(publicRead?.accent).toBe("primary");
    expect(publicRead?.org.name).toBe(`Profile Test ${stamp}`);
    expect(publicRead && "email" in publicRead.org).toBe(false);
  });

  it("retires a brand instead of deleting it, and keeps it readable by id", async () => {
    const brand = await brandRepository.create(orgId, {
      name: "Zari",
      manufacturer: null,
      packerOrImporter: null,
      countryOfOrigin: "IN",
      isDefault: true,
    });
    expect((await brandRepository.listForOrg(orgId)).map((b) => b.name)).toEqual(["Zari"]);
    expect(await brandRepository.retire(orgId, brand.id)).toBe(true);
    expect(await brandRepository.listForOrg(orgId)).toEqual([]);
    expect((await brandRepository.findById(orgId, brand.id))?.retiredAt).not.toBeNull();
    // Another org cannot reach it by id.
    expect(await brandRepository.retire("someone-else", brand.id)).toBe(false);
  });

  it("refuses a second brand of the same name in one org", async () => {
    await brandRepository.create(orgId, { name: "Dup", manufacturer: null, packerOrImporter: null, countryOfOrigin: null, isDefault: false });
    await expect(
      brandRepository.create(orgId, { name: "Dup", manufacturer: null, packerOrImporter: null, countryOfOrigin: null, isDefault: false }),
    ).rejects.toThrow(/Unique constraint/);
  });
});
