/**
 * Which Amazon attributes are groups of parts (Amazon refusal, 2026-11-09): `inner` is its material,
 * `item_dimensions` its length, width and height, `size_info` its display name. Read from the stored HANDBAG
 * schema, so a request never offers one answer for them; a one-answer field (`item_weight`, value and unit) is not a group.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { amazonRequiredAttributes } from "@server/channels/providers/amazon/amazon.publish";

const schema = JSON.parse(readFileSync("tests/fixtures/amazon/HANDBAG.schema.json", "utf8")) as Record<string, unknown>;

describe("Amazon's grouped attributes", () => {
  it("names a group's parts and gives a one-answer field none", () => {
    // Every property judged, required or not, so the test does not depend on which ones Q3 requires today.
    const all = amazonRequiredAttributes({ ...schema, allOf: [], required: Object.keys((schema.properties ?? {}) as object) });
    const parts = (name: string) => all.find((a) => a.name === name)?.parts;
    expect(parts("inner")).toEqual(["material"]);
    expect(parts("item_dimensions")?.sort()).toEqual(["height", "length", "width"]);
    expect(parts("item_weight")).toEqual([]);
    expect(parts("water_resistance_level")).toEqual([]);
  });
});
