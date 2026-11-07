/**
 * listing-model/channel-catalogue: Amazon's type schema read into catalogue fields (D2) — required,
 * conditional and optional told apart, each field's kind, allowed values and units, and the
 * attributes a create always sends marked as the adapter's so the shop is never asked them (Q5).
 */
import { describe, expect, it } from "vitest";

import { amazonCatalogueFields } from "@server/channels/providers/amazon/amazon.publish";
import { listingReadiness, type ChannelRegister } from "@server/listing/channel-readiness";

const valueEnum = (values: string[]) => ({ items: { properties: { value: { enum: values } } } });

const SCHEMA = {
  required: ["strap_type", "item_weight", "brand", "number_of_pockets"],
  allOf: [{ if: { properties: { parentage_level: {} } }, then: { required: ["frame"] } }],
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

describe("readiness names what the channel itself requires (channel-catalogue R4)", () => {
  const register = (over: Partial<ChannelRegister> = {}): ChannelRegister => ({
    categories: [{ kind: null, theirCategory: "TOTE_BAG", fit: "EXACT" as never, note: null }],
    attributesByCategory: new Map([["TOTE_BAG", [{ fact: "colour" as never, theirAttribute: "color", required: false }]]]),
    mappedValues: new Map(),
    requiredByCategory: new Map([["TOTE_BAG", [
      { key: "color", label: "Colour" },
      { key: "strap_type", label: "Strap Type" },
      { key: "part_number", label: "Part Number" },
    ]]]),
    filledByCategory: new Map([["TOTE_BAG", new Set(["part_number"])]]),
    ...over,
  });
  const subject = { kind: null, facts: { colour: { value: "black", origin: "product" } } as never };

  it("lists a required field no map or fill covers, by the channel's label, and keeps the listing incomplete", () => {
    const report = listingReadiness(subject, register());
    const missing = report.problems.filter((p) => p.problem === "missingField");
    expect(missing).toEqual([{ problem: "missingField", field: "strap_type", label: "Strap Type" }]);
    expect(report.state).toBe("incomplete");
  });

  it("says nothing new before a catalogue is read", () => {
    const report = listingReadiness(subject, register({ requiredByCategory: undefined, filledByCategory: undefined }));
    expect(report.problems.some((p) => p.problem === "missingField")).toBe(false);
  });
});
