import { describe, expect, it } from "vitest";

import { answeredBy, fillFacts, levelsOf, takeOwnership } from "@server/listing/fill-facts";
import { ORIGIN } from "@server/listing/listing-facts";

type K = "material" | "countryOfOrigin" | "manufacturer" | "colour";
const KEYS: K[] = ["material", "countryOfOrigin", "manufacturer", "colour"];

const family = { material: "nida-matte", colour: "black" };
const brand = { material: "crepe", countryOfOrigin: "IN", manufacturer: "Noor Garments" };
const defaults = { countryOfOrigin: "AE" };

describe("the levels are asked in order, first answer winning", () => {
  it("takes the product's own answer over every level", () => {
    const filled = fillFacts<K>({ material: "georgette" }, levelsOf(family, brand, defaults), KEYS);
    expect(filled.material).toEqual({ value: "georgette", origin: ORIGIN.PRODUCT });
  });

  it("takes the family's before the brand's", () => {
    const filled = fillFacts<K>({}, levelsOf(family, brand, defaults), KEYS);
    expect(filled.material).toEqual({ value: "nida-matte", origin: ORIGIN.FAMILY });
  });

  it("takes the brand's before the defaults'", () => {
    const filled = fillFacts<K>({}, levelsOf(family, brand, defaults), KEYS);
    expect(filled.countryOfOrigin).toEqual({ value: "IN", origin: ORIGIN.BRAND });
  });

  it("falls through to the defaults when nothing above answers", () => {
    const filled = fillFacts<K>({}, levelsOf(null, null, defaults), KEYS);
    expect(filled.countryOfOrigin).toEqual({ value: "AE", origin: ORIGIN.DEFAULTS });
  });

  it("leaves a fact absent when no level answers, rather than blank", () => {
    const filled = fillFacts<K>({}, levelsOf(null, null, null), KEYS);
    expect(filled.material).toBeUndefined();
    expect(Object.keys(filled)).toEqual([]);
  });

  it("skips a level that is absent entirely", () => {
    const filled = fillFacts<K>({}, levelsOf(null, brand, defaults), KEYS);
    expect(filled.material?.origin).toBe(ORIGIN.BRAND);
  });

  it("answers each key independently of the others", () => {
    const filled = fillFacts<K>({ material: "georgette" }, levelsOf(family, brand, defaults), KEYS);
    expect(filled.material?.origin).toBe(ORIGIN.PRODUCT);
    expect(filled.manufacturer?.origin).toBe(ORIGIN.BRAND);
    expect(filled.colour?.origin).toBe(ORIGIN.FAMILY);
  });

  it("asks only the keys it was given", () => {
    const filled = fillFacts<K>({}, levelsOf(family, brand, defaults), ["colour"]);
    expect(Object.keys(filled)).toEqual(["colour"]);
  });
});

describe("blank is not an answer", () => {
  it("does not inherit an empty or whitespace string, and keeps looking", () => {
    const filled = fillFacts<K>({ material: "  " }, levelsOf(family, brand, defaults), KEYS);
    expect(filled.material).toEqual({ value: "nida-matte", origin: ORIGIN.FAMILY });
  });

  it("treats a level's blank as unanswered and falls through it", () => {
    const filled = fillFacts<K>({}, levelsOf({ material: "" }, brand, defaults), KEYS);
    expect(filled.material).toEqual({ value: "crepe", origin: ORIGIN.BRAND });
  });

  it("ignores null and undefined at any level", () => {
    const filled = fillFacts<K>(
      { countryOfOrigin: null },
      levelsOf({ countryOfOrigin: undefined }, { countryOfOrigin: null }, defaults),
      KEYS,
    );
    expect(filled.countryOfOrigin).toEqual({ value: "AE", origin: ORIGIN.DEFAULTS });
  });

  it("accepts a meaningful zero and a false, which are answers", () => {
    type N = "packQuantity" | "waterResistant";
    const filled = fillFacts<N>({ packQuantity: 0, waterResistant: false }, [], ["packQuantity", "waterResistant"]);
    expect(filled.packQuantity).toEqual({ value: 0, origin: ORIGIN.PRODUCT });
    expect(filled.waterResistant).toEqual({ value: false, origin: ORIGIN.PRODUCT });
  });

  it("refuses NaN, which is a blank number input rather than a number", () => {
    type N = "packQuantity";
    const filled = fillFacts<N>({ packQuantity: Number.NaN }, [{ origin: ORIGIN.BRAND, answers: { packQuantity: 2 } }], [
      "packQuantity",
    ]);
    expect(filled.packQuantity).toEqual({ value: 2, origin: ORIGIN.BRAND });
  });
});

