import { describe, expect, it } from "vitest";

import { PRODUCT_TYPE, PRODUCT_TYPES, PRODUCT_TYPE_DECLARATIONS } from "@server/catalog/product-type";
import {
  FREE_SIZE,
  formatMeasurement,
  missingRequiredMeasurements,
  sizeLabelFor,
} from "@server/catalog/size-label";

describe("a size label is worked out from measurements", () => {
  it("reads a measured abaya as free size, and says what from", () => {
    const label = sizeLabelFor(PRODUCT_TYPE.ISLAMIC_WEAR, { length: 54, bust: 44 });
    expect(label?.label).toBe(FREE_SIZE);
    expect(label?.from).toEqual({ length: 54, bust: 44 });
    expect(label?.unit).toBe("in");
  });

  it("says nothing for a type with no measurements given", () => {
    expect(sizeLabelFor(PRODUCT_TYPE.ISLAMIC_WEAR, {})).toBeNull();
  });

  it("says nothing for a product with no type", () => {
    expect(sizeLabelFor(null, { length: 54 })).toBeNull();
  });

  it("says nothing for a type that has no notion of size", () => {
    expect(sizeLabelFor(PRODUCT_TYPE.FRAGRANCE, { capacity: 12 })).toBeNull();
    expect(sizeLabelFor(PRODUCT_TYPE.COMBO, {})).toBeNull();
  });

  it("ignores a measurement the type does not read a size from", () => {
    const label = sizeLabelFor(PRODUCT_TYPE.TROUSERS, { length: 40, bust: 44 });
    expect(label?.from).toEqual({ length: 40 });
  });

  it("carries the unit its type fixed, which differs between a garment and a mat", () => {
    expect(sizeLabelFor(PRODUCT_TYPE.ISLAMIC_WEAR, { length: 54 })?.unit).toBe("in");
    expect(sizeLabelFor(PRODUCT_TYPE.PRAYER_MAT, { length: 110, width: 70 })?.unit).toBe("cm");
  });
});

describe("a ring is the exception, because its size is a real scale", () => {
  it("turns an inner diameter into a ring size", () => {
    expect(sizeLabelFor(PRODUCT_TYPE.JEWELLERY, { diameter: 17.3 })?.label).toBe("14");
    expect(sizeLabelFor(PRODUCT_TYPE.JEWELLERY, { diameter: 14.0 })?.label).toBe("6");
  });

  it("takes the nearest size, because a ring either fits or does not", () => {
    expect(sizeLabelFor(PRODUCT_TYPE.JEWELLERY, { diameter: 17.1 })?.label).toBe("14");
    expect(sizeLabelFor(PRODUCT_TYPE.JEWELLERY, { diameter: 18.0 })?.label).toBe("16");
  });

  it("clamps beyond either end rather than inventing a size", () => {
    expect(sizeLabelFor(PRODUCT_TYPE.JEWELLERY, { diameter: 5 })?.label).toBe("6");
    expect(sizeLabelFor(PRODUCT_TYPE.JEWELLERY, { diameter: 40 })?.label).toBe("22");
  });

  it("says nothing without a diameter", () => {
    expect(sizeLabelFor(PRODUCT_TYPE.JEWELLERY, {})).toBeNull();
  });
});

describe("nothing here blocks saving", () => {
  it("names the required measurements a product has not given", () => {
    expect(missingRequiredMeasurements(PRODUCT_TYPE.PRAYER_MAT, {})).toEqual(["length", "width"]);
    expect(missingRequiredMeasurements(PRODUCT_TYPE.PRAYER_MAT, { length: 110 })).toEqual(["width"]);
    expect(missingRequiredMeasurements(PRODUCT_TYPE.PRAYER_MAT, { length: 110, width: 70 })).toEqual([]);
  });

  it("asks nothing of a product with no type", () => {
    expect(missingRequiredMeasurements(null, {})).toEqual([]);
  });

  it("reports rather than throws, for every type", () => {
    for (const type of PRODUCT_TYPES) {
      expect(() => missingRequiredMeasurements(type, {})).not.toThrow();
    }
  });
});

describe("a measurement reads with the unit its type fixed", () => {
  it("formats a number with its unit", () => {
    expect(formatMeasurement(PRODUCT_TYPE.ISLAMIC_WEAR, "length", 54)).toBe("54 in");
    expect(formatMeasurement(PRODUCT_TYPE.FRAGRANCE, "capacity", 12)).toBe("12 ml");
  });

  it("says nothing for an absent value or an absent type", () => {
    expect(formatMeasurement(PRODUCT_TYPE.ISLAMIC_WEAR, "length", undefined)).toBeNull();
    expect(formatMeasurement(null, "length", 54)).toBeNull();
  });

  it("falls back to the bare number for a measure the type does not declare", () => {
    expect(formatMeasurement(PRODUCT_TYPE.FRAGRANCE, "bust", 44)).toBe("44");
  });
});

/**
 * The derived label must not be storable. A column holding it would go stale the moment a
 * measurement changed, and the stale value would win (categories D7).
 */
describe("the label is derived, never stored", () => {
  it("is absent from every product type declaration", () => {
    const serialised = JSON.stringify(PRODUCT_TYPE_DECLARATIONS);
    expect(serialised).not.toMatch(/"sizeLabel"/);
    expect(serialised).not.toMatch(/"size"\s*:/);
  });

  it("changes when the measurement it came from changes", () => {
    const before = sizeLabelFor(PRODUCT_TYPE.JEWELLERY, { diameter: 14.0 });
    const after = sizeLabelFor(PRODUCT_TYPE.JEWELLERY, { diameter: 19.0 });
    expect(before?.label).not.toBe(after?.label);
  });
});
