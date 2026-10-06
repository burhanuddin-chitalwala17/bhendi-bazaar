import { describe, expect, it } from "vitest";

import type { ProductTypeRecord } from "@server/listing/product-type.types";
import {
  FREE_SIZE,
  formatMeasurement,
  missingRequiredMeasurements,
  sizeLabelFor,
} from "@server/listing/size-label";

/**
 * A type is a row now, so these are records rather than constants — which is the point: a scale
 * is data an admin edits, and the derivation below is the only code
 * ([product-types](../../docs/specs/listing-vocabulary/product-types/) D9).
 */
const type = (over: Partial<ProductTypeRecord>): ProductTypeRecord => ({
  key: "t",
  label: "T",
  facts: [],
  measures: [],
  variantAxis: [],
  kinds: [],
  factLabels: {},
  labelFrom: [],
  labelScale: null,
  ...over,
});

const islamicWear = type({
  key: "islamic-wear",
  measures: [
    { key: "length", label: "Length", unit: "in", required: true },
    { key: "bust", label: "Bust", unit: "in", required: true },
    { key: "waist", label: "Waist", unit: "in", required: false },
  ],
  labelFrom: ["length", "bust", "waist"],
});

const prayerMat = type({
  key: "prayer-mat",
  measures: [
    { key: "length", label: "Length", unit: "cm", required: true },
    { key: "width", label: "Width", unit: "cm", required: true },
  ],
  labelFrom: ["length", "width"],
});

const fragrance = type({
  key: "fragrance",
  measures: [{ key: "capacity", label: "Capacity", unit: "ml", required: true }],
  labelFrom: [],
});

const jewellery = type({
  key: "jewellery",
  measures: [{ key: "diameter", label: "Inner diameter", unit: "mm", required: true }],
  labelFrom: ["diameter"],
  labelScale: [
    { value: 14.0, label: "6" },
    { value: 14.9, label: "8" },
    { value: 15.7, label: "10" },
    { value: 16.5, label: "12" },
    { value: 17.3, label: "14" },
    { value: 18.2, label: "16" },
    { value: 19.0, label: "18" },
    { value: 19.8, label: "20" },
    { value: 20.6, label: "22" },
  ],
});

describe("a size label is worked out from measurements", () => {
  it("reads a measured abaya as free size, and says what from", () => {
    const label = sizeLabelFor(islamicWear, { length: 54, bust: 44 });
    expect(label?.label).toBe(FREE_SIZE);
    expect(label?.from).toEqual({ length: 54, bust: 44 });
    expect(label?.unit).toBe("in");
  });

  it("says nothing for a type with no measurements given", () => {
    expect(sizeLabelFor(islamicWear, {})).toBeNull();
  });

  it("says nothing for a product with no type", () => {
    expect(sizeLabelFor(null, { length: 54 })).toBeNull();
  });

  it("says nothing for a type that reads no label at all", () => {
    expect(sizeLabelFor(fragrance, { capacity: 12 })).toBeNull();
  });

  it("ignores a measurement the type does not read a label from", () => {
    const trousers = type({ measures: islamicWear.measures, labelFrom: ["length"] });
    expect(sizeLabelFor(trousers, { length: 40, bust: 44 })?.from).toEqual({ length: 40 });
  });

  it("carries the unit its type fixed, which differs between a garment and a mat", () => {
    expect(sizeLabelFor(islamicWear, { length: 54 })?.unit).toBe("in");
    expect(sizeLabelFor(prayerMat, { length: 110, width: 70 })?.unit).toBe("cm");
  });
});

describe("a declared scale turns a measurement into a label", () => {
  it("turns an inner diameter into a ring size", () => {
    expect(sizeLabelFor(jewellery, { diameter: 17.3 })?.label).toBe("14");
    expect(sizeLabelFor(jewellery, { diameter: 14.0 })?.label).toBe("6");
  });

  it("takes the nearest step, because a ring either fits or does not", () => {
    expect(sizeLabelFor(jewellery, { diameter: 17.1 })?.label).toBe("14");
    expect(sizeLabelFor(jewellery, { diameter: 18.0 })?.label).toBe("16");
  });

  it("clamps beyond either end rather than inventing a size", () => {
    expect(sizeLabelFor(jewellery, { diameter: 5 })?.label).toBe("6");
    expect(sizeLabelFor(jewellery, { diameter: 40 })?.label).toBe("22");
  });

  it("says nothing without the measurement its scale reads", () => {
    expect(sizeLabelFor(jewellery, {})).toBeNull();
  });

  // The scale being data is what makes a type configurable rather than half-configurable.
  it("follows whatever scale the type declares, not a built-in one", () => {
    const shoes = type({
      measures: [{ key: "length", label: "Length", unit: "cm", required: true }],
      labelFrom: ["length"],
      labelScale: [
        { value: 24, label: "UK 6" },
        { value: 25, label: "UK 7" },
      ],
    });
    expect(sizeLabelFor(shoes, { length: 24.9 })?.label).toBe("UK 7");
  });

  it("falls back to free size when a type declares an empty scale", () => {
    const empty = type({
      measures: [{ key: "length", label: "Length", unit: "cm", required: false }],
      labelFrom: ["length"],
      labelScale: [],
    });
    expect(sizeLabelFor(empty, { length: 10 })?.label).toBe(FREE_SIZE);
  });
});

describe("nothing here blocks saving", () => {
  it("names the required measurements a product has not given", () => {
    expect(missingRequiredMeasurements(prayerMat, {})).toEqual(["length", "width"]);
    expect(missingRequiredMeasurements(prayerMat, { length: 110 })).toEqual(["width"]);
    expect(missingRequiredMeasurements(prayerMat, { length: 110, width: 70 })).toEqual([]);
  });

  it("asks nothing of a product with no type", () => {
    expect(missingRequiredMeasurements(null, {})).toEqual([]);
  });

  it("reports rather than throws, for a type that measures nothing", () => {
    expect(() => missingRequiredMeasurements(type({}), {})).not.toThrow();
  });
});

describe("a measurement reads with the unit its type fixed", () => {
  it("formats a number with its unit", () => {
    expect(formatMeasurement(islamicWear, "length", 54)).toBe("54 in");
    expect(formatMeasurement(fragrance, "capacity", 12)).toBe("12 ml");
  });

  it("says nothing for an absent value or an absent type", () => {
    expect(formatMeasurement(islamicWear, "length", undefined)).toBeNull();
    expect(formatMeasurement(null, "length", 54)).toBeNull();
  });

  it("falls back to the bare number for a measure the type does not declare", () => {
    expect(formatMeasurement(fragrance, "bust", 44)).toBe("44");
  });
});

describe("the label is derived, never stored", () => {
  it("changes when the measurement it came from changes", () => {
    expect(sizeLabelFor(jewellery, { diameter: 14.0 })?.label).not.toBe(
      sizeLabelFor(jewellery, { diameter: 19.0 })?.label,
    );
  });

  it("is not a field a type can carry", () => {
    expect(Object.keys(islamicWear)).not.toContain("sizeLabel");
    expect(Object.keys(islamicWear)).not.toContain("size");
  });
});