describe("which level answered is what a correction acts on", () => {
  it("names the facts that came from a given level", () => {
    const filled = fillFacts<K>({}, levelsOf(family, brand, defaults), KEYS);
    expect(answeredBy(filled, ORIGIN.FAMILY).sort()).toEqual(["colour", "material"]);
    expect(answeredBy(filled, ORIGIN.BRAND).sort()).toEqual(["countryOfOrigin", "manufacturer"]);
  });

  it("excludes a fact the shop has answered itself", () => {
    const filled = fillFacts<K>({ material: "georgette" }, levelsOf(family, brand, defaults), KEYS);
    expect(answeredBy(filled, ORIGIN.FAMILY)).toEqual(["colour"]);
  });

  it("names nothing for a level that answered nothing", () => {
    const filled = fillFacts<K>({}, levelsOf(family, brand, null), KEYS);
    expect(answeredBy(filled, ORIGIN.DEFAULTS)).toEqual([]);
  });
});

describe("editing a filled-in fact makes it the product's own", () => {
  it("clears the mark on the edited key", () => {
    const filled = fillFacts<K>({}, levelsOf(family, brand, defaults), KEYS);
    const after = takeOwnership(filled, ["material"]);
    expect(after.material).toEqual({ value: "nida-matte", origin: ORIGIN.PRODUCT });
  });

  // The value may equal what was inherited and the choice is still deliberate; leaving the mark
  // would let the next brand correction silently revert it.
  it("clears the mark even when the value is unchanged", () => {
    const filled = fillFacts<K>({}, levelsOf(null, brand, null), KEYS);
    expect(filled.countryOfOrigin?.origin).toBe(ORIGIN.BRAND);
    const after = takeOwnership(filled, ["countryOfOrigin"]);
    expect(after.countryOfOrigin).toEqual({ value: "IN", origin: ORIGIN.PRODUCT });
    expect(answeredBy(after, ORIGIN.BRAND).sort()).toEqual(["manufacturer", "material"]);
  });

  it("leaves other keys alone", () => {
    const filled = fillFacts<K>({}, levelsOf(family, brand, defaults), KEYS);
    const after = takeOwnership(filled, ["material"]);
    expect(after.manufacturer?.origin).toBe(ORIGIN.BRAND);
  });

  it("ignores a key with no stored answer", () => {
    const filled = fillFacts<K>({}, levelsOf(null, null, null), KEYS);
    expect(takeOwnership(filled, ["material"]).material).toBeUndefined();
  });

  it("does not mutate what it was given", () => {
    const filled = fillFacts<K>({}, levelsOf(family, null, null), KEYS);
    takeOwnership(filled, ["material"]);
    expect(filled.material?.origin).toBe(ORIGIN.FAMILY);
  });
});

describe("a retired brand still answers", () => {
  // Retiring hides a brand from pickers, never from the fill step (D6): a product that named it
  // must read exactly as before.
  it("fills from a brand regardless of whether it is retired", () => {
    const filled = fillFacts<K>({}, levelsOf(null, brand, null), KEYS);
    expect(filled.manufacturer).toEqual({ value: "Noor Garments", origin: ORIGIN.BRAND });
  });
});
