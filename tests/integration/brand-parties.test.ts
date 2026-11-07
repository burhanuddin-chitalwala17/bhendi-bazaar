/**
 * listing-model/attributes unit 2 against a real schema: a brand's parties fill manufacturer, packer and
 * importer (D6, Q11); the shop's Generic switch sets its brands (Q16); a Tote asks the new questions and keeps
 * its old strap answer (A4); a product's type follows its category, answers kept (A5, D7).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("brand parties and type follows category (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  const stamp = `bp${Date.now().toString(36)}`;
  let orgId: string;
  let brandId: string;
  let productId: string;
  let categoryId: string;
  let genericWas: boolean | null;

  const value = async (key: string) => prisma.productValue.findUnique({ where: { productId_attributeKey: { productId, attributeKey: key } } });

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orgId } = await ensureFixtures());
    for (const k of ["a", "b"]) await prisma.productType.create({ data: { key: `${stamp}-${k}`, label: `T${k}`, facts: ["colour", "strap"], measures: [], variantAxis: [], kinds: [{ key: "x", label: "X" }], factLabels: {}, labelFrom: [] } });
    categoryId = (await prisma.category.create({ data: { name: `Cat ${stamp}`, slug: `cat-${stamp}`, description: "x", heroImage: "/x.jpg", productType: `${stamp}-a` } })).id;
    brandId = (await prisma.brand.create({ data: { orgId, name: `Party ${stamp}` } })).id;
    productId = (await prisma.product.create({ data: { orgId, categoryId, brandId, name: "Tote", slug: `${stamp}-p`, price: 1000, description: "x", thumbnail: "/x.jpg", productType: `${stamp}-b`,
      facts: { strap: { value: "detachable", origin: "product" } } } })).id;
    genericWas = (await prisma.orgListingDefaults.findUnique({ where: { orgId }, select: { amazonGeneric: true } }))?.amazonGeneric ?? null;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.brand.deleteMany({ where: { id: brandId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.productType.deleteMany({ where: { key: { in: [`${stamp}-a`, `${stamp}-b`] } } });
    if (genericWas !== null) await prisma.orgListingDefaults.updateMany({ where: { orgId }, data: { amazonGeneric: genericWas } });
    else await prisma.orgListingDefaults.deleteMany({ where: { orgId } });
  });

  it("a product saved into a category takes the category's type (D7)", async () => {
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).productType).toBe(`${stamp}-a`);
  });

  it("the brand's parties fill manufacturer, packer and importer as one line each (D6, Q11)", async () => {
    await prisma.brandParty.create({ data: { brandId, role: "maker", name: "Noor Works", address: "12 Bhendi Bazaar, Mumbai", pincode: "400003" } });
    await prisma.brandParty.create({ data: { brandId, role: "importer", name: "Gulf Imports", pincode: "400001" } });
    expect((await value("manufacturer"))?.text).toBe("Noor Works, 12 Bhendi Bazaar, Mumbai, 400003");
    expect((await value("importer"))?.text).toBe("Gulf Imports, 400001");
    expect(await value("packer")).toBeNull();
  });

  it("an edit on today's brand page still reaches products while the brand has no parties (A1)", async () => {
    const other = await prisma.brand.create({ data: { orgId, name: `Lines ${stamp}`, manufacturer: "Old Maker" } });
    await prisma.product.update({ where: { id: productId }, data: { brandId: other.id } });
    await prisma.brand.update({ where: { id: other.id }, data: { manufacturer: "New Maker" } });
    expect((await value("manufacturer"))?.text).toBe("New Maker");
    await prisma.product.update({ where: { id: productId }, data: { brandId } });
    await prisma.brand.delete({ where: { id: other.id } });
  });

  it("a new brand lists as the shop does until the brand page asks (Q16)", async () => {
    const { brandService } = await import("@server/catalog/brand.service");
    await prisma.orgListingDefaults.upsert({ where: { orgId }, create: { orgId, amazonGeneric: true }, update: { amazonGeneric: true } });
    const made = await brandService.create(orgId, { name: `New ${stamp}`, manufacturer: null, packerOrImporter: null, countryOfOrigin: null, isDefault: false });
    expect((await prisma.brand.findUniqueOrThrow({ where: { id: made.id } })).amazonRegistered).toBe(false);
    await prisma.brand.delete({ where: { id: made.id } });
  });

  it("the shop's Generic switch sets its brands until the brand page asks (Q16)", async () => {
    await prisma.orgListingDefaults.upsert({ where: { orgId }, create: { orgId, amazonGeneric: true }, update: { amazonGeneric: true } });
    expect((await prisma.brand.findUniqueOrThrow({ where: { id: brandId } })).amazonRegistered).toBe(false);
    await prisma.orgListingDefaults.update({ where: { orgId }, data: { amazonGeneric: false } });
    expect((await prisma.brand.findUniqueOrThrow({ where: { id: brandId } })).amazonRegistered).toBe(true);
  });

  it("asks a bag the new questions and keeps today's strap answer under its own name (A4)", async () => {
    const asked = (await prisma.bbTypeAttribute.findMany({ where: { productTypeKey: "bag" }, select: { attributeKey: true } })).map((r) => r.attributeKey);
    expect(asked).toEqual(expect.arrayContaining(["style", "innerMaterial", "pocketCount", "capacity", "strapType", "strap", "genericName", "packQuantity"]));
    expect((await value("strap"))?.optionKey).toBe("detachable");
    expect(await value("strapType")).toBeNull();
  });

  it("a product in a subcategory with no type of its own reads its parent's (D7)", async () => {
    const child = await prisma.category.create({ data: { name: `Sub ${stamp}`, slug: `sub-${stamp}`, description: "x", heroImage: "/x.jpg", parentId: categoryId } });
    const p = await prisma.product.create({ data: { orgId, categoryId: child.id, name: "Sub tote", slug: `${stamp}-s`, price: 1000, description: "x", thumbnail: "/x.jpg", productType: null } });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).productType).toBe(`${stamp}-a`);
    await prisma.product.delete({ where: { id: p.id } });
    await prisma.category.delete({ where: { id: child.id } });
  });

  it("moves a category's products and their family with it to another type, answers kept, a kind the type lacks cleared (A5, Q17)", async () => {
    const family = await prisma.productFamily.create({ data: { orgId, name: `Fam ${stamp}`, productType: `${stamp}-a` } });
    await prisma.product.update({ where: { id: productId }, data: { kind: "x", familyId: family.id } });
    await prisma.productType.update({ where: { key: `${stamp}-b` }, data: { kinds: [{ key: "y", label: "Y" }] } });
    await prisma.category.update({ where: { id: categoryId }, data: { productType: `${stamp}-b` } });
    const moved = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(moved.productType).toBe(`${stamp}-b`);
    expect(moved.kind).toBeNull();
    expect((await value("strap"))?.optionKey).toBe("detachable");
    expect((await prisma.productFamily.findUniqueOrThrow({ where: { id: family.id } })).productType).toBe(`${stamp}-b`);
    await prisma.product.update({ where: { id: productId }, data: { familyId: null } });
    await prisma.productFamily.delete({ where: { id: family.id } });
  });

  it("a category moved under a typed parent re-types its products (D7)", async () => {
    const loose = await prisma.category.create({ data: { name: `Loose ${stamp}`, slug: `loose-${stamp}`, description: "x", heroImage: "/x.jpg" } });
    const p = await prisma.product.create({ data: { orgId, categoryId: loose.id, name: "Loose", slug: `${stamp}-l`, price: 1000, description: "x", thumbnail: "/x.jpg", productType: `${stamp}-a` } });
    await prisma.category.update({ where: { id: loose.id }, data: { parentId: categoryId } });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).productType).toBe(`${stamp}-b`);
    await prisma.product.delete({ where: { id: p.id } });
    await prisma.category.delete({ where: { id: loose.id } });
  });
});
