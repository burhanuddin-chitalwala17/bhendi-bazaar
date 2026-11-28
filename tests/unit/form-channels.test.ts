/**
 * Which of a shop's channels need each question of a type (listing-model/dynamic-form R2, A1).
 */
import { describe, expect, it } from "vitest";

import { channelUseFor, filterQuestions } from "@server/listing/form-channels";
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
  it("marks what a connected channel requires as required by it (A1)", () => {
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

describe("the form's filter chips (listing-model Q35)", () => {
  const measures = [{ key: "length" as const, required: true }, { key: "capacity" as const, required: false }];
  const keys = (qs: { key: string }[]) => qs.map((q) => q.key);

  it("All holds every question; Required holds only what bhendi-bazaar.com needs, whatever channels are on", () => {
    const use = channelUseFor("bag", [amazon, flipkart], new Set(["amazon"]));
    const f = filterQuestions(["style", "colour", "pattern"], measures, use, ["amazon", "flipkart", "meesho"]);
    expect(keys(f.chips[0].questions)).toEqual(["style", "colour", "pattern", "length", "capacity"]);
    expect(f.chips[1]).toEqual({ key: "required", questions: [{ kind: "measure", key: "length" }] });
    expect([...f.storeRequired]).toEqual(["length"]);
  });

  it("a channel chip holds every question that channel asks, connected or not", () => {
    const f = filterQuestions(["style", "colour", "pattern"], measures, channelUseFor("bag", [amazon, flipkart], new Set()), ["amazon", "flipkart", "meesho"]);
    expect(keys(f.chips.find((c) => c.key === "amazon")!.questions)).toEqual(["style", "pattern"]);
    expect(keys(f.chips.find((c) => c.key === "flipkart")!.questions)).toEqual(["capacity"]);
  });

  it("a channel that asks nothing of this type gets no chip", () => {
    const f = filterQuestions(["style"], measures, channelUseFor("bag", [amazon], new Set()), ["amazon", "flipkart", "meesho"]);
    expect(f.chips.map((c) => c.key)).toEqual(["all", "required", "amazon"]);
  });

  it("only the store's own questions carry the required badge", () => {
    const f = filterQuestions(["style"], measures, channelUseFor("bag", [amazon], new Set(["amazon"])), ["amazon"]);
    expect(f.badges.style).toEqual({ required: [], helps: ["amazon"] });
    expect(f.badges.length).toEqual({ required: ["store"], helps: [] });
  });

  it("another type's own map never badges this type", () => {
    const only = { channel: "amazon", fields: [field("style", "required")], maps: [map("amazon", "style", { attributeKey: "style", bbType: "clutch" })] };
    expect(channelUseFor("bag", [only], new Set(["amazon"]))).toEqual({});
  });
});
