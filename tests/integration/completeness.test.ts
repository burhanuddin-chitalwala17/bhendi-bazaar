/**
 * listing-model/dynamic-form unit 2 against a real schema: a product's completeness per channel the shop
 * sells on is stored by the refresh, moves when it is answered (A2), and is counted for Home (R5).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("completeness per channel (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let service: typeof import("@server/listing/completeness.service").completenessService;
  const stamp = `cp${Date.now().toString(36)}`;
  const type = `${stamp}-bag`;
  const theirType = `${stamp.toUpperCase()}_TOTE`;
  let orgId: string;
  let categoryId: string;
  let productId: string;
  let flipkartWas: { enabled: boolean } | null;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ completenessService: service } = await import("@server/listing/completeness.service"));
    ({ orgId } = await ensureFixtures());
    await prisma.productType.create({ data: { key: type, label: "Bag", facts: ["style", "pocketCount"], measures: [], variantAxis: [], kinds: [], factLabels: {}, labelFrom: [] } });
    categoryId = (await prisma.category.create({ data: { name: `Cat ${stamp}`, slug: `cat-${stamp}`, description: "x", heroImage: "/x.jpg", productType: type } })).id;
    await prisma.channelCategoryMap.create({ data: { channel: "flipkart", productType: type, theirCategory: theirType, fit: "EXACT", checkedOn: new Date(), publishes: true } });
    const { channelCatalogueService } = await import("@server/listing/channel-catalogue.service");
    const f = (key: string) => ({ key, label: key, requirement: "required" as const, kind: "text" as const, allowedValues: null, allowedUnits: null, adapterFills: false });
    await channelCatalogueService.store("flipkart", { key: theirType, label: "Tote", schema: null, schemaVersion: null, fields: [f("Style"), f("Pockets"), { ...f("Seller SKU ID"), adapterFills: true }] }, "test", new Date());
    const { fieldMapRepository } = await import("@server/listing/field-map.repository");
    const base = { channel: "flipkart", channelType: theirType, bbType: "", source: "attribute", ruleKey: null, coreKey: null, shopKey: null, constant: null, unitTarget: null, checkedSource: "t", checkedOn: new Date(), reason: "t" };
    await fieldMapRepository.save({ ...base, fieldPath: "Style", attributeKey: "style" }, {});
    await fieldMapRepository.save({ ...base, fieldPath: "Pockets", attributeKey: "pocketCount" }, {});
    flipkartWas = await prisma.orgChannel.findUnique({ where: { orgId_channel: { orgId, channel: "flipkart" } }, select: { enabled: true } });
    await prisma.orgChannel.upsert({ where: { orgId_channel: { orgId, channel: "flipkart" } }, create: { orgId, channel: "flipkart", enabled: true }, update: { enabled: true } });
    productId = (await prisma.product.create({ data: { orgId, categoryId, name: "Tote", slug: `${stamp}-p`, price: 1000, description: "x", thumbnail: "/x.jpg", facts: {} } })).id;
  });

  afterAll(async () => {
    if (flipkartWas) await prisma.orgChannel.update({ where: { orgId_channel: { orgId, channel: "flipkart" } }, data: flipkartWas });
    else await prisma.orgChannel.deleteMany({ where: { orgId, channel: "flipkart" } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.fieldMap.deleteMany({ where: { channelType: theirType } });
    await prisma.channelType.deleteMany({ where: { key: theirType } });
    await prisma.channelCategoryMap.deleteMany({ where: { productType: type } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.productType.deleteMany({ where: { key: type } });
  });

  it("stores what each channel still needs, adapter fields not counted, and moves when answered (R4, A2)", async () => {
    await service.refresh(orgId, [productId]);
    expect(await service.forProduct(productId)).toEqual([{ productId, orgId, channel: "flipkart", required: 2, missing: 2, missingKeys: ["Pockets", "Style"] }]);
    const before = (await service.needsFor(orgId)).find((n) => n.channel === "flipkart");
    expect(before?.details).toBeGreaterThanOrEqual(2);
    await prisma.product.update({ where: { id: productId }, data: { facts: { style: { value: "formal", origin: "product" }, pocketCount: { value: 2, origin: "product" } } } });
    await service.refresh(orgId, [productId]);
    expect((await service.forProduct(productId))[0]).toMatchObject({ required: 2, missing: 0 });
  });

  it("an archived product, and a channel type never read, hold no row: never a Ready not earned (review)", async () => {
    await prisma.product.update({ where: { id: productId }, data: { archivedAt: new Date() } });
    await service.refresh(orgId, [productId]);
    expect(await service.forProduct(productId)).toEqual([]);
    await prisma.product.update({ where: { id: productId }, data: { archivedAt: null } });
    await prisma.channelField.updateMany({ where: { channelType: { key: theirType } }, data: { goneAt: new Date() } });
    await service.refresh(orgId, [productId]);
    expect(await service.forProduct(productId)).toEqual([]);
    await prisma.channelField.updateMany({ where: { channelType: { key: theirType } }, data: { goneAt: null } });
  });

  it("a channel the shop stops selling on loses its row (R4)", async () => {
    await prisma.orgChannel.update({ where: { orgId_channel: { orgId, channel: "flipkart" } }, data: { enabled: false } });
    await service.refresh(orgId, [productId]);
    expect(await service.forProduct(productId)).toEqual([]);
  });
});
