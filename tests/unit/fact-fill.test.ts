// One fill for every marketplace (marketplace-facts D5): which type, which facts fill, which are
// asked. Shapes follow the shop's own Amazon listings read on 2026-10-23.
import { describe, expect, it } from "vitest";

import { mappingIsStale, planFill, typeFor, type FillMapping } from "@server/channels/fact-fill";
import { NO_DETAILS, type ListingAttributes } from "@server/channels/providers/listing-read";

const checked = new Date("2026-10-23");
const mapping: FillMapping = {
  types: [
    { productType: "prayer-mat", kind: null, theirCategory: "RUG" },
    { productType: "islamic-wear", kind: "abaya", theirCategory: "DRESS" },
    { productType: "dress", kind: null, theirCategory: "DRESS" },
  ],
  attributes: [
    { theirCategory: "RUG", fact: "colour", theirAttribute: "color", checkedOn: checked },
    { theirCategory: "RUG", fact: "material", theirAttribute: "material", checkedOn: new Date("2026-05-01") },
    { theirCategory: "RUG", fact: "pieces", theirAttribute: "number_of_items", checkedOn: checked },
    { theirCategory: "RUG", fact: "water_resistant", theirAttribute: "water_resistance_level", checkedOn: checked },
    { theirCategory: "RUG", fact: "care", theirAttribute: "care_instructions", checkedOn: checked },
  ],
  values: [{ list: "colour", valueKey: "green", theirValue: "green" }],
};

const type = {
  facts: [
    { key: "colour", answer: "choice" as const, list: "colour" },
    { key: "material", answer: "choice" as const, list: "material" },
    { key: "pieces", answer: "number" as const },
    { key: "water_resistant", answer: "boolean" as const },
    { key: "care", answer: "text" as const },
  ],
  measures: [
    { key: "length", unit: "in" },
    { key: "width", unit: "in" },
    { key: "height", unit: "cm" },
  ],
};

const lists = {
  colour: [
    { key: "green", label: "Green" },
    { key: "red", label: "Red" },
  ],
  material: [
    { key: "cotton", label: "Cotton" },
    { key: "crepe", label: "Crepe" },
    { key: "polyester", label: "Polyester" },
  ],
};

const read = (attributes: Record<string, string[]>, extra: Partial<ListingAttributes> = {}): ListingAttributes => ({
  type: "RUG",
  attributes,
  details: NO_DETAILS,
  ...extra,
});

const own = { productType: "prayer-mat", facts: {}, measurements: {} };
const plan = (r: ListingAttributes, product: typeof own | Record<string, unknown> = own, skips: string[] = []) =>
  planFill({ read: r, mapping, product: product as typeof own, type, lists, skips });

describe("which facts a listing fills (spec A1, Q2, Q22)", () => {
  it("fills a list answer on a mapped value or on our own answer's words, numbers and text as read", () => {
    const result = plan(read({ color: ["Light Green"], "color.standardized_values": ["green"], material: ["cotton"], number_of_items: ["1"], care_instructions: ["Hand wash"] }));
    expect(result.facts).toEqual([
      { key: "colour", value: "green", said: "Light Green" },
      { key: "material", value: "cotton", said: "cotton" },
      { key: "pieces", value: 1, said: "1" },
      { key: "care", value: "Hand wash", said: "Hand wash" },
    ]);
    expect(result.questions).toEqual([]);
  });

  it("reads a yes-or-no fact from the yes or no beside the marketplace's words, and nothing else", () => {
    const said = (code: string, standard: string[]) => read({ water_resistance_level: [code], "water_resistance_level.standardized_values": standard });
    expect(plan(said("waterproof", ["yes"])).facts).toEqual([{ key: "water_resistant", value: true, said: "waterproof" }]);
    expect(plan(said("not_water_resistant", ["no"])).facts).toEqual([{ key: "water_resistant", value: false, said: "not_water_resistant" }]);
    expect(plan(said("maybe", [])).facts).toEqual([]);
  });

  it("asks rather than guesses when the words name none of our answers, closest first (spec A2)", () => {
    const result = plan(read({ material: ["Polyester Blend"] }));
    expect(result.facts).toEqual([]);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({ fact: "material", said: "Polyester Blend" });
    expect(result.questions[0].options[0]).toEqual({ key: "polyester", label: "Polyester" });
  });

  it("asks when the words name two of our answers, both offered first (Q42)", () => {
    const result = plan(read({ color: ["Red"], "color.standardized_values": ["green"] }));
    expect(result.facts).toEqual([]);
    expect(result.questions[0].options.slice(0, 2).map((o) => o.key).sort()).toEqual(["green", "red"]);
  });

  it("keeps a long answer within what a stored fact holds, so the column never reads as empty", () => {
    const long = "Hand wash ".repeat(80);
    const [care] = plan(read({ care_instructions: [long] })).facts;
    expect(String(care.value).length).toBe(500);
    expect(care.said.length).toBe(500);
  });

  it("never touches an answered fact, never asks a skipped one", () => {
    const answered = { ...own, facts: { colour: { value: "red" }, material: { value: "crepe" } } };
    expect(plan(read({ color: ["green"], material: ["cotton"] }), answered).facts).toEqual([]);
    expect(plan(read({ material: ["Polyester Blend"] }), own, ["material"]).questions).toEqual([]);
  });

  it("fills nothing for an attribute the mapping does not name, or a listing that says nothing (spec A5)", () => {
    expect(plan(read({ fabric_weight: ["200 gsm"] })).facts).toEqual([]);
    const flipkart = plan(read({}, { type: null }));
    expect(flipkart).toMatchObject({ facts: [], questions: [], measurements: [] });
  });

  it("puts dimensions in the type's own unit, only where empty (Q30)", () => {
    const dims = { ...NO_DETAILS, dimensionsCm: { length: 106.7, width: 78.7, height: 1.3 } };
    const result = plan(read({}, { details: dims }), { ...own, measurements: { width: { value: 30 } } });
    expect(result.measurements).toEqual([
      { key: "length", value: 42, said: "106.7 cm" },
      { key: "height", value: 1.3, said: "1.3 cm" },
    ]);
  });

  it("dates the plan by the oldest mapping row for that type, and calls 90 days stale (Q8)", () => {
    const result = plan(read({ color: ["green"], material: ["cotton"] }));
    expect(result.oldestCheck).toEqual(new Date("2026-05-01"));
    expect(mappingIsStale(result.oldestCheck, new Date("2026-10-25"))).toBe(true);
    expect(mappingIsStale(checked, new Date("2026-10-25"))).toBe(false);
  });
});

describe("which type a listing is (Q9, Q11, Q6)", () => {
  it("keeps the product's own type, and fills facts only under it (spec A3)", () => {
    expect(typeFor(own, "DRESS", mapping)).toEqual({ kind: "own", productType: "prayer-mat" });
    const untyped = plan(read({ color: ["green"] }), { productType: null, facts: {}, measurements: {} });
    expect(untyped.type).toEqual({ kind: "mapped", productType: "prayer-mat" });
    expect(untyped.facts).toEqual([]);
  });

  it("asks when a marketplace type is read from several of ours, and parks one we have no type for", () => {
    const none = { productType: null, facts: {}, measurements: {} };
    expect(typeFor(none, "DRESS", mapping)).toEqual({ kind: "choose", productTypes: ["dress", "islamic-wear"] });
    expect(typeFor(none, "SHOES", mapping)).toEqual({ kind: "none", marketplaceType: "SHOES" });
    expect(typeFor(none, null, mapping)).toEqual({ kind: "unknown" });
  });
});
