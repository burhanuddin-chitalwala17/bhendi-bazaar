/**
 * listing-model/channel-catalogue: Amazon's type schema read into catalogue fields (D2) — required,
 * conditional and optional told apart, each field's kind, allowed values and units, and the
 * attributes a create always sends marked as the adapter's so the shop is never asked them (Q5).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { amazonCatalogueFields, amazonRequiredAttributes } from "@server/channels/providers/amazon/amazon.publish";
import { amazonRequirements, holds } from "@server/channels/providers/amazon/amazon.requirements";
import { listingReadiness, type ChannelRegister } from "@server/listing/channel-readiness";

const valueEnum = (values: string[]) => ({ items: { properties: { value: { enum: values } } } });

const SCHEMA = {
  required: ["strap_type", "item_weight", "brand", "number_of_pockets"],
  allOf: [{
    if: { required: ["parentage_level"], properties: { parentage_level: { contains: { properties: { value: { enum: ["parent"] } } } } } },
    then: { required: ["frame"] },
  }],
  properties: {
    strap_type: { title: "Strap Type", ...valueEnum(["Adjustable", "Cross-Body", "Shoulder"]) },
    item_weight: { title: "Item Weight", items: { properties: { value: { type: "number" }, unit: { enum: ["grams", "kilograms"] } } } },
    brand: { title: "Brand Name", items: { properties: { value: { type: "string" } } } },
    number_of_pockets: { title: "Number of Pockets", items: { properties: { value: { type: "integer" } } } },
    frame: { title: "Frame", items: { properties: { value: { type: "string" } } } },
    lining_description: { title: "Lining", items: { properties: { value: { type: "string" } } } },
  },
};

describe("Amazon's type schema as catalogue fields (channel-catalogue D2)", () => {
  const byKey = new Map(amazonCatalogueFields(SCHEMA).map((f) => [f.key, f]));

  it("tells required, conditional and optional apart", () => {
    expect(byKey.get("strap_type")?.requirement).toBe("required");
    expect(byKey.get("frame")?.requirement).toBe("conditional");
    expect(byKey.get("lining_description")?.requirement).toBe("optional");
  });

  it("reads each field's kind, allowed values and units", () => {
    expect(byKey.get("strap_type")).toMatchObject({ kind: "choice", allowedValues: ["Adjustable", "Cross-Body", "Shoulder"], allowedUnits: null });
    expect(byKey.get("item_weight")).toMatchObject({ kind: "measure", allowedUnits: ["grams", "kilograms"] });
    expect(byKey.get("number_of_pockets")?.kind).toBe("number");
    expect(byKey.get("lining_description")?.kind).toBe("text");
  });

  it("marks what a create always sends as the adapter's, never the shop's (Q5)", () => {
    expect(byKey.get("brand")?.adapterFills).toBe(true);
    expect(byKey.get("strap_type")?.adapterFills).toBe(false);
  });
});

// Shaped as Amazon writes its rules: a new page, a parent, a marketplace, an either/or, a value test.
const RULES = {
  required: ["item_name"],
  allOf: [
    { if: { not: { required: ["merchant_suggested_asin"] } }, then: { required: ["style", "outer"] } },
    { if: { required: ["parentage_level"] }, then: { required: ["variation_theme"] }, else: { required: ["item_weight"] } },
    { if: { properties: { marketplace_id: { contains: { enum: ["A21TJRUUN4KGV"] } } } }, then: { required: ["age_range_description"] } },
    { anyOf: [{ required: ["gtin"] }, { required: ["supplier_declared_has_product_identifier_exemption"] }] },
    { if: { required: ["material"], properties: { material: { contains: { properties: { value: { enum: ["leather"] } } } } } }, then: { required: ["leather_type"] } },
  ],
};

describe("Amazon's rules judged for one standalone new page on amazon.in (channel-catalogue Q3)", () => {
  const req = amazonRequirements(RULES);

  it("requires what a new page needs, and what a standalone listing needs in the else branch", () => {
    expect(req.get("style")).toBe("required");
    expect(req.get("outer")).toBe("required");
    expect(req.get("item_weight")).toBe("required");
    expect(req.get("item_name")).toBe("required");
  });

  it("stores what only a parent or a variation needs as conditional, never required", () => {
    expect(req.get("variation_theme")).toBe("conditional");
  });

  it("leaves what it cannot judge conditional rather than guess: a value test, an either/or, a marketplace", () => {
    expect(req.get("leather_type")).toBe("conditional");
    expect(req.get("gtin")).toBe("conditional");
    expect(req.get("age_range_description")).toBe("conditional");
  });

  it("judges an `if` nested in a branch, and keywords beside an `if`, rather than dropping them", () => {
    const nested = amazonRequirements({ allOf: [
      { if: { not: { required: ["merchant_suggested_asin"] } }, then: { if: { required: ["parentage_level"] }, then: { required: ["deep_parent"] }, else: { required: ["deep_standalone"] } } },
      { if: { required: ["parentage_level"] }, then: { required: ["swatch"] }, required: ["beside"] },
    ] });
    expect(nested.get("deep_standalone")).toBe("required");
    expect(nested.get("deep_parent")).toBe("conditional");
    expect(nested.get("beside")).toBe("required");
    expect(nested.get("swatch")).toBe("conditional");
  });

  it("treats an attribute a create sends only when answered as unknown, never as present", () => {
    expect(holds({ required: ["brand"] })).toBeNull();
    expect(amazonRequirements({ allOf: [{ if: { not: { required: ["bullet_point"] } }, then: { required: ["x"] } }] }).get("x")).toBe("conditional");
  });

  it("reads an unknown keyword as unknown, and a vacuous constraint on an absent attribute as true", () => {
    expect(holds({ minProperties: 3 })).toBeNull();
    expect(holds({ properties: { parentage_level: { contains: {} } } })).toBe(true);
    expect(holds({ required: ["item_name"] })).toBe(true);
    expect(holds({ required: ["merchant_suggested_asin"] })).toBe(false);
    // `false` under properties means "must be absent".
    expect(holds({ properties: { item_name: false } })).toBe(false);
    expect(holds({ properties: { merchant_suggested_asin: false } })).toBe(true);
    expect(holds({ properties: { brand: false } })).toBeNull();
  });

  it("asks a request only what is required of the Q3 listing and not sent by a create (setup-requests D7)", () => {
    const names = amazonRequiredAttributes({ ...RULES, properties: Object.fromEntries(["item_name", "style", "outer", "item_weight", "variation_theme", "gtin"].map((k) => [k, { title: k }])) }).map((a) => a.name);
    expect(names.sort()).toEqual(["item_weight", "outer", "style"]);
  });
});

// Amazon's real HANDBAG definition (amazon.in, LISTING), saved by scripts/amazon-type-probe.ts on 2026-11-08.
const HANDBAG = JSON.parse(readFileSync(join(__dirname, "../fixtures/amazon/HANDBAG.schema.json"), "utf8")) as Record<string, unknown>;

describe("Amazon HANDBAG, the real schema behind the 2026-11-06 refusal (channel-catalogue A1, Q3)", () => {
  const fields = amazonCatalogueFields(HANDBAG);
  const shopRequired = fields.filter((f) => f.requirement === "required" && !f.adapterFills).map((f) => f.key);

  it("asks the shop every field the refusal named", () => {
    // The refusal's fields; strap_type is asked too, and is mapped today, to the wrong question (field-maps).
    expect(shopRequired).toEqual(expect.arrayContaining([
      "item_weight", "item_dimensions", "size_info", "outer", "inner", "strap_type", "department",
      "age_range_description", "number_of_items", "style", "number_of_pockets", "capacity",
    ]));
  });

  it("finds them only in the rules: the schema's own `required` alone asks the shop nothing", () => {
    const topLevel = new Set((HANDBAG.required as string[]) ?? []);
    expect(fields.filter((f) => topLevel.has(f.key) && !f.adapterFills)).toEqual([]);
    expect(shopRequired.length).toBeGreaterThanOrEqual(13);
  });

  it("keeps what only a variation parent or child needs out of the shop's list", () => {
    const byKey = new Map(fields.map((f) => [f.key, f.requirement]));
    expect(byKey.get("variation_theme")).not.toBe("required");
    expect(byKey.get("child_parent_sku_relationship")).not.toBe("required");
  });
});

describe("readiness names what the channel itself requires (channel-catalogue R4)", () => {
  const register = (over: Partial<ChannelRegister> = {}): ChannelRegister => ({
    categories: [{ kind: null, theirCategory: "TOTE_BAG", fit: "EXACT" as never, note: null }],
    attributesByCategory: new Map([["TOTE_BAG", [{ fact: "colour" as never, theirAttribute: "color", required: false }]]]),
    mappedValues: new Map(),
    requiredByCategory: new Map([["TOTE_BAG", { asOf: "2026-11-07T00:00:00.000Z", fields: [
      { key: "color", label: "Colour" },
      { key: "strap_type", label: "Strap Type" },
      { key: "part_number", label: "Part Number" },
    ] }]]),
    filledByCategory: new Map([["TOTE_BAG", new Set(["part_number"])]]),
    ...over,
  });
  const subject = { kind: null, facts: { colour: { value: "black", origin: "product" } } as never };

  it("lists a required field no map or fill covers, by the channel's label, and keeps the listing incomplete", () => {
    const report = listingReadiness(subject, register());
    const missing = report.problems.filter((p) => p.problem === "missingField");
    expect(missing).toEqual([{ problem: "missingField", field: "strap_type", label: "Strap Type", asOf: "2026-11-07T00:00:00.000Z" }]);
    expect(report.state).toBe("incomplete");
  });

  it("says nothing new before a catalogue is read", () => {
    const report = listingReadiness(subject, register({ requiredByCategory: undefined, filledByCategory: undefined }));
    expect(report.problems.some((p) => p.problem === "missingField")).toBe(false);
  });
});
