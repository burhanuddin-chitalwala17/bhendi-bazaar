/**
 * Which of a shop's channels need each question of a type (listing-model/dynamic-form R2, A1).
 */
import { describe, expect, it } from "vitest";

import { channelUseFor, groupQuestions } from "@server/listing/form-channels";
import type { FieldMapRow } from "@server/listing/field-map.types";

const field = (key: string, requirement: string) => ({ key, label: key, requirement, kind: "text", allowedValues: null, allowedUnits: null, adapterFills: false });
let n = 0;
const map = (channel: string, fieldPath: string, over: Partial<FieldMapRow>): FieldMapRow => ({
  id: `m${++n}`, channel, channelType: "T", fieldPath, bbType: "", source: "attribute", attributeKey: null, ruleKey: null, coreKey: null,
  shopKey: null, constant: null, unitTarget: null, checkedSource: "t", checkedOn: new Date(), reason: "t", values: {}, ...over,
});

const amazon = {
  channel: "amazon",
  fields: [field("style", "required"), field("inner", "required"), field("number_of_pockets", "required"), field("strap_type", "required"), field("department", "required"), field("item_type_name", "required"), field("pattern", "optional")],
  maps: [
    map("amazon", "style", { attributeKey: "style" }), map("amazon", "inner.material", { attributeKey: "innerMaterial" }),
    map("amazon", "number_of_pockets", { attributeKey: "pocketCount" }), map("amazon", "strap_type", { attributeKey: "strapType" }),
    map("amazon", "department", { source: "rule", ruleKey: "department_from_audience" }),
    map("amazon", "item_type_name", { source: "constant", constant: "Tote Bag", attributeKey: "genericName" }),
    map("amazon", "pattern", { attributeKey: "pattern" }),
  ],
};
const flipkart = { channel: "flipkart", fields: [field("Bag Capacity", "required")], maps: [map("flipkart", "Bag Capacity", { attributeKey: "capacity" })] };

describe("the form's channel badges", () => {
  it("puts what a connected channel requires under Required now, badged with it (A1)", () => {
    const use = channelUseFor("bag", [amazon, flipkart], new Set(["amazon"]));
    for (const q of ["style", "innerMaterial", "pocketCount", "strapType", "audience"]) expect(use[q], q).toEqual({ required: ["amazon"], helps: [] });
  });

  it("a channel the shop does not sell on, an optional field, or a fixed default only helps", () => {
    const use = channelUseFor("bag", [amazon, flipkart], new Set(["amazon"]));
    expect(use.capacity).toEqual({ required: [], helps: ["flipkart"] });
    expect(use.pattern).toEqual({ required: [], helps: ["amazon"] });
    expect(use.genericName).toEqual({ required: [], helps: ["amazon"] });
  });

  it("connecting the channel makes its fields required", () => {
    expect(channelUseFor("bag", [amazon, flipkart], new Set(["amazon", "flipkart"])).capacity).toEqual({ required: ["flipkart"], helps: [] });
  });
});

describe("the form's two groups (ux state matrix)", () => {
  const measures = [{ key: "length" as const, required: true }, { key: "capacity" as const, required: false }];

  it("Required now holds the store's required measurements and what a connected channel requires; the rest helps", () => {
    const use = channelUseFor("bag", [amazon, flipkart], new Set(["amazon"]));
    const g = groupQuestions(["style", "colour", "pattern"], measures, use);
    expect(g.required.map((q) => q.key)).toEqual(["style", "length"]);
    expect(g.badges.length).toEqual({ required: ["store"], helps: [] });
    expect(g.rest.map((q) => q.key)).toEqual(["colour", "pattern", "capacity"]);
    expect(g.helps).toEqual(["amazon", "flipkart"]);
  });

  it("with no channel connected, only the store's own required questions are Required now", () => {
    const g = groupQuestions(["style", "colour"], measures, {});
    expect(g.required.map((q) => q.key)).toEqual(["length"]);
    expect(g.rest.map((q) => q.key)).toEqual(["style", "colour", "capacity"]);
  });

  it("another type's own map never badges this type", () => {
    const only = { channel: "amazon", fields: [field("style", "required")], maps: [map("amazon", "style", { attributeKey: "style", bbType: "clutch" })] };
    expect(channelUseFor("bag", [only], new Set(["amazon"]))).toEqual({});
  });
});
