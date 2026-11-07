/**
 * listing-model/channel-catalogue: Amazon's type schema read into catalogue fields (D2) — required,
 * conditional and optional told apart, each field's kind, allowed values and units, and the
 * attributes a create always sends marked as the adapter's so the shop is never asked them (Q5).
 */
import { describe, expect, it } from "vitest";

import { amazonCatalogueFields } from "@server/channels/providers/amazon/amazon.publish";
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

  it("reads an unknown keyword as unknown, and a vacuous constraint on an absent attribute as true", () => {
    expect(holds({ minProperties: 3 })).toBeNull();
    expect(holds({ properties: { parentage_level: { contains: {} } } })).toBe(true);
    expect(holds({ required: ["brand"] })).toBe(true);
    expect(holds({ required: ["merchant_suggested_asin"] })).toBe(false);
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
