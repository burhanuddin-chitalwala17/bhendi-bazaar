/**
 * The admin's field-map edit, as the form sends it (listing-model/field-maps R6, D8): blank pair boxes are no
 * pair, keys must exist, a planned question may be named (Q17).
 */
import { describe, expect, it } from "vitest";

import { fieldMapSaveSchema } from "@/lib/validation/schemas/field-map.schema";

const base = {
  channel: "amazon", channelType: "HANDBAG", fieldPath: "closure.type", bbType: "", source: "attribute", key: "closure",
  constant: null, unitTarget: null, reason: "Closure", values: {},
};

describe("a field-map edit", () => {
  it("takes a map with some answers paired and the rest left blank, as the form sends them", () => {
    const parsed = fieldMapSaveSchema.parse({ ...base, values: { zipper: "Zipper", kisslock: undefined, snap: "  " } });
    expect(parsed.values).toEqual({ zipper: "Zipper" });
  });

  it("refuses a question, rule or unit that does not exist, and accepts one the attributes subfeature adds", () => {
    expect(fieldMapSaveSchema.safeParse({ ...base, key: "nope" }).success).toBe(false);
    expect(fieldMapSaveSchema.safeParse({ ...base, source: "rule", key: "made_up" }).success).toBe(false);
    expect(fieldMapSaveSchema.safeParse({ ...base, unitTarget: "parsecs" }).success).toBe(false);
    expect(fieldMapSaveSchema.safeParse({ ...base, key: "innerMaterial" }).success).toBe(true);
    expect(fieldMapSaveSchema.safeParse({ ...base, source: "constant", key: "genericName", constant: "Handbag" }).success).toBe(true);
  });

  it("asks for the fixed value of a constant", () => {
    expect(fieldMapSaveSchema.safeParse({ ...base, source: "constant", key: null, constant: null }).success).toBe(false);
  });
});
