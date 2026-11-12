// A category's shot list is stored as JSON and resolved up the tree in code, so the shape
// is only as trustworthy as the schema that parses it and the walk that finds it
// (431ed6e7:docs/specs/media-library/trd.md D4). Both are pinned here.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHOT_LIST,
  parseShotList,
  resolveShotList,
  shotListSchema,
  unknownSlots,
  type ShotList,
} from "@server/catalog/shot-list";

const list = (...keys: string[]): ShotList =>
  keys.map((key) => ({ key, label: key.toUpperCase(), role: "product" as const }));

describe("shotListSchema", () => {
  it("the default list satisfies its own schema", () => {
    expect(shotListSchema.safeParse(DEFAULT_SHOT_LIST).success).toBe(true);
  });

  it("refuses duplicate keys — a slot holds one photograph, so two slots cannot share a name", () => {
    const result = shotListSchema.safeParse(list("front", "front"));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("unique");
  });

  it("refuses a key that is not a lowercase slug", () => {
    for (const key of ["Front", "front photo", "-front", "", "a".repeat(41)]) {
      expect(shotListSchema.safeParse(list(key)).success, key).toBe(false);
    }
  });

  it("refuses an unknown role", () => {
    const bad = [{ key: "front", label: "Front", role: "hero" }];
    expect(shotListSchema.safeParse(bad).success).toBe(false);
  });

  it("bounds the list to one through twelve slots", () => {
    expect(shotListSchema.safeParse([]).success).toBe(false);
    expect(shotListSchema.safeParse(list(...Array.from({ length: 13 }, (_, i) => `s${i}`))).success).toBe(false);
    expect(shotListSchema.safeParse(list(...Array.from({ length: 12 }, (_, i) => `s${i}`))).success).toBe(true);
  });
});

describe("parseShotList", () => {
  it("returns null for nothing, and null for a value that does not parse, so the category inherits", () => {
    expect(parseShotList(null)).toBeNull();
    expect(parseShotList(undefined)).toBeNull();
    expect(parseShotList("front,back")).toBeNull();
    expect(parseShotList([{ key: "front" }])).toBeNull();
  });

  it("returns the parsed list when it is valid", () => {
    expect(parseShotList(list("front"))).toEqual(list("front"));
  });
});

describe("resolveShotList", () => {
  const categories = [
    { id: "root", parentId: null, shotList: list("hero", "pack") },
    { id: "mid", parentId: "root", shotList: null },
    { id: "leaf", parentId: "mid", shotList: null },
    { id: "own", parentId: "mid", shotList: list("swatch") },
    { id: "orphan", parentId: null, shotList: null },
    { id: "broken", parentId: "root", shotList: "not a list" },
  ];

  it("a category's own list wins, and replaces rather than extends its parent's", () => {
    expect(resolveShotList("own", categories)).toEqual(list("swatch"));
  });

  it("walks up to the nearest ancestor that defines one", () => {
    expect(resolveShotList("leaf", categories)).toEqual(list("hero", "pack"));
  });

  it("falls back to the default when nobody up the tree defines one", () => {
    expect(resolveShotList("orphan", categories)).toBe(DEFAULT_SHOT_LIST);
    expect(resolveShotList(null, categories)).toBe(DEFAULT_SHOT_LIST);
    expect(resolveShotList("missing", categories)).toBe(DEFAULT_SHOT_LIST);
  });

  it("a stored list that does not parse is skipped, not surfaced", () => {
    expect(resolveShotList("broken", categories)).toEqual(list("hero", "pack"));
  });

  it("survives a parent cycle", () => {
    const cyclic = [
      { id: "a", parentId: "b", shotList: null },
      { id: "b", parentId: "a", shotList: null },
    ];
    expect(resolveShotList("a", cyclic)).toBe(DEFAULT_SHOT_LIST);
  });
});

describe("unknownSlots", () => {
  it("names the keys the list does not declare and ignores empties", () => {
    expect(unknownSlots(["front", null, undefined, "side", ""], list("front", "back"))).toEqual(["side"]);
  });
});
