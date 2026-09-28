/**
 * Brands against a real schema (docs/specs/seller-profile/ R3, R9, R10; trd D2, D6): unique per
 * org and not across orgs, every write scoped so another org's id reads as not-found, retirement
 * hides from the list and keeps the row readable, and one default per org. Owns its fixtures.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("brands (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let service: typeof import("@server/catalog/brand.service").brandService;
  let repo: typeof import("@server/catalog/brand.repository").brandRepository;
  const stamp = `bt-${Date.now().toString(36)}`;
  const blank = { manufacturer: null, packerOrImporter: null, countryOfOrigin: null, isDefault: false };
  let orgA: string;
  let orgB: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ brandService: service } = await import("@server/catalog/brand.service"));
    ({ brandRepository: repo } = await import("@server/catalog/brand.repository"));
    orgA = (await ensureFixtures()).orgId;
    orgB = (
      await prisma.org.create({
        data: { code: `SEL-${stamp}`, handle: stamp, name: "Brand Test Org", email: `${stamp}@example.invalid` },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.brand.deleteMany({ where: { name: { startsWith: stamp } } });
    await prisma.org.deleteMany({ where: { id: orgB } });
  });

  it("a name is unique within an org and free across orgs", async () => {
    const name = `${stamp} Zed`;
    await service.create(orgA, { ...blank, name });
    await expect(service.create(orgA, { ...blank, name })).rejects.toMatchObject({ name: "ConflictError" });
    await expect(service.create(orgB, { ...blank, name })).resolves.toMatchObject({ name });
  });

  it("another org's brand id reads as not found on update and retire", async () => {
    const mine = await service.create(orgA, { ...blank, name: `${stamp} Mine` });
    await expect(service.update(orgB, mine.id, { name: `${stamp} Stolen` })).rejects.toMatchObject({ name: "NotFoundError" });
    await expect(service.retire(orgB, mine.id)).rejects.toMatchObject({ name: "NotFoundError" });
    expect((await service.list(orgA)).map((b) => b.name)).toContain(`${stamp} Mine`);
  });

  it("retiring hides a brand from the list and keeps it readable by id (ADR-0032)", async () => {
    const brand = await service.create(orgB, { ...blank, name: `${stamp} Old` });
    const retired = await service.retire(orgB, brand.id);
    expect(retired.retiredAt).not.toBeNull();
    expect((await service.list(orgB)).map((b) => b.id)).not.toContain(brand.id);
    expect(await repo.findById(orgB, brand.id)).toMatchObject({ id: brand.id, retiredAt: expect.any(Date) });
    await expect(service.update(orgB, brand.id, { name: `${stamp} Renamed` })).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("marking a default clears the previous one", async () => {
    const first = await service.create(orgB, { ...blank, name: `${stamp} First`, isDefault: true });
    const second = await service.create(orgB, { ...blank, name: `${stamp} Second`, isDefault: true });
    const defaults = (await service.list(orgB)).filter((b) => b.isDefault).map((b) => b.id);
    expect(defaults).toEqual([second.id]);
    expect(defaults).not.toContain(first.id);
  });
});
