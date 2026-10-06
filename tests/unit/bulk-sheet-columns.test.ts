import { describe, expect, it } from "vitest";

import {
  SPINE_COLUMNS,
  factColumns,
  measureColumns,
  measureHeader,
  sheetColumns,
  stockColumns,
} from "@server/catalog/bulk/sheet-columns";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

/**
 * The sheet's columns are worked out from the types it is generated for, never fixed.
 *
 * That is the property worth holding: a template written down once goes stale the first time a
 * product type or a fact is added, and the drift is invisible until somebody's upload is
 * rejected for a column that no longer exists. These tests say the columns *follow* the types,
 * by giving them types the codebase has never seen.
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

const garment = type({
  key: "islamic-wear",
  label: "Islamic wear",
  facts: ["colour", "material", "sleeveLength"],
  factLabels: { material: "Fabric" },
  measures: [
    { key: "length", label: "Length", unit: "in", required: true },
    { key: "bust", label: "Bust", unit: "in", required: true },
  ],
});

const mat = type({
  key: "prayer-mat",
  label: "Prayer mat",
  facts: ["colour", "material", "shape"],
  measures: [
    { key: "length", label: "Length", unit: "cm", required: true },
    { key: "width", label: "Width", unit: "cm", required: false },
  ],
});

describe("the columns follow the types, not a template", () => {
  it("asks only what the given types ask", () => {
    const headers = factColumns([garment]).map((column) => column.header);
    expect(headers).toEqual(["colour", "material", "sleeveLength"]);
    expect(headers).not.toContain("shape");
  });

  it("grows when a type is added, without anything being edited", () => {
    const before = factColumns([garment]).map((c) => c.header);
    const after = factColumns([garment, mat]).map((c) => c.header);
    expect(after).toContain("shape");
    expect(after.length).toBeGreaterThan(before.length);
  });

  it("asks a shared fact once, however many types ask it", () => {
    const headers = factColumns([garment, mat]).map((c) => c.header);
    expect(headers.filter((header) => header === "colour")).toHaveLength(1);
  });

  // A type the codebase has never heard of still produces its columns, which is what
  // "generated at runtime" has to mean to be worth the words.
  it("follows a type invented after this test was written", () => {
    const shoes = type({
      key: "footwear",
      label: "Footwear",
      facts: ["colour", "closure"],
      measures: [{ key: "length", label: "Length", unit: "mm", required: true }],
    });
    const headers = sheetColumns([shoes], []).map((c) => c.header);
    expect(headers).toContain("closure");
    expect(headers).toContain("length (mm)");
  });

  it("carries no fact columns at all when no type is given", () => {
    expect(factColumns([])).toEqual([]);
    expect(sheetColumns([], []).map((c) => c.header)).toEqual([...SPINE_COLUMNS]);
  });
});

/**
 * One measure takes different units in different types — `length` is inches for a garment and
 * centimetres for a mat. A single `length` column across both would mean two things and the
 * person filling it would have no way to tell which.
 */
describe("a measurement column names its unit", () => {
  it("splits one measure into a column per unit", () => {
    const headers = measureColumns([garment, mat]).map((c) => c.header);
    expect(headers).toContain("length (in)");
    expect(headers).toContain("length (cm)");
    expect(headers).not.toContain("length");
  });

  it("keeps one column where the unit agrees", () => {
    const other = type({ key: "x", measures: garment.measures });
    const headers = measureColumns([garment, other]).map((c) => c.header);
    expect(headers.filter((h) => h === "length (in)")).toHaveLength(1);
  });

  it("names the types a measurement belongs to, and which require it", () => {
    const [length] = measureColumns([mat]);
    expect(length.note).toContain("Prayer mat");
    expect(length.note).toContain("Required by");
  });

  it("says optional where no type requires it", () => {
    const width = measureColumns([mat]).find((c) => c.header === "width (cm)");
    expect(width?.note).toContain("Optional");
  });

  it("builds its header from the measure and the unit", () => {
    expect(measureHeader("capacity", "ml")).toBe("capacity (ml)");
  });
});

describe("what the notes tell the person filling it", () => {
  it("gives a shared fact the wording each type uses for it", () => {
    const material = factColumns([garment, mat]).find((c) => c.header === "material");
    expect(material?.note).toContain("Fabric");
    expect(material?.note).toContain("Material");
  });

  it("names which types ask a fact", () => {
    const sleeve = factColumns([garment, mat]).find((c) => c.header === "sleeveLength");
    expect(sleeve?.note).toContain("Islamic wear");
    expect(sleeve?.note).not.toContain("Prayer mat");
  });

  it("says that a matching SKU updates rather than creates", () => {
    const sku = sheetColumns([], []).find((c) => c.header === "sku");
    expect(sku?.note.toLowerCase()).toContain("updates it");
  });

  it("says a blank product type is allowed and what it costs", () => {
    const column = sheetColumns([], []).find((c) => c.header === "productType");
    expect(column?.note).toContain("Blank is allowed");
    expect(column?.note).toContain("cannot be published");
  });
});

describe("stock columns are the org's real locations", () => {
  it("makes one per location", () => {
    expect(stockColumns(["Shop", "Warehouse"]).map((c) => c.header)).toEqual([
      "stock:Shop",
      "stock:Warehouse",
    ]);
  });

  it("makes none when the org has no locations", () => {
    expect(stockColumns([])).toEqual([]);
  });
});
