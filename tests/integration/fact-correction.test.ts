/**
 * Correcting a fact at a level above the product
 * ([inherited-facts](../../docs/specs/listing-vocabulary/inherited-facts/) R5, R6, D5).
 *
 * The half worth testing is not that a hundred products change — it is that the one somebody
 * deliberately edited **does not**. That distinction exists only because a stored answer carries
 * the level that supplied it, and because editing a value sets its origin to the product even
 * when the new value equals the inherited one.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isDisposableDb, ensureFixtures, setAnswers, answersOf } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("correcting a fact at a level (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let service: typeof import("@server/listing/fact-correction.service").factCorrectionService;
  const stamp = `fc-${Date.now().toString(36)}`;
  let orgId: string;
  let categoryId: string;
  let brandId: string;
  let otherBrandId: string;

  /** A product carrying a fact that says which level answered it. */
  async function product(name: string, origin: string, value = "nida-matte", brand = brandId) {
    const row = await prisma.product.create({
      data: {
        slug: `${stamp}-${name}`,
        name,
        description: "d",
        price: 100,
        thumbnail: "t",
        categoryId,
        orgId,
        brandId: brand,
      },
      select: { id: true },
    });
    await setAnswers(row.id, { facts: { material: { value, origin } } });
    return row;
  }

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ factCorrectionService: service } = await import("@server/listing/fact-correction.service"));
    const fixtures = await ensureFixtures();
    orgId = fixtures.orgId;
    categoryId = fixtures.categoryId;
    brandId = (
      await prisma.brand.create({ data: { orgId, name: `Noor ${stamp}` }, select: { id: true } })
    ).id;
    otherBrandId = (
      await prisma.brand.create({ data: { orgId, name: `Other ${stamp}` }, select: { id: true } })
    ).id;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { slug: { startsWith: stamp } } });
    await prisma.brand.deleteMany({ where: { id: { in: [brandId, otherBrandId] } } });
  });

  const target = (over = {}) => ({
    orgId,
    level: "brand" as const,
    levelId: brandId,
    fact: "material" as const,
    value: "crepe",
    ...over,
  });

  it("counts what it would change before changing it", async () => {
    await product("a", "brand");
    await product("b", "brand");
    const preview = await service.preview(target());
    expect(preview.willChange).toBe(2);
  });

  // The whole point. A product somebody edited by hand keeps its answer.
  it("leaves alone a product whose answer is its own", async () => {
    await product("own", "product", "georgette");
    const preview = await service.preview(target());
    expect(preview.leftAlone).toBeGreaterThanOrEqual(1);

    await service.apply(target());
    const own = await answersOf(
      (await prisma.product.findFirstOrThrow({ where: { slug: `${stamp}-own` }, select: { id: true } })).id,
    );
    expect((own.facts as Record<string, { value: string }>).material.value).toBe("georgette");
  });

  it("changes exactly what the preview counted", async () => {
    await prisma.product.deleteMany({ where: { slug: { startsWith: stamp } } });
    await product("c", "brand");
    await product("d", "brand");
    await product("e", "product", "georgette");

    const preview = await service.preview(target());
    const { changed } = await service.apply(target());
    expect(changed).toBe(preview.willChange);
    expect(changed).toBe(2);
  });

  it("keeps the level as the origin, so a later correction finds it again", async () => {
    await prisma.product.deleteMany({ where: { slug: { startsWith: stamp } } });
    await product("f", "brand");
    await service.apply(target());

    const after = await answersOf(
      (await prisma.product.findFirstOrThrow({ where: { slug: `${stamp}-f` }, select: { id: true } })).id,
    );
    const stored = (after.facts as Record<string, { value: string; origin: string }>).material;
    expect(stored).toEqual({ value: "crepe", origin: "brand" });

    // And a second correction still reaches it.
    expect((await service.preview(target({ value: "silk" }))).willChange).toBe(1);
  });

  it("does not reach another brand's products", async () => {
    await prisma.product.deleteMany({ where: { slug: { startsWith: stamp } } });
    await product("mine", "brand");
    await product("theirs", "brand", "nida-matte", otherBrandId);

    expect((await service.preview(target())).willChange).toBe(1);
    await service.apply(target());

    const theirs = await answersOf(
      (await prisma.product.findFirstOrThrow({ where: { slug: `${stamp}-theirs` }, select: { id: true } })).id,
    );
    expect((theirs.facts as Record<string, { value: string }>).material.value).toBe("nida-matte");
  });

  it("changes nothing when nothing took its answer from there", async () => {
    await prisma.product.deleteMany({ where: { slug: { startsWith: stamp } } });
    await product("solo", "product", "georgette");
    expect(await service.apply(target())).toEqual({ changed: 0 });
  });

  it("refuses a fact the vocabulary does not declare", async () => {
    await expect(service.preview(target({ fact: "vibes" }))).rejects.toThrow(/no fact/i);
  });
});
