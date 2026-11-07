/**
 * listing-model/field-maps against a real schema: maps and catalogue read once per batch whatever its
 * size (hazard *cost*), our type's own map chosen over the one for every type (Q7), a stored measure
 * converted for the channel (spec A3).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from "vitest";

import { isDisposableDb } from "../helpers/test-db";

process.env.PRISMA_LOG_QUERIES = "1";
let queries = 0;
let spy: MockInstance;
async function countQueries(run: () => Promise<unknown>): Promise<number> {
  queries = 0;
  await run();
  return queries;
}

describe.skipIf(!isDisposableDb)("building channel listings (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let service: typeof import("@server/listing/listing-build.service").listingBuildService;
  let fieldMaps: typeof import("@server/listing/field-map.repository").fieldMapRepository;
  let catalogue: typeof import("@server/listing/channel-catalogue.service").channelCatalogueService;

  const stamp = `lb${Date.now().toString(36)}`;
  const type = `${stamp}-tote`;
  const theirType = `${stamp.toUpperCase()}_HANDBAG`;
  const CHECKED = { checkedSource: "test", checkedOn: new Date("2026-11-08"), reason: "test" };
  const NONE = { attributeKey: null, ruleKey: null, coreKey: null, shopKey: null, constant: null, unitTarget: null };

  const source = (id: string, audience: string) => ({
    id, name: "Tote", sku: `SKU-${id}`, description: "A tote.", brand: null, weightKg: 0.45, barcode: null, productType: type, kind: null, hsn: null,
    facts: { audience: { value: audience, origin: "product" } },
    measurements: { length: { value: 40, origin: "product" } },
  });

  beforeAll(async () => {
    spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      if (typeof args[0] === "string" && args[0].startsWith("prisma:query")) queries += 1;
    });
    ({ prisma } = await import("@server/shared/prisma"));
    ({ listingBuildService: service } = await import("@server/listing/listing-build.service"));
    ({ fieldMapRepository: fieldMaps } = await import("@server/listing/field-map.repository"));
    ({ channelCatalogueService: catalogue } = await import("@server/listing/channel-catalogue.service"));
    await prisma.productType.create({ data: { key: type, label: "Test tote", facts: ["audience"], measures: [{ key: "length", label: "Length", unit: "cm", required: false }], variantAxis: [], kinds: [], factLabels: {}, labelFrom: [] } });
    const f = (key: string) => ({ key, label: key, requirement: "required" as const, kind: "text" as const, allowedValues: null, allowedUnits: null, adapterFills: false });
    await catalogue.store("amazon", { key: theirType, label: "Handbag", schema: null, schemaVersion: null, fields: [f("department"), f("item_type_name"), f("item_dimensions"), f("item_weight")] }, "test", new Date());
    const base = { channel: "amazon", channelType: theirType, bbType: "", ...NONE, ...CHECKED };
    await fieldMaps.save({ ...base, fieldPath: "department", source: "rule", ruleKey: "department_from_audience" }, {});
    await fieldMaps.save({ ...base, fieldPath: "item_type_name", source: "constant", constant: "Handbag" }, {});
    await fieldMaps.save({ ...base, fieldPath: "item_type_name", bbType: type, source: "constant", constant: "Tote Bag" }, {});
    await fieldMaps.save({ ...base, fieldPath: "item_dimensions.length", source: "attribute", attributeKey: "length", unitTarget: "millimeters" }, {});
    await fieldMaps.save({ ...base, fieldPath: "item_weight", source: "core", coreKey: "weight", unitTarget: "grams" }, {});
  });

  afterAll(async () => {
    spy?.mockRestore();
    await prisma.fieldMap.deleteMany({ where: { channelType: theirType } });
    await prisma.channelType.deleteMany({ where: { key: theirType } });
    await prisma.productType.deleteMany({ where: { key: type } });
  });

  it("builds from the stored maps: our type's own row, a rule, and units converted (Q7, A2, A3)", async () => {
    const { built } = await service.build("amazon", [{ channelType: theirType, product: source("a", "women") }]);
    const fields = Object.fromEntries(built.get("a")!.fields.map((x) => [x.path, x.unit ? `${x.value} ${x.unit}` : x.value]));
    expect(fields).toEqual({ department: "Womens", item_type_name: "Tote Bag", "item_dimensions.length": "400 millimeters", item_weight: "450 grams" });
    expect(built.get("a")!.gaps).toEqual([]);
  });

  it("an admin's change to a map is what the next build sends (spec A4)", async () => {
    const { fieldMapService } = await import("@server/listing/field-map.service");
    await fieldMapService.save({ channel: "amazon", channelType: theirType, fieldPath: "department", bbType: "", source: "constant", key: null, constant: "Unisex", unitTarget: null, reason: "test", values: {} });
    const { built } = await service.build("amazon", [{ channelType: theirType, product: source("a", "women") }]);
    expect(built.get("a")!.fields.find((f) => f.path === "department")?.value).toBe("Unisex");
  });

  it("the admin's view lists each field with its map, and one the channel added as new (R6, ux.md)", async () => {
    const { adminFieldMapService } = await import("@server/listing/admin.field-map.service");
    const view = await adminFieldMapService.view("amazon", theirType);
    expect(view?.rows.map((r) => [r.field, r.maps.map((m) => m.fieldPath)])).toEqual(expect.arrayContaining([["item_dimensions", ["item_dimensions.length"]], ["item_type_name", ["item_type_name", "item_type_name"]]]));
    const types = await adminFieldMapService.types("amazon");
    expect(types.find((t) => t.key === theirType)).toEqual({ key: theirType, label: "Handbag", required: 4, unmapped: 0 });
  });

  it("costs the same for forty products as for one (hazard cost)", async () => {
    const one = await countQueries(() => service.build("amazon", [{ channelType: theirType, product: source("a", "women") }]));
    const forty = await countQueries(() => service.build("amazon", Array.from({ length: 40 }, (_, i) => ({ channelType: theirType, product: source(`p${i}`, i % 2 ? "men" : "women") }))));
    expect(one).toBeGreaterThan(0);
    expect(forty).toBe(one);
  });
});
