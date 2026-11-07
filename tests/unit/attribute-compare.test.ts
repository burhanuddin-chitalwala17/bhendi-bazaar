/**
 * The release gate's comparison of answers before and after the move (listing-model/attributes D9, A3).
 */
import { describe, expect, it } from "vitest";

import { compareProduct } from "@server/listing/attribute-compare";

const product = {
  id: "p1", productType: "bag", weight: 0.45, measureUnits: { length: "cm", width: "in" },
  facts: { colour: { value: "olive", origin: "product" }, compartments: { value: 3, origin: "product" }, waterResistant: { value: true, origin: "brand" } },
  measurements: { length: { value: 40, origin: "product" }, width: { value: 2, origin: "product" } },
};
const row = (attributeKey: string, v: Partial<{ optionKey: string; text: string; number: string; bool: boolean }>) =>
  ({ attributeKey, optionKey: v.optionKey ?? null, text: v.text ?? null, number: v.number ?? null, bool: v.bool ?? null });
const moved = [
  row("colour", { optionKey: "olive" }), row("compartments", { number: "3" }), row("waterResistant", { bool: true }),
  row("length", { number: "400" }), row("width", { number: "50.8" }), row("weight", { number: "450" }),
];

describe("the move compared", () => {
  it("passes when every answer is there with its value, measures canonical", () => {
    expect(compareProduct(product, moved)).toEqual({ answers: 6, mismatches: [] });
  });

  it("names an answer that is missing, changed, or converted wrongly", () => {
    const broken = moved.filter((r) => r.attributeKey !== "colour").map((r) => (r.attributeKey === "width" ? row("width", { number: "50" }) : r.attributeKey === "compartments" ? row("compartments", { number: "4" }) : r));
    expect(compareProduct(product, broken).mismatches.map((m) => [m.key, m.after])).toEqual([["colour", null], ["compartments", "4"], ["width", "50"]]);
  });

  it("accepts an answer kept as text when it did not fit its kind", () => {
    const odd = { ...product, facts: { compartments: { value: "many", origin: "product" } }, measurements: {}, weight: null };
    expect(compareProduct(odd, [row("compartments", { text: "many" })]).mismatches).toEqual([]);
  });
});
