/**
 * Building a channel listing from a product and the field maps (listing-model/field-maps D2–D6, Q7–Q10).
 * Pure; the Amazon shape is checked against Amazon's real HANDBAG schema (2026-11-08).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { amazonAttributes, checkAgainstSchema } from "@server/channels/providers/amazon/amazon.shape";
import { amazonCreateBody } from "@server/channels/providers/amazon/amazon.publish";
import { buildChannelListing, mapsFor, type BuildProduct } from "@server/listing/listing-builder";
import { ANY_BB_TYPE, FIELD_SOURCE, GAP_REASON, type FieldMapRow } from "@server/listing/field-map.types";
import type { CatalogueFieldRow } from "@server/listing/channel-catalogue.repository";
import { buildFeed, type FeedCandidate } from "@server/listing/shopfront-feed";
import { convert } from "@server/listing/units";

const field = (key: string, over: Partial<CatalogueFieldRow> = {}): CatalogueFieldRow => ({
  key, label: key, requirement: "required", kind: "text", allowedValues: null, allowedUnits: null, adapterFills: false, ...over,
});

let n = 0;
const map = (fieldPath: string, over: Partial<FieldMapRow>): FieldMapRow => ({
  id: `m${++n}`, channel: "amazon", channelType: "HANDBAG", fieldPath, bbType: ANY_BB_TYPE, source: FIELD_SOURCE.ATTRIBUTE,
  attributeKey: null, ruleKey: null, coreKey: null, shopKey: null, constant: null, unitTarget: null,
  checkedSource: "test", checkedOn: new Date("2026-11-08"), reason: "test", values: {}, ...over,
});

const product = (over: Partial<BuildProduct> = {}): BuildProduct => ({
  name: "Canvas Tote", sku: "NB-TOTE-1", description: "A tote.", brand: "Niqab Boutique", weightKg: 0.45, barcode: null, hsn: "4202",
  facts: { audience: { value: "women", origin: "product" }, colour: { value: "olive", origin: "product" }, material: { value: "canvas", origin: "product" } },
  measurements: { length: { value: 40, unit: "cm" }, width: { value: 12, unit: "cm" }, height: { value: 35, unit: "cm" } },
  sizeLabel: null, ...over,
});

const LABELS: Record<string, string> = { olive: "Olive", canvas: "Canvas", women: "Women" };
const build = (fields: CatalogueFieldRow[], maps: FieldMapRow[], p = product()) =>
  buildChannelListing({ fields, maps, product: p, labelOf: (_k, o) => (Object.hasOwn(LABELS, o) ? LABELS[o] : null) });
const sent = (r: ReturnType<typeof build>) => Object.fromEntries(r.fields.map((f) => [f.path, f.unit ? `${f.value} ${f.unit}` : f.value]));

describe("rules fill what the shop never answers (spec A2)", () => {
  it("a Women's tote sends Department Womens and Age range Adult", () => {
    const r = build([field("department"), field("age_range_description")], [
      map("department", { source: FIELD_SOURCE.RULE, ruleKey: "department_from_audience" }),
      map("age_range_description", { source: FIELD_SOURCE.RULE, ruleKey: "age_range_from_audience" }),
    ]);
    expect(sent(r)).toEqual({ department: "Womens", age_range_description: "Adult" });
    expect(r.gaps).toEqual([]);
  });

  it("gender reaches Amazon in Amazon's case, from the same rule Google reads", () => {
    const r = build([field("target_gender", { kind: "choice", allowedValues: ["Female", "Male", "Unisex"] })], [
      map("target_gender", { source: FIELD_SOURCE.RULE, ruleKey: "gender_from_audience" }),
    ]);
    expect(sent(r)).toEqual({ target_gender: "Female" });
  });
});

describe("units convert to the channel's (spec A3)", () => {
  it("weight in kilograms reaches Amazon in the unit its map names; a length in cm stays cm", () => {
    const r = build([field("item_weight", { kind: "measure" }), field("item_dimensions")], [
      map("item_weight", { source: FIELD_SOURCE.CORE, coreKey: "weight", unitTarget: "grams" }),
      map("item_dimensions.length", { attributeKey: "length", unitTarget: "centimeters" }),
    ]);
    expect(sent(r)).toEqual({ item_weight: "450 grams", "item_dimensions.length": "40 centimeters" });
  });

  it("with no unit named, a measure goes in the first unit the channel lists that ours converts to, never our word", () => {
    const r = build([field("item_weight", { kind: "measure", allowedUnits: ["grams", "kilograms"] }), field("frame", { kind: "measure", allowedUnits: ["pages"] })], [
      map("item_weight", { source: FIELD_SOURCE.CORE, coreKey: "weight" }),
      map("frame", { attributeKey: "length" }),
    ]);
    expect(sent(r)).toEqual({ item_weight: "450 grams" });
    expect(r.gaps.map((g) => [g.field, g.reason])).toEqual([["frame", "missing"]]);
  });

  it("grams to kilograms, and refuses a conversion across kinds rather than send a wrong number", () => {
    expect(convert(450, "g", "kilograms")).toBe(0.45);
    expect(convert(30, "cm", "inches")).toBe(11.811);
    expect(convert(30, "cm", "grams")).toBeNull();
  });
});

describe("answers are paired, never dropped (Q6, Q10)", () => {
  it("uses the map's own pair first, then the channel's word of the same letters", () => {
    const fields = [field("color"), field("closure", { kind: "choice", allowedValues: ["Zipper", "Magnetic Snap"] })];
    const r = build(fields, [
      map("color", { attributeKey: "colour", values: { olive: "Green" } }),
      map("closure", { attributeKey: "closure" }),
    ], product({ facts: { colour: { value: "olive", origin: "product" }, closure: { value: "zipper", origin: "product" } } }));
    expect(sent(r)).toEqual({ color: "Green", closure: "Zipper" });
  });

  it("a closed list with no word for the answer is a gap the shop sees, even on an optional field", () => {
    const r = build([field("closure", { requirement: "optional", kind: "choice", allowedValues: ["Zipper"] })], [map("closure", { attributeKey: "closure" })],
      product({ facts: { closure: { value: "kiss-lock", origin: "product" } } }));
    expect(r.fields).toEqual([]);
    expect(r.gaps).toEqual([{ field: "closure", label: "closure", reason: GAP_REASON.NO_MATCH, answer: "kiss-lock" }]);
  });

  it("an answer named like an object's own property is never read as a pair", () => {
    const r = build([field("style")], [map("style", { attributeKey: "occasion" })], product({ facts: { occasion: { value: "constructor", origin: "product" } } }));
    expect(sent(r)).toEqual({ style: "constructor" });
  });

  it("free text goes as our words", () => {
    expect(sent(build([field("outer")], [map("outer.material", { attributeKey: "material" })]))).toEqual({ "outer.material": "Canvas" });
  });
});

describe("what is missing is named (spec R1)", () => {
  it("a required field with no map, one waiting on a developer, and one the product does not answer", () => {
    const r = build([field("style"), field("inner"), field("pattern"), field("optional_one", { requirement: "optional" })], [
      map("inner.material", { source: FIELD_SOURCE.DEVELOPER }),
      map("pattern", { attributeKey: "pattern" }),
    ]);
    expect(r.gaps.map((g) => [g.field, g.reason])).toEqual([["inner", "developer"], ["pattern", "missing"], ["style", "unmapped"]]);
  });

  it("an adapter field is never a gap; a map on one still builds (channel-catalogue Q8)", () => {
    const r = build([field("brand", { adapterFills: true }), field("age_group", { adapterFills: true })], [
      map("age_group", { source: FIELD_SOURCE.RULE, ruleKey: "age_group_from_audience" }),
    ]);
    expect(r).toEqual({ fields: [{ path: "age_group", value: "adult" }], gaps: [] });
  });
});

describe("a fixed value is a default, and our type's own map wins (spec R4, Q7)", () => {
  it("the product's answer overrides a constant on the same attribute", () => {
    const m = map("style", { source: FIELD_SOURCE.CONSTANT, constant: "Contemporary", attributeKey: "occasion" });
    expect(sent(build([field("style")], [m], product({ facts: {} })))).toEqual({ style: "Contemporary" });
    expect(sent(build([field("style")], [m], product({ facts: { occasion: { value: "Formal", origin: "product" } } })))).toEqual({ style: "Formal" });
  });

  it("picks our type's row over the row for every type", () => {
    const all = map("item_type_name", { source: FIELD_SOURCE.CONSTANT, constant: "Handbag" });
    const tote = map("item_type_name", { source: FIELD_SOURCE.CONSTANT, constant: "Tote Bag", bbType: "tote" });
    expect(mapsFor([all, tote], "tote")).toEqual([tote]);
    expect(mapsFor([all, tote], "clutch")).toEqual([all]);
  });
});

describe("Amazon's shape comes from the type's own schema (Q9, D6)", () => {
  const raw = JSON.parse(readFileSync("tests/fixtures/amazon/HANDBAG.schema.json", "utf8"));
  const schema = raw.schema ?? raw;
  const fields = [
    { path: "outer.material", value: "Canvas" },
    { path: "item_dimensions.length", value: "40", unit: "centimeters" },
    { path: "item_dimensions.width", value: "12", unit: "centimeters" },
    { path: "item_dimensions.height", value: "35", unit: "centimeters" },
    { path: "item_weight", value: "450", unit: "grams" },
    { path: "number_of_pockets", value: "2" },
    { path: "department", value: "Womens" },
  ];

  it("nests parts and types numbers as Amazon declares them", () => {
    const attrs = amazonAttributes(schema, fields) as Record<string, Array<Record<string, unknown>>>;
    expect(attrs.outer).toEqual([{ marketplace_id: "A21TJRUUN4KGV", material: [{ value: "Canvas", language_tag: "en_IN" }] }]);
    expect(attrs.item_dimensions[0].length).toEqual({ value: 40, unit: "centimeters" });
    expect(attrs.item_weight).toEqual([{ value: 450, unit: "grams", marketplace_id: "A21TJRUUN4KGV" }]);
    expect(attrs.number_of_pockets).toEqual([{ value: 2, marketplace_id: "A21TJRUUN4KGV" }]);
  });

  it("the whole create body breaks no rule of the schema but what is still to be answered (D6)", () => {
    const input = {
      sku: "NB-1", mode: "new" as const, targetExternalId: null, marketplaceType: "HANDBAG", family: null, title: "Canvas Tote", price: 99_900, mrpPaise: 129_900,
      photoUrls: ["https://cdn/a.jpg", "https://cdn/b.jpg"], features: ["Roomy"], description: "A tote.", barcode: null, brand: "NB", generic: false, quantity: 3,
      fields, typeSchema: schema,
      compliance: { countryOfOrigin: "IN", manufacturer: "NB, Mumbai", packer: "NB, Mumbai", importer: null, hsn: "4202" },
    };
    for (const variant of [input, { ...input, barcode: "8901234567890" }, { ...input, family: { role: "parent" as const, theme: "COLOR" } }, { ...input, family: { role: "child" as const, parentSku: "FAM-1", theme: "COLOR" } }]) {
      const problems = checkAgainstSchema(schema, amazonCreateBody(variant).attributes);
      expect(problems.filter((p) => !p.message.startsWith("Amazon needs"))).toEqual([]);
    }
  });

  it("a schema that cannot be compiled skips the local check rather than refusing every create", () => {
    expect(checkAgainstSchema({ type: "object", properties: { a: { type: "string", pattern: "(" } } }, { a: "x" })).toEqual([]);
  });

  it("the schema finds no fault in what was shaped, and names what is still missing", () => {
    const problems = checkAgainstSchema(schema, amazonAttributes(schema, fields));
    const named = problems.map((p) => p.attribute);
    for (const ok of ["outer", "item_dimensions", "item_weight", "number_of_pockets", "department"]) expect(named).not.toContain(ok);
    expect(named).toEqual(expect.arrayContaining(["inner", "style", "model_name"]));
    expect(problems.find((p) => p.attribute === "inner")?.message).toMatch(/^Amazon needs .+ for this type\.$/);
  });
});

describe("Google and Meta receive the built attributes (channel-catalogue Q8)", () => {
  const candidate: FeedCandidate = {
    id: "p1", title: "Tote", description: "A tote.", link: "https://shop.example/p", images: ["https://img.example/a.jpg"],
    pricePaise: 99_900, offerPricePaise: null, inStock: true, brand: "NB", category: "3032",
    attributes: [{ path: "color", value: "Olive" }, { path: "gender", value: "female" }, { path: "product_weight", value: "450", unit: "g" }, { path: "brand", value: "Other" }, { path: "bad tag", value: "x" }],
  };

  it("writes each as a g: tag, a measure with its unit, never a tag the feed writes itself", () => {
    const xml = buildFeed("google", { title: "BB", link: "https://shop.example" }, [candidate]);
    expect(xml).toContain("<g:color>Olive</g:color>");
    expect(xml).toContain("<g:gender>female</g:gender>");
    expect(xml).toContain("<g:product_weight>450 g</g:product_weight>");
    expect(xml.match(/<g:brand>/g)).toHaveLength(1);
    expect(xml).not.toContain("bad tag");
  });
});
