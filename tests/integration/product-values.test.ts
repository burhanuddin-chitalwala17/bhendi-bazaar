/**
 * listing-model/attributes unit 1 against a real schema: today's answers arrive as typed value rows and a
 * read copy, in step on every write (Q7); the brand and the shop fill what they own (A1, A2); nothing is
 * lost in the move (A3); every stored kind is one code handles (D1).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ATTRIBUTE_KINDS } from "@server/listing/attribute.types";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

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
    Object.fromEntries((await prisma.productValue.findMany({ where: { productId: id } })).map((r) => [r.attributeKey, r]));

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ productValueRepository: values } = await import("@server/listing/product-value.repository"));
    ({ orgId, categoryId } = await ensureFixtures());
    await prisma.productType.create({ data: { key: `${stamp}-bag`, label: "Bag", facts: ["colour", "compartments", "waterResistant"], measures: [{ key: "length", label: "Length", unit: "cm", required: true }, { key: "width", label: "Width", unit: "in", required: false }], variantAxis: [], kinds: [], factLabels: {}, labelFrom: [] } });
    brandId = (await prisma.brand.create({ data: { orgId, name: `Noor ${stamp}`, manufacturer: "Noor Works, Mumbai", packerOrImporter: "Noor Packing, Mumbai", countryOfOrigin: "IN" } })).id;
    const base = { orgId, categoryId, price: 99_900, description: "x", thumbnail: "/x.jpg", productType: `${stamp}-bag` };
    productId = (await prisma.product.create({ data: { ...base, name: "Tote", slug: `${stamp}-a`, brandId, weight: 0.45,
      facts: { colour: { value: "olive", origin: "product" }, compartments: { value: 3, origin: "product" }, waterResistant: { value: true, origin: "brand" } },
      measurements: { length: { value: 40, origin: "product" }, width: { value: 2, origin: "product" } } } })).id;
    brandless = (await prisma.product.create({ data: { ...base, name: "Pouch", slug: `${stamp}-b`, weight: null, facts: {} } })).id;
    // Made default after the brandless product exists: the brand's own insert must re-derive it (A2).
    defaultsWas = await prisma.orgListingDefaults.findUnique({ where: { orgId }, select: { countryOfOrigin: true } });
    await prisma.brand.updateMany({ where: { orgId, isDefault: true }, data: { isDefault: false } });
    defaultBrandId = (await prisma.brand.create({ data: { orgId, name: `House ${stamp}`, manufacturer: "House Works, Surat", isDefault: true } })).id;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: [productId, brandless].filter(Boolean) } } });
    await prisma.brand.deleteMany({ where: { id: { in: [brandId, defaultBrandId].filter(Boolean) } } });
    if (defaultsWas) await prisma.orgListingDefaults.update({ where: { orgId }, data: defaultsWas });
    else await prisma.orgListingDefaults.deleteMany({ where: { orgId } });
    await prisma.listingValue.deleteMany({ where: { key: `${stamp}-teal` } });
    await prisma.productType.deleteMany({ where: { key: `${stamp}-bag` } });
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
    await prisma.brand.update({ where: { id: brandId }, data: { manufacturer: "Noor Atelier, Pune" } });
    expect((await rows(productId)).manufacturer.text).toBe("Noor Atelier, Pune");
    expect((await rows(productId)).countryOfOrigin).toMatchObject({ text: "IN", source: "brand" });
  });

  it("a product with no brand takes the shop's default brand's values, and the shop's country when the brand has none (A2, Q6)", async () => {
    expect((await rows(brandless)).brand).toMatchObject({ refId: defaultBrandId, source: "shop" });
    expect((await rows(brandless)).manufacturer.text).toBe("House Works, Surat");
    await prisma.orgListingDefaults.upsert({ where: { orgId }, create: { orgId, countryOfOrigin: "AE" }, update: { countryOfOrigin: "AE" } });
    expect((await rows(brandless)).countryOfOrigin).toMatchObject({ text: "AE", source: "shop" });
  });

  it("converts inches to millimetres, keeping the shop's unit (R8)", async () => {
    const r = await rows(productId);
    expect(Number(r.width.number)).toBe(50.8);
    expect(r.width.unit).toBe("in");
  });

  it("keeps the rows in step when an answer changes, and keeps an answer that does not fit its kind as text (Q7, R7)", async () => {
    await prisma.product.update({ where: { id: productId }, data: { facts: { colour: { value: "black", origin: "product" }, compartments: { value: "many", origin: "product" } } } });
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

  it("holds only kinds the code handles (D1)", async () => {
    const kinds = await values.kinds();
    expect(kinds.length).toBeGreaterThan(3);
    expect(kinds.filter((k) => !(ATTRIBUTE_KINDS as readonly string[]).includes(k))).toEqual([]);
  });
});
