/**
 * listing-model/attributes unit 1 against a real schema: today's answers arrive as typed value rows and a
 * read copy, in step on every write (Q7); the brand and the shop fill what they own (A1, A2); nothing is
 * lost in the move (A3); every stored kind is one code handles (D1).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ATTRIBUTE_KINDS } from "@server/listing/attribute.types";
import { ensureFixtures, isDisposableDb, setAnswers } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("product values (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let values: typeof import("@server/listing/product-value.repository").productValueRepository;
  const stamp = `pv${Date.now().toString(36)}`;
  let orgId: string;
  let categoryId: string;
  let brandId: string;
  let productId: string;
  let brandless: string;
  let defaultBrandId: string;
  let defaultsWas: { countryOfOrigin: string | null } | null;

  const rows = async (id: string) =>
    Object.fromEntries((await prisma.productValue.findMany({ where: { productId: id }, orderBy: { measured: "asc" } })).map((r) => [r.attributeKey, r]));

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ productValueRepository: values } = await import("@server/listing/product-value.repository"));
    ({ orgId, categoryId } = await ensureFixtures());
    await prisma.productType.create({ data: { key: `${stamp}-bag`, label: "Bag", facts: ["colour", "compartments", "waterResistant"], measures: [{ key: "length", label: "Length", unit: "cm", required: true }, { key: "width", label: "Width", unit: "in", required: false }], variantAxis: [], kinds: [], factLabels: {}, labelFrom: [] } });
    brandId = (await prisma.brand.create({ data: { orgId, name: `Noor ${stamp}`, manufacturer: "Noor Works, Mumbai", packerOrImporter: "Noor Packing, Mumbai", countryOfOrigin: "IN" } })).id;
    const base = { orgId, categoryId, price: 99_900, description: "x", thumbnail: "/x.jpg", productType: `${stamp}-bag` };
    productId = (await prisma.product.create({ data: { ...base, name: "Tote", slug: `${stamp}-a`, brandId, weight: 0.45 } })).id;
    await setAnswers(productId, { weight: 0.45,
      facts: { colour: { value: "olive", origin: "product" }, compartments: { value: 3, origin: "product" }, waterResistant: { value: true, origin: "brand" } },
      measurements: { length: { value: 40, origin: "product" }, width: { value: 2, origin: "product" } } });
    brandless = (await prisma.product.create({ data: { ...base, name: "Pouch", slug: `${stamp}-b`, weight: null } })).id;
    await setAnswers(brandless, {});
    // Made default after the brandless product exists: the brand's own insert must re-derive it (A2).
    defaultsWas = await prisma.orgListingDefaults.findUnique({ where: { orgId }, select: { countryOfOrigin: true } });
    // Through the brand repository, which refreshes the products a brand fills (dynamic-form Q16).
    const { brandRepository } = await import("@server/catalog/brand.repository");
    const house = await brandRepository.create(orgId, { name: `House ${stamp}`, manufacturer: "House Works, Surat", packerOrImporter: null, countryOfOrigin: null, isDefault: false });
    defaultBrandId = house.id;
    await brandRepository.markDefault(orgId, defaultBrandId);
  });

  afterAll(async () => {
    // By stamp, so a failed test cannot leave a fixture behind for the next file to trip on.
    await prisma.product.deleteMany({ where: { OR: [{ id: { in: [productId, brandless].filter(Boolean) } }, { slug: { startsWith: stamp } }] } });
    await prisma.category.deleteMany({ where: { slug: { startsWith: stamp } } });
    await prisma.brand.deleteMany({ where: { id: { in: [brandId, defaultBrandId].filter(Boolean) } } });
    if (defaultsWas) await prisma.orgListingDefaults.update({ where: { orgId }, data: defaultsWas });
    else await prisma.orgListingDefaults.deleteMany({ where: { orgId } });
    await prisma.listingValue.deleteMany({ where: { key: `${stamp}-teal` } });
    await prisma.productType.deleteMany({ where: { key: { startsWith: stamp } } });
  });

  it("stores every answer once, typed, with where it came from, and the measure canonical (A3, R2, R8)", async () => {
    const r = await rows(productId);
    expect(r.colour).toMatchObject({ optionKey: "olive", source: "product" });
    expect(Number(r.compartments.number)).toBe(3);
    expect(r.waterResistant).toMatchObject({ bool: true, source: "brand" });
    expect(Number(r.length.number)).toBe(400);
    expect(r.length.unit).toBe("cm");
    expect(Number(r.weight.number)).toBe(450);
    const [copy] = [...(await values.projections([productId])).values()];
    expect(copy.colour).toEqual({ v: "olive", src: "product" });
    expect(copy.length).toEqual({ v: 400, unit: "cm", src: "product" });
  });

  it("fills country, maker and packer from the brand, and follows a change to the brand (A1)", async () => {
    expect((await rows(productId)).manufacturer).toMatchObject({ text: "Noor Works, Mumbai", source: "brand", sourceId: brandId });
    const { brandRepository } = await import("@server/catalog/brand.repository");
    await brandRepository.update(orgId, brandId, { manufacturer: "Noor Atelier, Pune" });
    expect((await rows(productId)).manufacturer.text).toBe("Noor Atelier, Pune");
    expect((await rows(productId)).countryOfOrigin).toMatchObject({ text: "IN", source: "brand" });
  });

  it("a product with no brand takes the shop's default brand's values, and the shop's country when the brand has none (A2, Q6)", async () => {
    expect((await rows(brandless)).brand).toMatchObject({ refId: defaultBrandId, source: "shop" });
    expect((await rows(brandless)).manufacturer.text).toBe("House Works, Surat");
    const { orgListingDefaultsRepository } = await import("@server/listing/org-listing-defaults.repository");
    await orgListingDefaultsRepository.upsert(orgId, { countryOfOrigin: "AE", taxRateBps: null, taxCodeByCategory: null });
    expect((await rows(brandless)).countryOfOrigin).toMatchObject({ text: "AE", source: "shop" });
  });

  it("converts inches to millimetres, keeping the shop's unit (R8)", async () => {
    const r = await rows(productId);
    expect(Number(r.width.number)).toBe(50.8);
    expect(r.width.unit).toBe("in");
  });

  it("keeps the rows in step when an answer changes, and keeps an answer that does not fit its kind as text (Q7, R7)", async () => {
    await setAnswers(productId, { weight: 0.45, facts: { colour: { value: "black", origin: "product" }, compartments: { value: "many", origin: "product" } } });
    const r = await rows(productId);
    expect(r.colour.optionKey).toBe("black");
    expect(r.compartments).toMatchObject({ text: "many", number: null });
    expect(r.waterResistant).toBeUndefined();
    const copy = (await values.projections([productId])).get(productId)!;
    expect(copy.colour).toEqual({ v: "black", src: "product" });
    expect(copy.compartments).toEqual({ v: "many", src: "product" });
  });

  it("a list value added later becomes an option, and a type's new question its own row (Q12)", async () => {
    await prisma.listingValue.create({ data: { list: "colour", key: `${stamp}-teal`, label: "Teal" } });
    expect(await prisma.attributeOption.count({ where: { attributeKey: "colour", key: `${stamp}-teal` } })).toBe(1);
    await prisma.productType.update({ where: { key: `${stamp}-bag` }, data: { facts: ["colour", "compartments", "waterResistant", "pattern"] } });
    expect(await prisma.bbTypeAttribute.count({ where: { productTypeKey: `${stamp}-bag`, attributeKey: "pattern" } })).toBe(1);
  });

  it("keeps a decimal answer a number, and a decimal measure canonical (review B2)", async () => {
    await setAnswers(productId, { facts: { compartments: { value: "2.5", origin: "product" } }, measurements: { length: { value: 40.5, origin: "product" } } });
    const r = await rows(productId);
    expect(r.compartments).toMatchObject({ text: null });
    expect(Number(r.compartments.number)).toBe(2.5);
    expect(Number(r.length.number)).toBe(405);
  });

  it("a product that inherits its country can save its own, which the brand then never overwrites (review B1, A4)", async () => {
    expect((await rows(productId)).countryOfOrigin.source).toBe("brand");
    await setAnswers(productId, { facts: { countryOfOrigin: { value: "BD", origin: "product" } } });
    expect((await rows(productId)).countryOfOrigin).toMatchObject({ text: "BD", source: "product" });
    const { brandRepository } = await import("@server/catalog/brand.repository");
    await brandRepository.update(orgId, brandId, { countryOfOrigin: "LK" });
    expect((await rows(productId)).countryOfOrigin).toMatchObject({ text: "BD", source: "product" });
  });

  it("a type's measure changing unit re-derives its products' canonical numbers (review S1)", async () => {
    await setAnswers(productId, { measurements: { length: { value: 40.5, origin: "product" } } });
    const { productTypeRepository } = await import("@server/listing/product-type.repository");
    await productTypeRepository.update(`${stamp}-bag`, { measures: [{ key: "length", label: "Length", unit: "in", required: true }] } as never);
    const r = await rows(productId);
    expect(Number(r.length.number)).toBe(1028.7);
    expect(r.length.unit).toBe("in");
    expect(r.length.answer).toEqual({ value: 40.5, origin: "product" });
  });

  it("a product re-typed by its category, or by a marketplace's category, re-derives its rows (review S1)", async () => {
    await prisma.productType.create({ data: { key: `${stamp}-mm`, label: "Small", facts: [], measures: [{ key: "length", label: "Length", unit: "mm", required: true }], variantAxis: [], kinds: [], factLabels: {}, labelFrom: [] } });
    const cat = await prisma.category.create({ data: { slug: `${stamp}-c`, name: `C ${stamp}`, description: "x", heroImage: "/x.jpg", productType: `${stamp}-bag` } });
    {
      const own = (await prisma.product.create({ data: { orgId, categoryId: cat.id, price: 1, description: "x", thumbnail: "/x.jpg", name: "Clutch", slug: `${stamp}-c1` } })).id;
      await setAnswers(own, { measurements: { length: { value: 20, origin: "product" } } });
      const { adminCategoryRepository } = await import("@server/catalog/category.repository");
      await adminCategoryRepository.updateCategory(cat.id, { name: cat.name, description: "x", heroImage: "/x.jpg", productType: `${stamp}-mm` } as never);
      expect(Number((await rows(own)).length.number)).toBe(20);
      const { adminProductsRepository } = await import("@server/catalog/product.repository");
      await adminProductsRepository.setCategoryFromMarketplace(orgId, own, categoryId, `${stamp}-bag`);
      expect((await rows(own)).length.unit).not.toBe("mm");
    }
  });

  it("a default brand that stops being the default stops filling the shop's brandless products (review S2)", async () => {
    expect((await rows(brandless)).brand).toMatchObject({ refId: defaultBrandId });
    const { brandRepository } = await import("@server/catalog/brand.repository");
    await brandRepository.update(orgId, defaultBrandId, { isDefault: false });
    expect((await rows(brandless)).brand).toBeUndefined();
    expect((await rows(brandless)).manufacturer).toBeUndefined();
  });

  it("holds only kinds the code handles (D1)", async () => {
    const kinds = await values.kinds();
    expect(kinds.length).toBeGreaterThan(3);
    expect(kinds.filter((k) => !(ATTRIBUTE_KINDS as readonly string[]).includes(k))).toEqual([]);
  });
});
